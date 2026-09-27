'use strict';
/** Privacy Policy, Terms of Use, Refund Policy — plain, human copy. */
const { page, esc } = require('../lib/layout');

const PAGES = {
  privacy: {
    title: 'Privacy Policy | Paigaam',
    h1: 'Privacy Policy',
    updated: 'Last updated 27 September 2026',
    body: `
      <h3>What we collect</h3>
      <p>Paigaam is made for personal messages, so we keep data to a minimum. When you create a Paigaam we store the details you enter (names, dates, your message and any photograph you choose to upload) — only so your page can be rendered and shared.</p>
      <p>We also count anonymous, non-personal usage events (which pages are visited, which buttons are clicked) to understand where the product needs to be better. These events contain no names, no numbers and no message content.</p>
      <h3>What we never do</h3>
      <ul>
        <li>We never sell your data, and there is no advertising on Paigaam.</li>
        <li>We never read your messages into a marketing list.</li>
        <li>We never require an account — most Paigaams are made and shared without one.</li>
      </ul>
      <h3>Published Paigaams</h3>
      <p>Anyone with your Paigaam's link can view it. Please don't include anything you wouldn't want the recipient to forward. Published Paigaams can be deleted on request — reach us on WhatsApp.</p>
      <h3>Photographs</h3>
      <p>Photographs you upload are stored only to be shown on your Paigaam, and are removed automatically after a period of non-use.</p>
      <h3>Contact</h3>
      <p>Questions, or a Paigaam you'd like removed? <a href="/contact">Message us on WhatsApp</a> and we'll act on it quickly.</p>
    `,
  },
  terms: {
    title: 'Terms of Use | Paigaam',
    h1: 'Terms of Use',
    updated: 'Last updated 27 September 2026',
    body: `
      <h3>Using Paigaam</h3>
      <p>Paigaam lets you create personalized digital greeting pages — invitations, letters, games and surprises — and share them as links. You may use it for personal, non-commercial messages.</p>
      <h3>Your content</h3>
      <p>You own everything you create. You confirm the content you upload (text and photographs) is yours to share and does not violate anyone's rights or any applicable law. We may remove Paigaams used for spam, harassment or unlawful content.</p>
      <h3>Paid templates</h3>
      <p>Paid designs are one-time purchases per Paigaam — the price shown at creation, payable over WhatsApp, with no recurring charges and no account required.</p>
      <h3>Availability</h3>
      <p>We work hard to keep every link alive, and published Paigaams are meant to be permanent. In the unlikely event of a service interruption, published links are restored from backups.</p>
      <h3>Contact</h3>
      <p>For anything about these terms, <a href="/contact">reach us on WhatsApp</a>.</p>
    `,
  },
  refund: {
    title: 'Refund Policy | Paigaam',
    h1: 'Refund Policy',
    updated: 'Last updated 27 September 2026',
    body: `
      <h3>Simple and fair</h3>
      <p>If a paid Paigaam doesn't work — the page won't load, the personalization didn't render, or the link is broken — we'll fix it first. If we can't fix it quickly, you get a full refund.</p>
      <h3>How to ask</h3>
      <p><a href="/contact">Message us on WhatsApp</a> with your Paigaam link within 7 days of purchase. Most issues are fixed within a day; refunds, when due, are processed immediately to the original payment method.</p>
      <h3>What isn't refundable</h3>
      <p>Paigaams that were successfully created and delivered aren't refundable for change of mind — the product is the link, and once it exists and works, it has served its purpose. Free templates, of course, cost nothing either way.</p>
    `,
  },
};

function legalPage(which) {
  const P = PAGES[which];
  if (!P) return null;
  return page(P.title, `
<main>
  <div class="wrap">
    <div class="legal">
      <span class="kicker">Paigaam</span>
      <h1>${esc(P.h1)}</h1>
      <span class="legal__updated">${esc(P.updated)}</span>
      ${P.body}
    </div>
  </div>
</main>`, {
    description: P.h1 + ' — Paigaam, because some things deserve more.',
    canonical: '/' + which,
  });
}

module.exports = { legalPage };
