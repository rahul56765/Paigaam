'use strict';
const { page, esc } = require('../lib/layout');
const { renderPaigaamPage } = require('../lib/renderPaigaam');
const { displayNames, displayDate } = require('../templates/registry');
const { logoFull } = require('../lib/brand');

function previewPage(paigaam, settings, opts = {}) {
  const baseUrl = opts.baseUrl || '';
  const isFree = Number(paigaam.template_price) <= 0;
  const tpl = { slug: paigaam.template_slug, category: paigaam.template_category, config: paigaam.template_config };
  const d = paigaam.customer_data || {};
  const names = displayNames(paigaam.template_slug, d).join(' & ');
  const html = renderPaigaamPage(tpl, paigaam, { isPreview: true });
  const srcdoc = html.replace(/"/g, '&quot;');

  const priceBlock = isFree
    ? `<div><span>Price</span><strong>Free</strong></div>`
    : `<div><span>Price</span><strong>₹${esc(paigaam.template_price)}</strong></div>`;

  const cta = isFree ? `
    <div id="freeArea">
      <button class="btn btn--primary" id="publishFree" data-id="${esc(paigaam.id)}">Publish my Paigaam</button>
      <a class="btn btn--ghost" href="/create/${esc(paigaam.template_slug)}?draft=${esc(paigaam.id)}">Edit Paigaam</a>
    </div>
    <div id="freeDone" hidden style="margin-top:8px">
      <p style="font-family:var(--serif);font-style:italic;font-size:20px;margin-bottom:18px">It's live — share the feeling.</p>
      <div class="qr-card" style="margin:0 auto 22px">
        <div style="display:flex;justify-content:center;margin-bottom:14px">${logoFull(120, 'Paigaam')}</div>
        <p class="qr-line">Scan to open<br>this Paigaam</p>
        <div id="freeQR" style="display:flex;justify-content:center"></div>
        <p class="qr-url" id="freeUrlText"></p>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn--primary btn--small" id="freeOpen" href="#" target="_blank" rel="noopener">Open</a>
        <button class="btn btn--small" id="freeCopy">Copy link</button>
        <button class="btn btn--small" id="freeQRdl">Download QR</button>
      </div>
    </div>`
    : `
    <a class="btn btn--whatsapp" href="/go/whatsapp/${esc(paigaam.id)}">Continue on WhatsApp</a>
    <a class="btn btn--ghost" href="/create/${esc(paigaam.template_slug)}?draft=${esc(paigaam.id)}">Edit Paigaam</a>`;

  const sub = isFree
    ? `Publish it now — your link and QR are yours instantly.`
    : `We'll confirm your Paigaam on WhatsApp and send your personal link once it's live.`;

  return page('Your Paigaam is ready', `
<main class="preview-page">
  <div class="wrap-narrow">
    <span class="kicker">Beautifully done</span>
    <h1 class="section__title">Your Paigaam is ready.</h1>
    <p class="section__sub" style="margin-top:14px">This is exactly what they'll see when they open it.</p>

    <div class="phone">
      <div class="phone__screen">
        <iframe title="Your personalized Paigaam" srcdoc="${srcdoc}" style="width:100%;height:100%;border:0"></iframe>
      </div>
    </div>

    <div class="preview-meta">
      <div><span>Template</span><strong>${esc(paigaam.template_name)}</strong></div>
      <div><span>Personalized for</span><strong>${esc(names)}</strong></div>
      ${d.eventDate ? `<div><span>The day</span><strong>${esc(displayDate(d.eventDate))}</strong></div>` : ''}
      ${priceBlock}
    </div>

    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">${cta}</div>
    <p style="margin-top:34px;color:var(--taupe);font-style:italic;font-family:var(--serif);font-size:16px">${sub}</p>
  </div>
</main>
${isFree ? `<script>
(function () {
  var btn = document.getElementById('publishFree');
  btn.addEventListener('click', function () {
    btn.disabled = true; btn.textContent = 'Publishing…';
    fetch('/api/free-publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: btn.dataset.id })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || !res.url) { btn.disabled = false; btn.textContent = 'Publish my Paigaam'; alert('Something went quiet. Please try again.'); return; }
      var url = res.url, short = url.replace(/^https?:\\/\\//, '');
      document.getElementById('freeArea').hidden = true;
      document.getElementById('freeDone').hidden = false;
      document.getElementById('freeOpen').href = url;
      document.getElementById('freeUrlText').textContent = short;
      // fetch branded QR SVG and embed it
      fetch('/api/qr?url=' + encodeURIComponent(url)).then(function (r) { return r.text(); }).then(function (svg) {
        document.getElementById('freeQR').innerHTML = svg;
      });
      document.getElementById('freeCopy').addEventListener('click', function () {
        var b = this;
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
          b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500);
        });
      });
      document.getElementById('freeQRdl').addEventListener('click', function () {
        var svg = document.querySelector('#freeQR svg'); if (!svg) return;
        var card = document.createElement('canvas'); card.width = 1080; card.height = 1350;
        var c2 = card.getContext('2d');
        var img = new Image(); var logo = new Image(); var n = 0;
        function draw() {
          c2.fillStyle = '#FBF4ED'; c2.fillRect(0, 0, 1080, 1350);
          c2.strokeStyle = '#E9DCC3'; c2.lineWidth = 2; c2.strokeRect(40, 40, 1000, 1270);
          var lw = 460, lh = lw * (logo.height / logo.width);
          c2.drawImage(logo, (1080 - lw) / 2, 120, lw, lh);
          c2.fillStyle = '#3B2420'; c2.textAlign = 'center'; c2.font = 'italic 44px Georgia, serif';
          c2.fillText('Scan to open', 540, 470); c2.fillText('our Paigaam', 540, 528);
          c2.drawImage(img, 240, 590, 600, 600);
          c2.font = '32px Inter, sans-serif'; c2.fillStyle = '#A8917E'; c2.fillText(short, 540, 1260);
          var a = document.createElement('a'); a.download = 'paigaam-qr.png'; a.href = card.toDataURL('image/png'); a.click();
        }
        function ready() { if (++n === 2) draw(); }
        img.onload = ready; logo.onload = ready;
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
        logo.src = '/brand/logo-full.png';
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function () { btn.disabled = false; btn.textContent = 'Publish my Paigaam'; });
  });
})();
</script>` : ''}`);
}

module.exports = { previewPage };
