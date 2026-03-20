import { getSiteMeta, getSiteBlueprint, getSiteHtml, deleteSite } from '../../src/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse: /api/site/{siteId} or /api/site/{siteId}/preview
  const url    = req.url.split('?')[0];
  const parts  = url.replace(/^\/api\/site\//, '').split('/');
  const siteId = parts[0];
  const action = parts[1] || null; // 'preview' or undefined

  if (!siteId)
    return res.status(400).json({ ok: false, error: 'siteId required' });

  // Validate siteId format before hitting FS
  if (!/^[a-z0-9]{8,40}$/.test(siteId))
    return res.status(400).json({ ok: false, error: 'Invalid siteId format' });

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const meta = getSiteMeta(siteId);
    if (!meta)
      return res.status(404).json({ ok: false, error: 'Site not found' });
    const deleted = deleteSite(siteId);
    return res.status(200).json({ ok: deleted, siteId, deleted });
  }

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method !== 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const meta = getSiteMeta(siteId);
  if (!meta)
    return res.status(404).json({ ok: false, error: 'Site not found', siteId });

  // /preview → return raw HTML
  if (action === 'preview') {
    const html = getSiteHtml(siteId);
    if (!html)
      return res.status(404).json({ ok: false, error: 'HTML not found', siteId });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    return res.status(200).send(html);
  }

  // /blueprint → return only blueprint JSON
  if (action === 'blueprint') {
    const blueprint = getSiteBlueprint(siteId);
    if (!blueprint)
      return res.status(404).json({ ok: false, error: 'Blueprint not found', siteId });
    return res.status(200).json({ ok: true, siteId, blueprint });
  }

  // default → meta
  return res.status(200).json({ ok: true, ...meta });
}
