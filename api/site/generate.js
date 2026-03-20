import Anthropic from '@anthropic-ai/sdk';
import { randomBytes } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const MODEL   = 'claude-sonnet-4-20250514';
const TOKENS  = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '1200', 10);
const TIMEOUT = parseInt(process.env.ANTHROPIC_TIMEOUT_MS || '30000', 10);
const RETRIES = parseInt(process.env.ANTHROPIC_RETRIES    || '0', 10);
const DATA_DIR = process.env.VERCEL ? '/tmp/sites' : (process.env.DATA_DIR || 'data/sites');

const RL = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const e = RL.get(ip) || { n: 0, reset: now + 60000 };
  if (now > e.reset) { e.n = 0; e.reset = now + 60000; }
  e.n++; RL.set(ip, e);
  return e.n <= 10;
}

function san(s, max) {
  if (typeof s !== 'string') return '';
  return s.trim().replace(/[<>"']/g, '').slice(0, max || 120);
}

const NICHE_DB = [
  { tags: ['юрист','юридич','адвокат','право'], profile: { target_segment: 'Собственник ИП/ООО, острая ситуация', tone_of_voice: 'Чёткий, уверенный, без жаргона' } },
  { tags: ['ремонт','отделка','строит'],         profile: { target_segment: 'Владелец квартиры, боится обмана',    tone_of_voice: 'Тёплый, честный' } },
  { tags: ['бухгалтер','налог'],                 profile: { target_segment: 'Собственник МСБ без бухгалтера',      tone_of_voice: 'Надёжный, спокойный' } },
  { tags: ['психолог','коуч'],                   profile: { target_segment: 'Взрослый в кризисе',                  tone_of_voice: 'Тёплый, безопасный' } },
  { tags: ['маркетинг','реклам','smm'],          profile: { target_segment: 'Потратил деньги на рекламу без результата', tone_of_voice: 'Прагматичный, с цифрами' } },
];
function findCtx(niche) {
  const q = niche.toLowerCase();
  for (const e of NICHE_DB) if (e.tags.some(t => q.includes(t))) return e.profile;
  return null;
}

function sysPrompt(ctx) {
  return `Ты — маркетолог. По нише создай blueprint лендинга.
ТОЛЬКО валидный JSON без пояснений и обёрток.
Запрещено: «профессионализм», «качество», «команда экспертов».
${ctx ? 'Контекст: ' + JSON.stringify(ctx) : ''}
Схема:
{"niche":string,"target_segment":string,"core_problem":string,"desired_outcome":string,"utp_short":string,"utp_long":string,"unique_mechanism":string,"offer":string,"proof":[{"type":string,"text":string}],"tone_of_voice":string,"palette":[{"role":string,"hex":string,"reason":string}],"sections":[{"id":string,"goal":string,"headline":string,"subheadline":string,"bullets":[],"cta":string,"trust_elements":[]}]}`;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildHtml(bp, meta) {
  const p   = bp.palette || [];
  const ink  = (p[0]||{}).hex || '#1C1917';
  const acc  = (p[1]||{}).hex || '#C2501F';
  const bg   = (p[2]||{}).hex || '#F4F1EB';
  const muted= (p[3]||{}).hex || '#78716C';
  const n    = esc(bp.niche || meta.niche);
  const utpS = esc(bp.utp_short || n);
  const utpL = esc(bp.utp_long  || '');
  const ofr  = esc(bp.offer     || 'Получить консультацию');

  const proof = (bp.proof||[]).map(p =>
    `<div style="background:${bg};border:1px solid ${ink}20;border-radius:10px;padding:12px 16px;flex:1;min-width:150px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:${muted};margin-bottom:4px">${esc(p.type||'')}</div>
      <div style="font-size:13px;color:${ink};font-weight:500">${esc(p.text||'')}</div>
    </div>`).join('');

  const secs = (bp.sections||[]).map(s => {
    const dark = s.id==='cta'||s.id==='offer';
    const bg2  = dark ? ink : bg;
    const fg   = dark ? '#fff' : ink;
    const fgm  = dark ? 'rgba(255,255,255,.5)' : muted;
    const buls = (s.bullets||[]).map(b =>
      `<li style="padding:4px 0 4px 16px;position:relative;font-size:14px;color:${fgm}"><span style="position:absolute;left:0;color:${acc}">—</span>${esc(b)}</li>`).join('');
    const trsts= (s.trust_elements||[]).map(t =>
      `<span style="display:inline-block;background:${acc}20;color:${acc};font-size:11px;padding:3px 10px;border-radius:100px;margin:2px">${esc(t)}</span>`).join('');
    const cta  = s.cta
      ? `<a href="#contact" style="display:inline-block;margin-top:16px;background:${acc};color:#fff;padding:11px 24px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none">${esc(s.cta)}</a>`
      : '';
    return `<section id="${esc(s.id)}" style="padding:60px 24px;background:${bg2};border-bottom:1px solid ${ink}10">
  <div style="max-width:800px;margin:0 auto">
    ${s.goal?`<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${acc};margin-bottom:8px;font-weight:600">${esc(s.goal)}</div>`:''}
    <h2 style="font-family:'Unbounded',sans-serif;font-size:clamp(19px,2.6vw,32px);font-weight:700;line-height:1.12;color:${fg};margin-bottom:10px;letter-spacing:-.02em">${esc(s.headline)}</h2>
    ${s.subheadline?`<p style="font-size:15px;color:${fgm};max-width:560px;line-height:1.7;margin-bottom:14px">${esc(s.subheadline)}</p>`:''}
    ${buls?`<ul style="list-style:none;padding:0;margin:12px 0">${buls}</ul>`:''}
    ${trsts?`<div style="margin-top:12px">${trsts}</div>`:''}
    ${cta}
  </div>
</section>`;}).join('\n');

  return `<!DOCTYPE html><html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${utpS}</title>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Plus Jakarta Sans',sans-serif;background:${bg};color:${ink};line-height:1.6;-webkit-font-smoothing:antialiased}a{color:inherit}@media(max-width:600px){section{padding:40px 18px!important}}</style>
</head><body>
<nav style="position:sticky;top:0;z-index:100;background:${bg}f0;backdrop-filter:blur(12px);border-bottom:1px solid ${ink}14;padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between">
  <span style="font-family:'Unbounded',sans-serif;font-size:12px;font-weight:700">${n}</span>
  <a href="#contact" style="background:${acc};color:#fff;padding:8px 18px;border-radius:7px;font-size:13px;font-weight:600;text-decoration:none">${ofr}</a>
</nav>
<section style="padding:84px 24px 68px;background:${ink}">
  <div style="max-width:800px;margin:0 auto">
    <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${acc};margin-bottom:16px">${n}</div>
    <h1 style="font-family:'Unbounded',sans-serif;font-size:clamp(26px,4.5vw,58px);font-weight:700;line-height:1.06;letter-spacing:-.03em;color:#fff;margin-bottom:18px">${utpS}</h1>
    ${utpL?`<p style="font-size:16px;color:rgba(255,255,255,.5);max-width:500px;line-height:1.75;margin-bottom:30px;font-weight:300">${utpL}</p>`:''}
    <a href="#contact" style="display:inline-block;background:${acc};color:#fff;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none">${ofr} →</a>
    ${proof?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:40px;padding-top:32px;border-top:1px solid rgba(255,255,255,.1)">${proof}</div>`:''}
  </div>
</section>
${secs}
<section id="contact" style="padding:68px 24px;background:${ink}">
  <div style="max-width:460px;margin:0 auto;text-align:center">
    <h2 style="font-family:'Unbounded',sans-serif;font-size:clamp(18px,3vw,30px);font-weight:700;color:#fff;margin-bottom:8px;letter-spacing:-.02em">${ofr}</h2>
    <p style="font-size:14px;color:rgba(255,255,255,.4);margin-bottom:24px">Ответим в течение часа</p>
    <form onsubmit="sub(event)" style="display:flex;flex-direction:column;gap:9px">
      <input name="name" type="text" placeholder="Ваше имя" required style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:11px 14px;font-size:14px;color:#fff;font-family:inherit;outline:none">
      <input name="phone" type="tel" placeholder="Телефон" required style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:11px 14px;font-size:14px;color:#fff;font-family:inherit;outline:none">
      <button type="submit" style="background:${acc};color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Отправить заявку</button>
    </form>
    <div id="ok" style="display:none;margin-top:14px;color:${acc};font-weight:500">✓ Заявка принята!</div>
  </div>
</section>
<footer style="padding:18px 24px;text-align:center;font-size:11px;color:${muted};border-top:1px solid ${ink}14">
  ${n} · <a href="/" style="color:${acc};text-decoration:none">Alladin AI</a> · <span style="font-family:monospace;opacity:.3">${meta.siteId}</span>
</footer>
<script>function sub(e){e.preventDefault();e.target.style.display='none';document.getElementById('ok').style.display='block'}</script>
</body></html>`;
}

export default async function handler(req, res) {
  const requestId = randomBytes(4).toString('hex');
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed', requestId });

  const ip = (req.headers['x-forwarded-for']||'local').split(',')[0].trim();
  if (!rateLimit(ip))
    return res.status(429).json({ ok: false, error: 'Too many requests', requestId });

  const niche = san((req.body||{}).niche, 120);
  if (!niche || niche.length < 2)
    return res.status(400).json({ ok: false, error: 'niche required (min 2 chars)', requestId });

  const t0 = Date.now();
  console.log(`[${requestId}] generate niche="${niche}"`);

  try {
    mkdirSync(DATA_DIR, { recursive: true });

    const client = new Anthropic({ timeout: TIMEOUT, maxRetries: RETRIES });
    const resp   = await client.messages.create({
      model: MODEL, max_tokens: TOKENS,
      system: sysPrompt(findCtx(niche)),
      messages: [{ role: 'user', content: `Ниша: "${niche}"` }],
    });

    const raw   = resp.content[0].text.trim();
    const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
    let bp;
    try { bp = JSON.parse(clean); }
    catch(e) {
      console.error(`[${requestId}] parse fail:`, raw.slice(0,200));
      return res.status(500).json({ ok:false, error:'Blueprint parse failed', hint: raw.slice(0,200), requestId });
    }

    const siteId = randomBytes(6).toString('hex');
    const generatedAt = new Date().toISOString();
    const meta = { siteId, niche, status:'ready', generatedAt, generationMs: Date.now()-t0 };
    const html = buildHtml(bp, meta);

    const dir = join(DATA_DIR, siteId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir,'site.json'),  JSON.stringify(bp, null, 2));
    writeFileSync(join(dir,'index.html'), html);
    writeFileSync(join(dir,'meta.json'),  JSON.stringify(meta, null, 2));

    console.log(`[${requestId}] done siteId=${siteId} ms=${meta.generationMs}`);
    return res.status(200).json({ ok:true, siteId, status:'ready', generatedAt, generationMs:meta.generationMs, previewUrl:`/api/site/${siteId}/preview`, requestId });

  } catch(err) {
    console.error(`[${requestId}] error:`, err.message);
    return res.status(500).json({ ok:false, error: err.message, requestId });
  }
}
