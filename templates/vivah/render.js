'use strict';
/**
 * Vivah renderer — Shubh Vivah, a divine-sky wedding invitation.
 *
 * Seven server-rendered beats in one continuous scroll:
 *   1  Hero      — the golden sky (generated), a bottom scrim, "Save the
 *                  Date" and the couple's names in ivory. Sun-glow breathes.
 *   2  Blessings — the toran garland across the top, "With the Blessings Of",
 *                  two gold-bordered parents' cards. (Pure white section — the
 *                  toran and petals carry baked-in white mats.)
 *   3  Invitation— "Together with our families' blessings…" with rose-petal
 *                  corners (pure white section, same reason).
 *   4  Events    — up to three ceremony cards (Mehendi · Muhurtham ·
 *                  Reception), each with a motif, and an Add-to-calendar link.
 *                  Petals drift behind the stack (with the hero glow, the
 *                  template's whole motion budget).
 *   5  Couple    — one framed photo, slightly tilted; the watercolor couple
 *                  holds the frame when no photo is uploaded.
 *   6  Countdown — "Our New Beginning Starts In": days · hours · minutes ·
 *                  seconds, tabular numerals, ticking client-side to the
 *                  Muhurtham (or the date the creator chose).
 *   7  Close     — venue, a Maps link, an RSVP-on-WhatsApp button, and
 *                  शुभ विवाह.
 *
 * Background music is the family's shared chip: a bgmSong field lands in the
 * wizard's last step; here it is just bgmMarkup + bgmScript (tap-to-start,
 * nothing loads until a guest taps). Every piece of creator text is
 * HTML-escaped here; the only client-side work (vivah.js) is the countdown,
 * the scroll fade-ups and the petals.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, multiline, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');

/* ------------------------------------------------------------- helpers */

/** '+91 98765-43210' → '919876543210'; a bare 10-digit Indian mobile gets 91. */
function waNumber(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = '91' + digits;
  return digits.length >= 11 && digits.length <= 15 ? digits : '';
}

/** '2027-02-14' → '14 February 2027' */
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** A Google Calendar "add event" link for a ceremony (all-day; no API, no auth). */
function gcalUrl(ev) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ev.date || '');
  if (!m) return '';
  const day = `${m[1]}${m[2]}${m[3]}`;
  const next = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1));
  const end = next.toISOString().slice(0, 10).replace(/-/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.name || 'Wedding ceremony',
    dates: `${day}/${end}`,
    details: ev.caption || '',
    location: ev.venue || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* -------------------------------------------------------------- motifs */

/** Ceremony icons — inline SVG, gold/maroon strokes, keyed by name. */
function motif(name) {
  const n = String(name || '').toLowerCase();
  if (/mehendi|mehndi|henna/.test(n)) {
    // a henna hand
    return `<svg class="vi-motif" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
      <path d="M24 40c-6 0-11-4-11-10V18c0-1.2 1-2 2-2s2 .8 2 2v8"/>
      <path d="M17 24V13c0-1.2 1-2 2-2s2 .8 2 2v9"/>
      <path d="M21 22V10c0-1.2 1-2 2-2s2 .8 2 2v12"/>
      <path d="M25 22V12c0-1.2 1-2 2-2s2 .8 2 2v11"/>
      <path d="M29 23V15c0-1.2 1-2 2-2s2 .8 2 2v13c0 7-4 12-9 12"/>
      <circle cx="23" cy="30" r="3.2"/>
      <path d="M23 27.5c.8-1 2.2-1 3 0M20 30c0 1.7 1.3 3 3 3"/>
    </svg>`;
  }
  if (/reception|ring|sangeet/.test(n)) {
    // two rings
    return `<svg class="vi-motif" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="19" cy="28" r="10"/>
      <circle cx="29" cy="20" r="10"/>
      <path d="M29 8l-3 5h6l-3-5z" fill="currentColor" stroke="none"/>
    </svg>`;
  }
  // muhurtham / default: a small flame in a diya
  return `<svg class="vi-motif" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
    <path d="M24 10c3 5 7 7 7 13a7 7 0 0 1-14 0c0-6 4-8 7-13z"/>
    <path d="M24 22c1.2 2 2.8 3 2.8 5.4a2.8 2.8 0 0 1-5.6 0c0-2.4 1.6-3.4 2.8-5.4z" fill="currentColor" stroke="none" opacity=".45"/>
    <path d="M12 36h24c-1 4-5 6-12 6s-11-2-12-6z"/>
  </svg>`;
}

/* --------------------------------------------------------------- beats */

function beat1(d) {
  const names = `${escape(d.brideName || 'The Bride')} <span class="vi-amp">&amp;</span> ${escape(d.groomName || 'The Groom')}`;
  return `
  <section class="vi-hero" data-vi-reveal>
    <img class="vi-hero__art" src="/vivah/hero.jpg" alt="A henna hand with bangles reaching into golden clouds, a small blue bird in the light" fetchpriority="high" decoding="async">
    <span class="vi-hero__glow" aria-hidden="true"></span>
    <span class="vi-hero__scrim" aria-hidden="true"></span>
    <div class="vi-hero__type">
      <p class="vi-hero__kicker">Save the Date</p>
      <h1 class="vi-hero__names">${names}</h1>
      <p class="vi-hero__hindi">शुभ विवाह</p>
    </div>
    <span class="vi-hero__cue" aria-hidden="true">scroll</span>
  </section>`;
}

function parentsCard(title, text) {
  const lines = multiline(text || '—');
  return `<div class="vi-pcard">
    <p class="vi-pcard__who">${escape(title)}</p>
    <p class="vi-pcard__names">${lines}</p>
  </div>`;
}

function beat2(d) {
  return `
  <section class="vi-bless" data-vi-reveal>
    <div class="vi-bless__toran"><img src="/vivah/toran.jpg" alt="" loading="lazy" decoding="async"></div>
    <div class="vi-inner">
      <p class="vi-kicker">शुभ मुहूर्त</p>
      <h2 class="vi-h2">With the Blessings Of</h2>
      <div class="vi-pcards">
        ${parentsCard("Bride's Parents", d.brideParents)}
        ${parentsCard("Groom's Parents", d.groomParents)}
      </div>
      <span class="vi-moti" aria-hidden="true"></span>
    </div>
  </section>`;
}

function beat3(d) {
  return `
  <section class="vi-ask" data-vi-reveal>
    <img class="vi-petal vi-petal--tl" src="/vivah/petal-tl.jpg" alt="" loading="lazy" decoding="async">
    <img class="vi-petal vi-petal--br" src="/vivah/petal-br.jpg" alt="" loading="lazy" decoding="async">
    <div class="vi-inner">
      <p class="vi-ask__lead">Together with our families' blessings,<br>we joyfully invite you to the wedding of</p>
      <p class="vi-ask__names">${escape(d.brideName || 'The Bride')} <span class="vi-amp">&amp;</span> ${escape(d.groomName || 'The Groom')}</p>
      <span class="vi-rule" aria-hidden="true"></span>
    </div>
  </section>`;
}

function beat4(d) {
  const events = d.events.slice(0, 3);
  return `
  <section class="vi-events" data-vi-reveal>
    <div class="vi-inner">
      <p class="vi-kicker">The ceremonies</p>
      <h2 class="vi-h2">Celebrate with us</h2>
      <div class="vi-stack">
        ${events.map(ev => {
          const gcal = gcalUrl(ev);
          return `<article class="vi-event">
            ${motif(ev.name)}
            <h3>${escape(ev.name)}</h3>
            <p class="vi-event__date">${escape(longDate(ev.date))}${ev.time ? ` · ${escape(ev.time)}` : ''}</p>
            ${ev.venue ? `<p class="vi-event__venue">${escape(ev.venue)}</p>` : ''}
            ${ev.caption ? `<p class="vi-event__cap">${escape(ev.caption)}</p>` : ''}
            ${gcal ? `<a class="vi-cal" href="${escape(gcal)}" target="_blank" rel="noopener noreferrer">Add to calendar <span aria-hidden="true">↗</span></a>` : ''}
          </article>`;
        }).join('\n        ')}
      </div>
    </div>
  </section>`;
}

function beat5(d) {
  const img = d.photo
    ? `<img src="${escape(d.photo)}" alt="${escape(d.brideName || 'The bride')} and ${escape(d.groomName || 'the groom')}" loading="lazy" decoding="async">`
    : `<img src="/vivah/couple.jpg" alt="A watercolor illustration of a bride and groom in ivory and rose, holding hands" loading="lazy" decoding="async">`;
  return `
  <section class="vi-couple" data-vi-reveal>
    <div class="vi-inner">
      <figure class="vi-frame">
        ${img}
        ${d.photoCaption ? `<figcaption>${escape(d.photoCaption)}</figcaption>` : ''}
      </figure>
    </div>
  </section>`;
}

function beat6(d, target) {
  const when = longDate(target);
  return `
  <section class="vi-count" data-vi-reveal>
    <div class="vi-inner">
      <p class="vi-kicker">The wait</p>
      <h2 class="vi-h2">Our New Beginning Starts In</h2>
      <div class="vi-timer" role="timer" aria-live="off" aria-label="Countdown to the wedding">
        ${['Days', 'Hours', 'Minutes', 'Seconds'].map(u => `<div class="vi-box"><span class="vi-num" data-vi-${u.toLowerCase()}>--</span><span class="vi-unit">${u}</span></div>`).join('\n        ')}
      </div>
      ${when ? `<p class="vi-count__when">${escape(when)}</p>` : ''}
    </div>
  </section>`;
}

function beat7(d) {
  const number = waNumber(d.rsvpPhone);
  const rsvpText = encodeURIComponent(`Namaste! We'd love to join ${d.brideName || 'the bride'} & ${d.groomName || 'the groom'}'s wedding celebrations.`);
  return `
  <section class="vi-close" data-vi-reveal>
    <div class="vi-inner">
      <p class="vi-kicker">शुभ विवाह</p>
      <h2 class="vi-h2">We await your presence</h2>
      ${d.venueName ? `<p class="vi-venue__name">${escape(d.venueName)}</p>` : ''}
      ${d.address ? `<p class="vi-venue__addr">${escape(d.address)}</p>` : ''}
      <div class="vi-cta">
        ${d.mapsUrl ? `<a class="vi-btn vi-btn--ghost" href="${escape(d.mapsUrl)}" target="_blank" rel="noopener noreferrer">Find your way <span aria-hidden="true">↗</span></a>` : ''}
        ${number ? `<a class="vi-btn" href="https://wa.me/${number}?text=${rsvpText}" target="_blank" rel="noopener noreferrer">Bless us with your presence</a>` : ''}
      </div>
      <span class="vi-rule" aria-hidden="true"></span>
      <p class="vi-foot">Made with love on <a href="/">Paigaam</a></p>
    </div>
  </section>`;
}

/* -------------------------------------------------------------- render */

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;

  // Countdown target: the chosen date, else the Muhurtham, else the first ceremony.
  const muhurtham = d.events.find(ev => /muhurtham|muhurt|wedding/i.test(ev.name || ''));
  const target = d.countdownDate || (muhurtham && muhurtham.date) || (d.events[0] && d.events[0].date) || '';

  const bride = d.brideName || 'the bride';
  const groom = d.groomName || 'the groom';
  const title = `${bride} & ${groom} — Shubh Vivah`;
  const description = `With the blessings of their families, ${bride} and ${groom} invite you to their wedding${target ? ` on ${longDate(target)}` : ''}.`;
  const bgm = d.bgmSong || '';
  // A creator's own photograph is the share card; the designed OG only when blank.
  const ogImage = d.photo || config.ogImage;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FCF9F3', image: ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Nunito+Sans:wght@300;400;600&family=Tiro+Devanagari+Hindi&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/vivah/vivah.css">
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #8E3B46; }</style>
<script src="/vivah/vivah.js" defer></script>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('viData', { target })}
<main class="vi-page">
  ${beat1(d)}
  ${beat2(d)}
  ${beat3(d)}
  ${beat4(d)}
  ${beat5(d)}
  ${beat6(d, target)}
  ${beat7(d)}
</main>
${bgmMarkup(bgm, 'a song for the day')}
${bgmScript(bgm)}
</body>
</html>`;
}

module.exports = { render, waNumber, longDate, gcalUrl };
