import { siteBlueprint } from "../src/analyze.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { niche } = req.body || {};
  if (!niche || typeof niche !== "string" || niche.trim().length < 2) {
    return res.status(400).json({ ok: false, error: "niche is required" });
  }

  const t0 = Date.now();
  try {
    const result = await siteBlueprint(niche);
    return res.json({ ...result, ms: Date.now() - t0 });
  } catch (err) {
    console.error("[site-blueprint]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
