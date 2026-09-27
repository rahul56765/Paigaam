'use strict';
/** Shared site shell: <head>, nav, footer. */
const { doveSVG } = require('./logo');
const { logoFull, doveMark, logoFullIvory, doveMarkIvory } = require('./brand');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Site head with complete SEO metadata.
 * opts: { description, canonical, ogImage, ogType, robots, headExtra, themeColor }
 * Every public page gets a unique title (caller-provided), unique description,
 * canonical URL, Open Graph + Twitter card tags.
 */
function head(title, extra = '', opts = {}) {
  const description = opts.description || 'Because some things deserve more. Create a beautiful digital Paigaam for the people and moments that matter.';
  const canonical = opts.canonical || '';
  const ogImage = opts.ogImage || '/brand/og-default.png';
  const ogType = opts.ogType || 'website';
  const robots = opts.robots || '';
  const themeColor = opts.themeColor || '#241610';
  let origin = '';
  try { origin = new URL(process.env.BASE_URL || 'https://paigaam.cc').origin; } catch (e) { origin = ''; }
  const abs = (u) => u.startsWith('http') || u.startsWith('data:') ? u : (origin + u);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(abs(canonical))}">` : ''}
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:site_name" content="Paigaam">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical ? abs(canonical) : origin)}">
<meta property="og:image" content="${esc(abs(ogImage))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(abs(ogImage))}">
${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}
<meta name="theme-color" content="${esc(themeColor)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/paigaam.css">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="apple-touch-icon" href="/brand/favicon-512.png">
${extra}
</head>`;
}

function nav(current = '') {
  const link = (href, label) => `<a href="${href}" ${current === href ? 'aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="nav nav--dark" id="siteNav">
  <div class="wrap nav__inner">
    <a href="/" class="nav__brand" aria-label="Paigaam home">
      ${logoFullIvory(150, 'Paigaam — home')}
    </a>
    <div class="nav__links" id="navLinks">
      ${link('/templates', 'Templates')}
      ${link('/occasions', 'Occasions')}
      ${link('/#how', 'How it works')}
      ${link('/contact', 'Contact')}
    </div>
    <div class="nav__actions">
      <a class="btn btn--primary nav__cta" href="/templates">Create your Paigaam&nbsp;&rarr;</a>
      <button class="nav__burger" id="navBurger" aria-label="Menu" aria-expanded="false" aria-controls="navLinks"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `<footer class="footer footer--dark">
  <div class="wrap">
    <div class="footer__top">
      <div class="footer__brand">
        <span style="width:132px;display:inline-block">${logoFullIvory(200, 'Paigaam')}</span>
        <p>Made for moments that matter.</p>
      </div>
      <div class="footer__grid">
        <div>
          <h4>Explore</h4>
          <ul>
            <li><a href="/templates">Templates</a></li>
            <li><a href="/occasions">Occasions</a></li>
            <li><a href="/#how">How it works</a></li>
          </ul>
        </div>
        <div>
          <h4>Occasions</h4>
          <ul>
            <li><a href="/templates/wedding">Wedding</a></li>
            <li><a href="/templates/birthday">Birthday</a></li>
            <li><a href="/templates/anniversary">Anniversary</a></li>
            <li><a href="/templates/festival">Festival</a></li>
          </ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul>
            <li><a href="/contact">WhatsApp us</a></li>
            <li><a href="https://instagram.com/paigaam.cc" target="_blank" rel="noopener nofollow">Instagram</a></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Use</a></li>
            <li><a href="/refund">Refund Policy</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="footer__base">
      <span>&copy; ${year} Paigaam &middot; Some moments deserve more than a message.</span>
      <span style="display:inline-block;opacity:0.85">${doveMarkIvory(38, 'Paigaam dove')}</span>
    </div>
  </div>
</footer>`;
}

/** Shared page scripts: analytics, reveal-on-scroll, nav drawer, sticky header, funnel clicks, live-card engine. */
const baseScripts = `<script>
/* Paigaam base scripts */
(function () {
  'use strict';
  /* ---------- analytics: fire-and-forget funnel events, no PII ---------- */
  window.paTrack = function (event, props) {
    try {
      var payload = JSON.stringify({ event: String(event || ''), props: props || {}, path: location.pathname, ref: document.referrer || '' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', payload);
      else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    } catch (e) { /* never break the page */ }
  };
  window.paTrack('page_view', { title: document.title });

  /* ---------- reveal on scroll ---------- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- nav drawer ---------- */
  var burger = document.getElementById('navBurger');
  var links = document.getElementById('navLinks');
  if (burger && links) {
    var closeMenu = function () { document.body.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false'); };
    burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) { if (e.target && e.target.tagName === 'A') closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---------- sticky header shadow ---------- */
  var navEl = document.getElementById('siteNav');
  if (navEl) {
    var onScroll = function () { navEl.classList.toggle('is-stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- funnel clicks ---------- */
  document.querySelectorAll('[data-track]').forEach(function (el) {
    el.addEventListener('click', function () {
      window.paTrack(el.getAttribute('data-track'), {
        template: el.getAttribute('data-template') || '',
        occasion: el.getAttribute('data-occasion') || '',
        label: el.getAttribute('data-label') || ''
      });
    });
  });

  /* ---------- live template card engine (drift + visibility). Kept verbatim from the
     previous shell: iframe a full render at miniature width, then drift it slowly from
     top to bottom in a loop. Starts only when visible; pauses offscreen; static
     first-frame for prefers-reduced-motion. */
  document.querySelectorAll('.tcard__live').forEach(function (frame) {
    var card = frame.closest('.tcard');
    if (!card) return;
    var fit = function () {
      try {
        var fdoc = frame.contentDocument;
        if (!fdoc || !fdoc.body) return;
        frame.style.width = (card.offsetWidth * 3) + 'px';
        frame.style.height = (card.offsetHeight * 3) + 'px';
        frame.style.transformOrigin = '0 0';
        frame.style.transform = 'scale(' + (1 / 3) + ')';
        frame.dataset.ready = '1';
      } catch (e) { /* cross-origin or not loaded yet */ }
    };
    var y = 0, raf = null, dir = 1, last = 0;
    var maxScroll = function () {
      try { return Math.max(1, (frame.contentDocument || { documentElement: {} }).documentElement.scrollHeight - frame.offsetHeight); }
      catch (e) { return 1; }
    };
    var step = function (ts) {
      if (frame.dataset.visible !== '1') { raf = null; return; }
      if (!last) last = ts;
      var dt = Math.min(64, ts - last); last = ts;
      y += dir * dt * 0.03; // ~18px/s at 3x scale — a slow, gentle drift
      var max = maxScroll();
      if (y >= max) { y = max; dir = -1; } else if (y <= 0 && dir < 0) { y = 0; dir = 1; }
      try { frame.contentWindow.scrollTo(0, y); } catch (e) {}
      raf = requestAnimationFrame(step);
    };
    var start = function () {
      if (raf || reduceMotion || frame.dataset.ready !== '1') return;
      frame.dataset.visible = '1'; last = 0; raf = requestAnimationFrame(step);
    };
    var stop = function () { frame.dataset.visible = '0'; if (raf) { cancelAnimationFrame(raf); raf = null; } };
    var ioVisible = '0';
    frame.addEventListener('load', function () { fit(); frame.classList.add('is-ready'); if (ioVisible === '1') start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          ioVisible = e.isIntersecting ? '1' : '0';
          e.isIntersecting ? start() : stop();
        });
      }, { threshold: 0.05 }).observe(card);
    } else { ioVisible = '1'; start(); }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  });
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      document.querySelectorAll('.tcard__live').forEach(function (f) {
        var c = f.closest ? f.closest('.tcard') : null;
        if (!c || f.dataset.ready !== '1') return;
        f.style.width = (c.offsetWidth * 3) + 'px';
        f.style.height = (c.offsetHeight * 3) + 'px';
        f.style.transform = 'scale(' + (1 / 3) + ')';
      });
    }, 150);
  });
})();
</script>`;

function page(title, bodyHTML, opts = {}) {
  // Canonical defaults to the page's own path so every public page self-canonicalises.
  // Template detail pages pass explicit canonicals (or none when previewing).
  if (opts.canonical === undefined && opts.current && !opts.current.startsWith('/templates/')) {
    opts.canonical = opts.current === '/' ? '/' : opts.current;
  }
  return head(title, opts.headExtra || '', opts) + `
<body>
${opts.noNav ? '' : nav(opts.current)}
${bodyHTML}
${opts.noFooter ? '' : footer()}
${opts.noNav || opts.noFooter ? '' : baseScripts}
${opts.scripts || ''}
</body>
</html>`;
}

/** Elegant branded error / empty page. */
function errorPage(status, line, sub) {
  return page(status + ' — Paigaam', `
<main class="empty">
  <div class="dove">${doveMarkIvory(96, 'Paigaam dove')}</div>
  <span class="kicker">Paigaam · ${esc(status)}</span>
  <h1>${esc(line)}</h1>
  <p>${esc(sub)}</p>
  <a class="btn btn--primary" href="/">Back to Paigaam</a>
</main>`);
}

module.exports = { page, head, nav, footer, errorPage, esc };
