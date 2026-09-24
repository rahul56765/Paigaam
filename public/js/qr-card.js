'use strict';
/**
 * Paigaam — the branded QR card, downloadable everywhere.
 *
 * Self-wiring: on any page that reveals a published link (input#publishedUrl)
 * this injects a "Download QR card" button after the QR figure and renders a
 * 1080×1350 keepsake on click — ivory ground, double champagne rule, the real
 * Paigaam wordmark, an italic serif caption, the branded QR on a white plate,
 * the short link and the tagline. No dependencies, no build step: the QR SVG
 * comes from /api/qr and the logo from /brand/logo-full.png, both same-origin,
 * so the canvas stays untainted and toDataURL works.
 *
 * Also exposes window.PaigaamQrCard.download(url, filename) for pages that
 * wire their own buttons (the legacy /preview flow).
 */
(function () {
  if (window.PaigaamQrCard) return;

  var IVORY = '#FBF4ED', INK = '#3B2420', CHAMPAGNE = '#E9DCC3',
      CHAMPAGNE_SOFT = '#EFE3CF', TAUPE = '#A8917E', GOLD = '#C9B49A';
  var W = 1080, H = 1350;

  function loadLogo() {
    return new Promise(function (resolve) {
      var logo = new Image();
      logo.onload = function () { resolve(logo); };
      logo.onerror = function () { resolve(null); }; // card still renders
      logo.src = '/brand/logo-full.png';
    });
  }

  function loadQrSvg(url) {
    return fetch('/api/qr?url=' + encodeURIComponent(url))
      .then(function (r) { if (!r.ok) throw new Error('qr ' + r.status); return r.text(); })
      .then(function (svg) {
        var b64 = btoa(unescape(encodeURIComponent(svg)));
        return new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = reject;
          img.src = 'data:image/svg+xml;base64,' + b64;
        });
      });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(logo, qrImg, url) {
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    // Ground + double champagne rule.
    ctx.fillStyle = IVORY; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = CHAMPAGNE; ctx.lineWidth = 3; ctx.strokeRect(44, 44, W - 88, H - 88);
    ctx.strokeStyle = CHAMPAGNE_SOFT; ctx.lineWidth = 1; ctx.strokeRect(62, 62, W - 124, H - 124);

    // The wordmark, at its natural aspect.
    if (logo) {
      var lw = 400, lh = lw * (logo.height / logo.width);
      ctx.drawImage(logo, (W - lw) / 2, 130, lw, lh);
    }

    // Italic serif caption.
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.font = 'italic 46px Georgia, "Times New Roman", serif';
    ctx.fillText('Scan to open', W / 2, 488);
    ctx.fillText('your Paigaam', W / 2, 546);

    // The QR on a white plate with a hairline.
    var plate = 620, px = (W - plate) / 2, py = 606;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, px, py, plate, plate, 18); ctx.fill();
    ctx.strokeStyle = CHAMPAGNE_SOFT; ctx.lineWidth = 1;
    roundRect(ctx, px, py, plate, plate, 18); ctx.stroke();
    var qrSide = 560;
    ctx.drawImage(qrImg, (W - qrSide) / 2, py + (plate - qrSide) / 2, qrSide, qrSide);

    // The link, quiet.
    ctx.fillStyle = TAUPE;
    ctx.font = '600 30px Inter, "Helvetica Neue", Arial, sans-serif';
    var short = String(url).replace(/^https?:\/\//, '');
    ctx.fillText(short, W / 2, 1262);

    // The tagline, quieter still.
    ctx.fillStyle = GOLD;
    ctx.font = 'italic 24px Georgia, "Times New Roman", serif';
    ctx.fillText('Because some things deserve more', W / 2, 1306);

    return canvas;
  }

  function filenameFor(url) {
    var m = /\/p\/([a-z0-9-]+)/.exec(String(url));
    return 'paigaam-qr' + (m ? '-' + m[1] : '') + '.png';
  }

  function download(url, filename) {
    return Promise.all([loadLogo(), loadQrSvg(url)]).then(function (parts) {
      var canvas = drawCard(parts[0], parts[1], url);
      var a = document.createElement('a');
      a.download = filename || filenameFor(url);
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
      return a.download;
    });
  }

  window.PaigaamQrCard = { download: download, drawCard: drawCard };

  /* --------------------------------------------------- the self-wiring bit */

  function ensureButton(input) {
    if (document.getElementById('paigaamQrDownload')) return;
    var host = input.closest('section, .result, main, body') || document;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'paigaamQrDownload';
    btn.className = 'button secondary qr-dl-btn';
    btn.textContent = 'Download QR card';
    // Standalone styling so the button reads right on any page that hosts it.
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-top:14px;'
      + 'padding:12px 26px;border:1px solid rgba(59,36,32,0.25);border-radius:999px;'
      + 'background:#F6EADF;color:#3B2420;font:700 0.78rem/1 Inter,"Helvetica Neue",sans-serif;'
      + 'letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;';
    btn.addEventListener('mouseenter', function () { btn.style.background = '#EFE2D2'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = '#F6EADF'; });
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = 'Preparing…';
      download(input.value).then(function () {
        btn.textContent = 'Downloaded ✓';
        setTimeout(function () { btn.textContent = 'Download QR card'; btn.disabled = false; }, 1800);
      }).catch(function () {
        btn.textContent = 'Download QR card'; btn.disabled = false;
      });
    });
    var figure = host.querySelector ? (host.querySelector('.qr') || host.querySelector('figure')) : null;
    if (figure && figure.parentNode) figure.parentNode.insertBefore(btn, figure.nextSibling);
    else (host.appendChild ? host.appendChild(btn) : document.body.appendChild(btn));
  }

  function watch() {
    var input = document.getElementById('publishedUrl');
    if (!input) return; // not a result page
    setInterval(function () {
      if (input.value) ensureButton(input);
    }, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
