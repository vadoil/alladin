import express from "express";
import { randomUUID } from "crypto";
import { analyzeNiche } from "./analyze.js";
import { initStorage, saveAnalysis } from "./storage.js";

const app = express();
app.use(express.json({ limit: "500kb" }));

const PORT = Number(process.env.PORT || 3000);
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000);
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 60);
const BATCH_LIMIT = Number(process.env.BATCH_LIMIT || 10);

const ipHits = new Map();

function log(event, payload = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = String(requestId);
  res.setHeader("x-request-id", req.requestId);
  next();
});

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const rec = ipHits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + RATE_WINDOW_MS;
  }

  rec.count += 1;
  ipHits.set(ip, rec);

  if (rec.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((rec.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    log("rate_limited", { requestId: req.requestId, ip, retryAfter });
    return res.status(429).json({
      ok: false,
      error: "rate_limited",
      details: `Too many requests. Retry in ${retryAfter}s`,
      requestId: req.requestId,
    });
  }

  return next();
}

async function runAnalyze(niche, requestId) {
  const t0 = Date.now();
  const result = await analyzeNiche(niche);
  const ms = Date.now() - t0;

  if (result.ok) {
    await saveAnalysis({
      requestId,
      niche,
      source: result.source,
      cached: result.cached,
      usedReferenceProfile: result.used_reference_profile,
      latencyMs: ms,
      payload: result.data,
    }).catch((err) => log("storage_save_failed", { requestId, error: err.message }));
  }

  return { ...result, ms, requestId };
}

app.use(express.static(process.cwd()));

app.get("/", (_req, res) => {
  return res.sendFile("index.html", { root: process.cwd() });
});

app.get("/health", async (_req, res) => {
  await initStorage().catch(() => {});
  res.json({ status: "ok", service: "niche-analyzer", version: "v1.1" });
});

app.post("/analyze", rateLimit, async (req, res) => {
  const { niche } = req.body || {};

  if (!niche || typeof niche !== "string" || niche.trim().length < 2) {
    return res.status(400).json({
      ok: false,
      error: "invalid_niche",
      details: "niche is required",
      requestId: req.requestId,
    });
  }

  try {
    const result = await runAnalyze(niche, req.requestId);
    log("analyze_done", {
      requestId: req.requestId,
      niche,
      ok: result.ok,
      cached: result.cached,
      source: result.source,
      ms: result.ms,
    });

    if (!result.ok) {
      const isValidation = result.error === "invalid_niche" || result.error === "schema_validation_failed";
      return res.status(isValidation ? 422 : 502).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    log("analyze_unexpected_error", { requestId: req.requestId, error: err?.message || String(err) });
    return res.status(500).json({
      ok: false,
      error: "internal_error",
      details: err?.message || String(err),
      requestId: req.requestId,
    });
  }
});

app.post("/analyze/batch", rateLimit, async (req, res) => {
  const niches = req.body?.niches;

  if (!Array.isArray(niches) || niches.length === 0) {
    return res.status(400).json({ ok: false, error: "invalid_batch", details: "niches[] is required", requestId: req.requestId });
  }

  if (niches.length > BATCH_LIMIT) {
    return res.status(400).json({ ok: false, error: "batch_too_large", details: `max ${BATCH_LIMIT}`, requestId: req.requestId });
  }

  const out = [];
  for (let i = 0; i < niches.length; i += 1) {
    const niche = String(niches[i] || "").trim();
    if (!niche) {
      out.push({ ok: false, error: "invalid_niche", details: "empty niche", index: i });
      continue;
    }
    // serialize to avoid burst/rate spikes upstream
    // (intentionally no Promise.all here)
    const result = await runAnalyze(niche, req.requestId);
    out.push({ index: i, niche, ...result });
  }

  log("batch_done", { requestId: req.requestId, count: out.length });
  return res.json({ ok: true, requestId: req.requestId, count: out.length, items: out });
});

initStorage()
  .then(() => log("storage_ready", { enabled: Boolean(process.env.DATABASE_URL) }))
  .catch((err) => log("storage_init_failed", { error: err.message }));

app.listen(PORT, () => {
  log("server_started", { port: PORT, version: "v1.1" });
});
