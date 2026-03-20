export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // Temporary graceful fallback so frontend can continue with /api/analyze
  return res.status(200).json({
    ok: false,
    error: "site_blueprint_not_implemented",
    details: "Use /api/analyze fallback",
  });
}
