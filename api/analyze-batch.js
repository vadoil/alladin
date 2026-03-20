import { analyzeNiche } from "../src/analyze.js";

const BATCH_LIMIT = Number(process.env.BATCH_LIMIT || 10);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const niches = req.body?.niches;
  if (!Array.isArray(niches) || niches.length === 0) {
    return res.status(400).json({ ok: false, error: "invalid_batch", details: "niches[] is required" });
  }
  if (niches.length > BATCH_LIMIT) {
    return res.status(400).json({ ok: false, error: "batch_too_large", details: `max ${BATCH_LIMIT}` });
  }

  const items = [];
  for (let i = 0; i < niches.length; i += 1) {
    const niche = String(niches[i] || "").trim();
    if (!niche) {
      items.push({ index: i, ok: false, error: "invalid_niche", details: "empty niche" });
      continue;
    }
    const t0 = Date.now();
    const result = await analyzeNiche(niche);
    items.push({ index: i, niche, ...result, ms: Date.now() - t0 });
  }

  return res.status(200).json({ ok: true, count: items.length, items });
}
