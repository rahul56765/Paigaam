'use strict';
/**
 * Welcome back — site-wide recovery popup.
 *
 * If this browser (creator cookie) made a paigaam in the last hour, offer it:
 *   · a PAID one (payment landed, tab closed) → "Open my Paigaam" (published
 *     link) — clicking lands directly on the published page
 *   · an unpaid draft → resume editing
 *
 * Silent when there's nothing to offer, already dismissed this session, or
 * the visitor is on a seller page (create/preview) that has its own popups.
 */
(function () {
  if (sessionStorage.getItem('paigaam.welcomeDismissed')) return;
  if (/^\/(create|preview|pay|recover|admin)\//.test(location.pathname) || /^\/p\//.test(location.pathname) || /^\/admin/.test(location.pathname)) return;

  fetch('/api/my-paigaams', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : { paigaams: [] }; })
    .then(function (data) {
      var items = (data && data.paigaams) || [];
      if (!items.length) return;
      // A paid paigaam beats a draft — lead with the most recent paid one.
      var paid = items.filter(function (x) { return x.paid && x.url; });
      var top = paid[0] || items[0];
      var paidOne = !!paid.length;

      var ask = document.createElement('div');
      ask.id = 'welcomeBack';
      ask.setAttribute('role', 'dialog');
      ask.setAttribute('aria-label', 'Welcome back');
      ask.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9998;max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:22px 24px;box-shadow:0 20px 50px rgba(0,0,0,.28);font-family:inherit';
      ask.innerHTML =
        '<p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#8F1018;margin:0 0 8px;font-weight:700">Welcome back</p>'
        + (paidOne
          ? '<h2 style="font-size:20px;margin:0 0 8px;font-weight:600">Your Paigaam is ready</h2>'
            + '<p style="font-size:14px;color:#6b5d54;margin:0 0 18px">Your payment went through and <strong>' + esc(top.template) + '</strong> for ' + esc(top.names || 'you') + ' is live. Here it is — or start a fresh one.</p>'
            + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
            + '<a href="' + esc(top.url) + '" style="background:#8F1018;color:#fff;border-radius:999px;padding:10px 22px;font-size:14px;font-weight:600;text-decoration:none">Open my Paigaam</a>'
            + '<button type="button" id="wbClose" style="background:transparent;color:#8F1018;border:1.5px solid #8F1018;border-radius:999px;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer">Create another</button>'
            + '</div>'
          : '<h2 style="font-size:20px;margin:0 0 8px;font-weight:600">Begin where you left off?</h2>'
            + '<p style="font-size:14px;color:#6b5d54;margin:0 0 18px">You were making <strong>' + esc(top.template) + '</strong>' + (top.names ? ' for ' + esc(top.names) : '') + '. Continue editing — nothing was lost.</p>'
            + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
            + '<a href="' + esc(top.preview) + '" style="background:#8F1018;color:#fff;border-radius:999px;padding:10px 22px;font-size:14px;font-weight:600;text-decoration:none">Continue editing</a>'
            + '<button type="button" id="wbClose" style="background:transparent;color:#8F1018;border:1.5px solid #8F1018;border-radius:999px;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer">Start fresh</button>'
            + '</div>');
      document.body.appendChild(ask);
      function close() { sessionStorage.setItem('paigaam.welcomeDismissed', '1'); ask.remove(); }
      ask.querySelector('#wbClose').addEventListener('click', close);
      // auto-dismiss after 12s so it never feels sticky
      setTimeout(function () { if (ask.parentNode) close(); }, 12000);
    }).catch(function () { /* never block the page */ });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
