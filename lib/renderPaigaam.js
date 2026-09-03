'use strict';
/**
 * Render a personalized Paigaam page (the immersive product page).
 * Driven entirely by template config (theme, sections, fields) + customer data.
 */
const { displayNames, displayDate } = require('../templates/registry');
const { doveSVG } = require('./logo');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function namesHTML(tpl, d, theme) {
  const names = displayNames(tpl.slug, d);
  const items = names.map(n => `<span class="n">${esc(theme.serifCase === 'uppercase' ? n.toUpperCase() : n)}</span>`);
  if (theme.ampersand && names.length > 1) {
    return items[0] + `<span class="amp">&</span>` + items.slice(1).join('');
  }
  return items.join('');
}

function sectionHTML(sec, tpl, d, theme) {
  const dateStr = displayDate(d.eventDate);
  switch (sec) {
    case 'hero': return `
      <section class="pg-hero">
        <div class="inner">
          <span class="pg-kicker reveal">${esc(kickerFor(tpl.category))}</span>
          <h1 class="pg-names reveal">${namesHTML(tpl, d, theme)}</h1>
          ${dateStr ? `<div class="pg-rule reveal"></div><p class="pg-date reveal">${esc(dateStr.toUpperCase())}${d.eventTime ? ' · ' + esc(fmtTime(d.eventTime)) : ''}</p>` : ''}
        </div>
        <span class="pg-scrollhint">Scroll gently</span>
      </section>`;
    case 'message': {
      if (!d.message) return '';
      return `<section class="pg-message"><div class="inner"><blockquote class="reveal">${esc(d.message)}</blockquote></div></section>`;
    }
    case 'details': {
      const rows = [];
      if (dateStr) rows.push(['The day', dateStr + (d.eventTime ? ' · ' + fmtTime(d.eventTime) : '')]);
      if (d.venue) rows.push(['The place', d.venue]);
      if (d.address) rows.push(['Where', d.address]);
      if (!rows.length) return '';
      return `<section class="pg-details"><div class="inner">
        <span class="pg-kicker reveal">The particulars</span>
        <div class="pg-detailrow">
          ${rows.map(([l, v], i) => `<div class="reveal" style="transition-delay:${i * 120}ms"><span class="lbl">${esc(l)}</span><span class="val">${esc(v)}</span></div>`).join('')}
        </div></div></section>`;
    }
    case 'photo': {
      if (!d.photo) return '';
      return `<section class="pg-photo"><div class="inner">
        <h2 class="reveal">A moment</h2>
        <figure class="reveal"><img src="${esc(d.photo)}" alt="A treasured photograph" loading="lazy"><figcaption>Held close</figcaption></figure>
      </div></section>`;
    }
    case 'years': {
      if (!d.years) return '';
      return `<section class="pg-years"><div class="inner">
        <div class="big reveal">${esc(d.years)}</div>
        <div class="cap reveal">${Number(d.years) === 1 ? 'year together' : 'years together'}</div>
      </div></section>`;
    }
    case 'countdown': {
      if (!d.eventDate) return '';
      return `<section class="pg-count" data-countdown="${esc(d.eventDate)}${d.eventTime ? 'T' + esc(d.eventTime) : ''}"><div class="inner">
        <span class="pg-kicker reveal">Until the day</span>
        <div class="pg-countgrid reveal">
          <div class="cell"><div class="num" data-cd="d">—</div><div class="unit">days</div></div>
          <div class="cell"><div class="num" data-cd="h">—</div><div class="unit">hours</div></div>
          <div class="cell"><div class="num" data-cd="m">—</div><div class="unit">minutes</div></div>
          <div class="cell"><div class="num" data-cd="s">—</div><div class="unit">seconds</div></div>
        </div>
      </div></section>`;
    }
    case 'closing': return `
      <section class="pg-close">
        <div class="inner">
          <div class="dove reveal">${doveSVG(theme.accent, 'width="100%"')}</div>
          <p class="reveal">${esc(closingFor(tpl.category))}</p>
          <div class="sig reveal">A Paigaam · made with love</div>
        </div>
      </section>`;
    default: return '';
  }
}

function kickerFor(cat) {
  return { Wedding: 'Together with their families', Birthday: 'A celebration', Anniversary: 'Still, and always', Baby: 'A new beginning', Festival: 'With joy', Personal: 'Just because' }[cat] || 'A Paigaam';
}
function closingFor(cat) {
  return {
    Wedding: 'We await you, with open hearts.',
    Birthday: 'Come as you are; leave a little happier.',
    Anniversary: 'Here’s to every year still to come.',
    Baby: 'Welcome to the world, little one.',
    Festival: 'May the light find you, wherever you are.',
    Personal: 'Because some Paigaams need no occasion.',
  }[cat] || 'With love, always.';
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${ap}`;
}

/** Title used for OG/share metadata, e.g. "Ayesha & Imran — Paigaam". */
function shareTitle(tpl, d) {
  const names = displayNames(tpl.slug, d);
  return names.join(' & ') + ' — Paigaam';
}

/**
 * Full HTML document for a published Paigaam.
 * @param tpl    template row (config merged in registry fields)
 * @param paigaam paigaam row
 * @param opts   { baseUrl, isPreview }
 */
function renderPaigaamPage(tpl, paigaam, opts = {}) {
  const cfg = tpl.config && tpl.config.fields ? tpl.config : { fields: tpl.fields, sections: tpl.sections, theme: tpl.theme };
  const theme = cfg.theme || {};
  const sections = cfg.sections || ['hero', 'message', 'details', 'closing'];
  const tplView = { slug: tpl.slug, category: tpl.category, fields: cfg.fields, sections, theme };
  const d = paigaam.customer_data || {};
  const title = shareTitle(tplView, d);
  const desc = `A special Paigaam from ${displayNames(tpl.slug, d).join(' & ')}.`;
  const canonical = opts.baseUrl && paigaam.slug ? `${opts.baseUrl}/p/${paigaam.slug}` : '';
  const accent = theme.accent || '#8F1018';

  const body = sections.map((s, i) => sectionHTML(s, tplView, d, theme)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}"><link rel="canonical" href="${esc(canonical)}">` : ''}
${d.photo ? `<meta property="og:image" content="${esc(d.photo)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${esc(theme.bg || '#FBF4ED')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/paigaam.css">
<link rel="stylesheet" href="/css/paigaam-pages.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  .pg { --pg-bg: ${esc(theme.bg || '#FBF4ED')}; --pg-ink: ${esc(theme.ink || '#3B2420')}; --pg-accent: ${esc(accent)}; --pg-soft: ${esc(theme.soft || '#EFE3D6')}; }
</style>
</head>
<body class="pg pg--${esc(tpl.slug)}">
${opts.isPreview ? '' : `
<div class="pg-veil" id="veil">
  <div class="dove">${doveSVG(accent, 'width="100%"')}</div>
  <div class="word">Paigaam</div>
  <div class="open-hint">A message has arrived for you</div>
  <button type="button" id="openBtn">Open</button>
</div>`}
${body}
<script>
(function () {
  var veil = document.getElementById('veil');
  if (veil) {
    document.getElementById('openBtn').addEventListener('click', function () {
      veil.classList.add('gone');
      setTimeout(function () { veil.remove(); }, 1400);
    });
  }
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.18 }) : null;
  document.querySelectorAll('.reveal').forEach(function (el) {
    if (io) io.observe(el); else el.classList.add('in');
  });
  var cd = document.querySelector('[data-countdown]');
  if (cd) {
    var target = new Date(cd.getAttribute('data-countdown') || cd.dataset.countdown).getTime();
    var els = { d: cd.querySelector('[data-cd="d"]'), h: cd.querySelector('[data-cd="h"]'), m: cd.querySelector('[data-cd="m"]'), s: cd.querySelector('[data-cd="s"]') };
    var tick = function () {
      var diff = target - Date.now();
      if (isNaN(target)) { return; }
      if (diff <= 0) { els.d.textContent = '0'; els.h.textContent = '0'; els.m.textContent = '0'; els.s.textContent = '0'; return; }
      els.d.textContent = Math.floor(diff / 86400000);
      els.h.textContent = Math.floor(diff / 3600000) % 24;
      els.m.textContent = Math.floor(diff / 60000) % 60;
      els.s.textContent = Math.floor(diff / 1000) % 60;
    };
    tick(); setInterval(tick, 1000);
  }
})();
</script>
</body>
</html>`;
}

module.exports = { renderPaigaamPage, shareTitle, esc, fmtTime };
