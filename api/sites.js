import { listSites } from '../src/store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const sites = listSites();
    const today = new Date().toISOString().slice(0, 10);
    const countToday = sites.filter(s => s.generatedAt?.startsWith(today)).length;
    const avgMs = sites.length
      ? Math.round(sites.reduce((acc, s) => acc + (s.generationMs || 0), 0) / sites.length)
      : 0;

    return res.status(200).json({
      ok: true,
      count: sites.length,
      countToday,
      avgGenerationMs: avgMs,
      sites,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
