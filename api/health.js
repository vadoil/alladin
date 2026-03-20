import { initStorage } from "../src/storage.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  await initStorage().catch(() => {});
  return res.status(200).json({ status: "ok", service: "niche-analyzer", version: "vercel-v1" });
}
