import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp/sites' : (process.env.DATA_DIR || 'data/sites');

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    if (!existsSync(DATA_DIR)) {
      return res.json({ ok: true, count: 0, countToday: 0, avgGenerationMs: 0, sites: [] });
    }

    const today = new Date().toISOString().slice(0, 10);
    const sites = readdirSync(DATA_DIR)
      .filter(name => {
        try { return statSync(join(DATA_DIR, name)).isDirectory(); } catch { return false; }
      })
      .map(siteId => {
        try {
          const p = join(DATA_DIR, siteId, 'meta.json');
          return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));

    const countToday = sites.filter(s => s.generatedAt?.startsWith(today)).length;
    const avgMs = sites.length
      ? Math.round(sites.reduce((s, x) => s + (x.generationMs || 0), 0) / sites.length)
      : 0;

    return res.json({ ok: true, count: sites.length, countToday, avgGenerationMs: avgMs, sites });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
