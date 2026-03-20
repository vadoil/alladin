import { readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp/sites' : (process.env.DATA_DIR || 'data/sites');

function validId(id) { return typeof id === 'string' && /^[a-f0-9]{8,16}$/.test(id); }

function read(siteId, file) {
  const p = join(DATA_DIR, siteId, file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse /api/site/{siteId} or /api/site/{siteId}/preview|blueprint
  const parts  = req.url.split('?')[0].replace(/^\/api\/site\//, '').split('/');
  const siteId = parts[0];
  const action = parts[1] || null;

  if (!validId(siteId))
    return res.status(400).json({ ok: false, error: 'Invalid siteId' });

  // DELETE
  if (req.method === 'DELETE') {
    const meta = read(siteId, 'meta.json');
    if (!meta) return res.status(404).json({ ok: false, error: 'Site not found' });
    try {
      rmSync(join(DATA_DIR, siteId), { recursive: true, force: true });
      return res.json({ ok: true, siteId, deleted: true });
    } catch(e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  if (req.method !== 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const metaRaw = read(siteId, 'meta.json');
  if (!metaRaw) return res.status(404).json({ ok: false, error: 'Site not found', siteId });
  const meta = JSON.parse(metaRaw);

  if (action === 'preview') {
    const html = read(siteId, 'index.html');
    if (!html) return res.status(404).json({ ok: false, error: 'HTML not found' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  if (action === 'blueprint') {
    const bp = read(siteId, 'site.json');
    if (!bp) return res.status(404).json({ ok: false, error: 'Blueprint not found' });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(bp);
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ ok: true, ...meta });
}
