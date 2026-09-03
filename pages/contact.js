'use strict';
const { page, esc } = require('../lib/layout');
const { doveSVG } = require('../lib/logo');

function contactPage(settings) {
  const num = (settings.whatsapp_number || '').replace(/\D/g, '');
  return page('Say hello', `
<main class="section">
  <div class="wrap-narrow" style="text-align:center;padding-top:60px">
    <div style="width:110px;margin:0 auto 30px" aria-hidden="true">${doveSVG('#8F1018', 'width="100%"')}</div>
    <span class="kicker">Contact</span>
    <h1 class="section__title">Say hello.</h1>
    <p class="section__sub" style="margin:18px auto 44px">Questions, custom designs, or a Paigaam for something we've never imagined — we'd love to hear it.</p>
    <a class="btn btn--whatsapp" href="https://wa.me/${esc(num)}?text=${encodeURIComponent('Hi Paigaam!')}" target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
  </div>
</main>`, { current: '/contact' });
}

module.exports = { contactPage };
