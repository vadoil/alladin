import { siteBlueprint } from '../../src/analyze.js';
import { buildHtml }     from '../../src/builder.js';
import { generateId, saveSite, ensureDataRoot } from '../../src/store.js';

// Simple in-memory rate limiter (per-IP, resets on cold start)
const RL = new Map();
const RL_WINDOW = 60_000; // 1 min
const RL_MAX    = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = RL.get(ip) || { count: 0, reset: now + RL_WINDOW };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + RL_WINDOW; }
  entry.count++;
  RL.set(ip, entry);
  return entry.count <= RL_MAX;
}

function sanitize(s, maxLen = 120) {
  if (typeof s !== 'string') return '';
  return s.trim().replace(/[<>]/g, '').slice(0, maxLen);
}

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).slice(2, 10);

  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Request-Id', requestId);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed', requestId });

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip))
    return res.status(429).json({ ok: false, error: 'Too many requests — wait a minute', requestId });

  // Input validation
  const { niche, geo, segment, mode } = req.body || {};
  const cleanNiche = sanitize(niche, 120);
  if (!cleanNiche || cleanNiche.length < 2)
    return res.status(400).json({ ok: false, error: 'niche is required (2+ chars)', requestId });

  const t0 = Date.now();
  console.log(`[${requestId}] generate start niche="${cleanNiche}" ip=${ip}`);

  try {
    ensureDataRoot();

    // 1. Generate blueprint via Claude
    const bpResult = await siteBlueprint(cleanNiche);
    if (!bpResult.ok)
      return res.status(500).json({ ok: false, error: bpResult.error || 'Blueprint generation failed', requestId });

    const blueprint = bpResult.data;

    // 2. Generate HTML
    const siteId = generateId();
    const generatedAt = new Date().toISOString();
    const meta = {
      siteId,
      niche: cleanNiche,
      geo:     sanitize(geo,     60) || null,
      segment: sanitize(segment, 60) || null,
      mode:    sanitize(mode,    30) || 'standard',
      status:  'ready',
      generatedAt,
      generationMs: 0,
      quality: bpResult.quality || null,
    };

    const html = buildHtml(blueprint, meta);
    meta.generationMs = Date.now() - t0;

    // 3. Persist
    saveSite(siteId, { blueprint, html, meta });

    console.log(`[${requestId}] generate done siteId=${siteId} ms=${meta.generationMs}`);

    return res.status(200).json({
      ok: true,
      siteId,
      status:      'ready',
      generatedAt,
      generationMs: meta.generationMs,
      previewUrl:  `/api/site/${siteId}/preview`,
      blueprint,
      requestId,
    });
  } catch (err) {
    console.error(`[${requestId}] generate error:`, err.message);
    return res.status(500).json({ ok: false, error: err.message, requestId });
  }
}
