import { analyzeNiche } from "../src/analyze.js";
import { initStorage, saveAnalysis } from "../src/storage.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const niche = req.body?.niche;
  if (!niche || typeof niche !== "string" || niche.trim().length < 2) {
    return res.status(400).json({ ok: false, error: "invalid_niche", details: "niche is required" });
  }

  const t0 = Date.now();
  await initStorage().catch(() => {});

  const result = await analyzeNiche(niche);
  const ms = Date.now() - t0;

  if (result.ok) {
    await saveAnalysis({
      requestId: req.headers["x-vercel-id"] || null,
      niche,
      source: result.source,
      cached: result.cached,
      usedReferenceProfile: result.used_reference_profile,
      latencyMs: ms,
      payload: result.data,
    }).catch(() => {});
    return res.status(200).json({ ...result, ms });
  }

  const isValidation = result.error === "invalid_niche" || result.error === "schema_validation_failed";
  return res.status(isValidation ? 422 : 502).json({ ...result, ms });
}
