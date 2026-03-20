// Builds a production-ready HTML landing from a site blueprint.
// No external deps — pure string concatenation for Vercel edge safety.

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function palette(p = []) {
  const defaults = ['#1C1917','#C2501F','#F4F1EB','#78716C'];
  const hex = i => (p[i] && p[i].hex) ? p[i].hex : defaults[i] || '#888';
  return { ink: hex(0), acc: hex(1), bg: hex(2), muted: hex(3) };
}

function renderSection(s, colors) {
  const { ink, acc, bg, muted } = colors;
  const bullets = (s.bullets || []).map(b =>
    `<li style="padding:6px 0 6px 20px;position:relative;font-size:15px;color:${muted}">
       <span style="position:absolute;left:0;color:${acc}">—</span>${esc(b)}
     </li>`
  ).join('');
  const trusts = (s.trust_elements || []).map(t =>
    `<span style="display:inline-block;background:${acc}1a;color:${acc};font-size:12px;padding:4px 12px;border-radius:100px;margin:3px">${esc(t)}</span>`
  ).join('');
  const cta = s.cta
    ? `<a href="#contact" style="display:inline-block;margin-top:20px;background:${acc};color:#fff;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none">${esc(s.cta)}</a>`
    : '';

  return `
<section id="${esc(s.id)}" style="padding:72px 24px;background:${s.id==='cta'?ink:bg};border-bottom:1px solid ${ink}18">
  <div style="max-width:860px;margin:0 auto">
    ${s.goal ? `<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${acc};margin-bottom:12px;font-weight:600">${esc(s.goal)}</div>` : ''}
    <h2 style="font-family:'Unbounded',sans-serif;font-size:clamp(22px,3vw,38px);font-weight:700;line-height:1.1;letter-spacing:-.02em;color:${s.id==='cta'?'#fff':ink};margin-bottom:14px">${esc(s.headline)}</h2>
    ${s.subheadline ? `<p style="font-size:16px;color:${s.id==='cta'?'rgba(255,255,255,.6)':muted};max-width:600px;line-height:1.7;margin-bottom:20px">${esc(s.subheadline)}</p>` : ''}
    ${bullets ? `<ul style="list-style:none;padding:0;margin:16px 0">${bullets}</ul>` : ''}
    ${trusts ? `<div style="margin-top:16px">${trusts}</div>` : ''}
    ${cta}
  </div>
</section>`;
}

export function buildHtml(blueprint, meta) {
  const c = palette(blueprint.palette);
  const niche  = esc(blueprint.niche || meta.niche || '');
  const utpS   = esc(blueprint.utp_short || niche);
  const utpL   = esc(blueprint.utp_long  || '');
  const offer  = esc(blueprint.offer     || '');
  const tov    = esc(blueprint.tone_of_voice || '');
  const sections = (blueprint.sections || []).map(s => renderSection(s, c)).join('\n');

  // Proof badges
  const proofBadges = (blueprint.proof || []).map(p =>
    `<div style="background:${c.bg};border:1px solid ${c.ink}14;border-radius:10px;padding:14px 18px;flex:1;min-width:180px">
       <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${c.muted};margin-bottom:6px">${esc(p.type||'')}</div>
       <div style="font-size:14px;color:${c.ink};font-weight:500">${esc(p.text||'')}</div>
     </div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${utpS}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:${c.bg};color:${c.ink};line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}
@media(max-width:600px){section{padding:48px 20px!important}}
</style>
</head>
<body>

<!-- NAV -->
<nav style="position:sticky;top:0;z-index:100;background:${c.bg}ee;backdrop-filter:blur(12px);border-bottom:1px solid ${c.ink}12;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between">
  <span style="font-family:'Unbounded',sans-serif;font-size:13px;font-weight:700;letter-spacing:-.02em">${niche}</span>
  <a href="#contact" style="background:${c.acc};color:#fff;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">${offer || 'Связаться'}</a>
</nav>

<!-- HERO -->
<section style="padding:96px 24px 80px;background:${c.ink}">
  <div style="max-width:860px;margin:0 auto">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${c.acc};margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <span style="width:24px;height:1px;background:${c.acc};display:inline-block"></span>
      ${niche}
    </div>
    <h1 style="font-family:'Unbounded',sans-serif;font-size:clamp(32px,5vw,68px);font-weight:700;line-height:1.05;letter-spacing:-.03em;color:#fff;margin-bottom:24px">${utpS}</h1>
    ${utpL ? `<p style="font-size:17px;color:rgba(255,255,255,.55);max-width:540px;line-height:1.75;margin-bottom:36px;font-weight:300">${utpL}</p>` : ''}
    <a href="#contact" style="display:inline-block;background:${c.acc};color:#fff;padding:15px 32px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;letter-spacing:.02em">${offer || 'Получить консультацию →'}</a>
    ${proofBadges ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:48px;padding-top:40px;border-top:1px solid rgba(255,255,255,.1)">${proofBadges}</div>` : ''}
  </div>
</section>

<!-- SECTIONS -->
${sections}

<!-- CONTACT FORM -->
<section id="contact" style="padding:80px 24px;background:${c.ink}">
  <div style="max-width:520px;margin:0 auto;text-align:center">
    <h2 style="font-family:'Unbounded',sans-serif;font-size:clamp(22px,3vw,36px);font-weight:700;color:#fff;margin-bottom:12px;letter-spacing:-.02em">${offer || 'Оставить заявку'}</h2>
    <p style="font-size:15px;color:rgba(255,255,255,.45);margin-bottom:32px">Ответим в течение часа в рабочее время</p>
    <form onsubmit="handleSubmit(event)" style="display:flex;flex-direction:column;gap:12px">
      <input name="name"  type="text"  placeholder="Ваше имя"   required style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:13px 16px;font-size:14px;color:#fff;font-family:inherit;outline:none">
      <input name="phone" type="tel"   placeholder="Телефон"     required style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:13px 16px;font-size:14px;color:#fff;font-family:inherit;outline:none">
      <input name="email" type="email" placeholder="Email (необязательно)" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:13px 16px;font-size:14px;color:#fff;font-family:inherit;outline:none">
      <button type="submit" style="background:${c.acc};color:#fff;border:none;border-radius:8px;padding:14px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .2s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">Отправить заявку</button>
    </form>
    <div id="form-ok" style="display:none;margin-top:20px;color:${c.acc};font-size:15px;font-weight:500">✓ Заявка принята — свяжемся скоро!</div>
  </div>
</section>

<!-- FOOTER -->
<footer style="padding:24px;text-align:center;font-size:12px;color:${c.muted};border-top:1px solid ${c.ink}14">
  ${niche} · Сайт создан с помощью <a href="/" style="color:${c.acc};text-decoration:none">Alladin AI</a>
  · <span style="font-family:monospace;font-size:11px;opacity:.4">${meta.siteId || ''}</span>
</footer>

<script>
function handleSubmit(e) {
  e.preventDefault();
  e.target.style.display='none';
  document.getElementById('form-ok').style.display='block';
}
</script>
</body>
</html>`;
}
