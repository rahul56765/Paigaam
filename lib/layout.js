'use strict';
/** Shared site shell: <head>, nav, footer. */
const { doveSVG } = require('./logo');
const { logoFull, doveMark } = require('./brand');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function head(title, extra = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Paigaam</title>
<meta name="description" content="Beautiful greetings, made personal. Create a beautiful digital Paigaam for the people and moments that matter.">
<meta property="og:title" content="${esc(title)} — Paigaam">
<meta property="og:description" content="Beautiful greetings, made personal.">
<meta name="theme-color" content="#FBF4ED">
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
  return `<nav class="nav">
  <div class="wrap nav__inner">
    <a href="/" class="nav__brand" aria-label="Paigaam home">
      ${logoFull(150, 'Paigaam — home')}
    </a>
    <div class="nav__links" id="navLinks">
      ${link('/templates', 'Templates')}
      ${link('/#occasions', 'Occasions')}
      ${link('/#how', 'How it works')}
      ${link('/contact', 'WhatsApp')}
    </div>
    <button class="nav__burger" id="navBurger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</nav>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div class="footer__brand">
        <span style="width:120px;display:inline-block">${doveSVG('#8F1018', 'width="100%"')}</span>
        <p>Beautiful greetings, made personal.</p>
      </div>
      <div>
        <h4>Explore</h4>
        <ul>
          <li><a href="/templates">Templates</a></li>
          <li><a href="/#occasions">Occasions</a></li>
          <li><a href="/#how">How it works</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><a href="/contact">WhatsApp</a></li>
          <li><a href="#" rel="nofollow">Instagram</a></li>
        </ul>
      </div>
      <div>
        <h4>Paigaam</h4>
        <ul>
          <li><a href="/admin/login">Admin</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__base">
      <span>© ${year} Paigaam · Some moments deserve more than a message.</span>
      <span style="display:inline-block;opacity:0.85">${doveMark(38, 'Paigaam dove')}</span>
    </div>
  </div>
</footer>`;
}

const baseScripts = `<script>
(function () {
  var b = document.getElementById('navBurger'), l = document.getElementById('navLinks');
  if (b && l) b.addEventListener('click', function () {
    var open = l.classList.toggle('open');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  document.querySelectorAll('.reveal').forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); });
})();
</script>`;

function page(title, bodyHTML, opts = {}) {
  return head(title, opts.headExtra || '') + `
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
  <div class="dove">${doveMark(96, 'Paigaam dove')}</div>
  <span class="kicker">Paigaam · ${esc(status)}</span>
  <h1>${esc(line)}</h1>
  <p>${esc(sub)}</p>
  <a class="btn btn--primary" href="/">Back to Paigaam</a>
</main>`);
}

module.exports = { page, head, nav, footer, errorPage, esc };

module.exports = { page, head, nav, footer, errorPage, esc };
;
