'use strict';
/** Shubh Sangam, a progressively enhanced bfday renderer.
 * customer_data is whitelisted by the bfday schema at save time; this renderer
 * also bounds and escapes every value and checks URL schemes at the output edge.
 * See public/shubh-sangam/README.md for the field contract and integration.
 */
const { escape: e, multiline, head, previewBadge } = require('../../lib/bfday/page');
const { resolve } = require('../../lib/bfday/fields');
const config = require('./config');
const schema = require('./schema');
const text = (v, n = 500) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n) : '';
const url = v => {
  v = text(v, 1000);
  if (/^\/(?!\/)[a-zA-Z0-9_./%-]+$/.test(v)) return v;
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
};
const date = v => {
  v = text(v, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (!m) return '';
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0,10) === v ? d.toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) : '';
};
const arr = v => Array.isArray(v) ? v.slice(0, 20).filter(x => x && typeof x === 'object' && !Array.isArray(x)) : [];
const img = (src, alt, cls) => src ? `<img class="${cls}" src="${e(src)}" alt="${e(alt)}" loading="lazy" decoding="async">` : '';
const display = (v, cls = '') => v ? `<p${cls ? ` class="${cls}"` : ''}>${multiline(v)}</p>` : '';
// Art is selected by the event's meaning, never by its position in the list.
function eventArt(heading) {
  const name = heading.toLowerCase().normalize('NFKC');
  if (/haldi|turmeric|meh[en]+di|henna/.test(name)) return 'haldi';
  if (/sangeet|sangit|music|dance|reception/.test(name)) return 'sangeet';
  return 'mandap'; // wedding, mandap and other celebrations
}
function eventCard(item, d) {
  const heading = text(item.name || item.heading || item.title || item.kind, 100);
  if (!heading) return '';
  const location = schema.eventLocation(item, d);
  const venue = text(location.venue, 300);
  const address = text(location.address, 300);
  const directions = schema.parseFamilyMapLink(location.mapsLink) || (address || venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || venue)}` : '');
  const photo = url(item.photo || item.image);
  const eventTime = schema.deriveEvent(item, d);
  const art = eventArt(heading);
  return `<article class="ss-event ss-event--${art}"><div class="ss-event__illustration"><img class="ss-event__art" src="/shubh-sangam/${art}.webp" alt="" loading="lazy" decoding="async"><div class="ss-event__overlay"><p class="ss-kicker">The celebrations</p><h3>${e(heading)}</h3>${display(eventTime ? `${eventTime.weekday}, ${eventTime.dateLabel}` : date(item.date),'ss-event__date')}${display(eventTime ? eventTime.timeLabel : text(item.time, 100),'ss-event__time')}</div></div><div class="ss-event__body">${display(text(item.description || item.lead, 300),'ss-event__lead')}<div class="ss-event__details">${display(venue,'ss-event__venue')}${address && address !== venue ? display(address,'ss-event__address') : ''}</div>${directions ? `<a class="ss-button ss-button--red" href="${e(directions)}" target="_blank" rel="noopener noreferrer">Get directions <span aria-hidden="true">↗</span></a>` : ''}${photo ? img(photo, `Photo for ${heading}`, 'ss-event__photo') : ''}</div></article>`;
}
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const bride = text(d.brideName, 80), groom = text(d.groomName, 80);
  const names = [bride,groom].filter(Boolean).join(' & ');
  const invitation = text([d.announcement, d.invitationMessage].filter(Boolean).join('\n\n'), 1000);
  // Explicit offset is essential: the guest's device zone must not change the instant.
  const wedding = schema.deriveWedding(d);
  const dateValue = wedding ? `${wedding.weekday}, ${wedding.dateLabel}` : date(d.weddingDate);
  const validTarget = wedding ? wedding.iso : '';
  const events = arr(d.events).filter(x => x.visible !== 'no').map(item => eventCard(item, d)).join('');
  const photos = arr(d.gallery).map(x => ({ src: url(x.image || x.photo), alt: text(x.alt || x.caption, 180) })).filter(x => x.src);
  const whatsapp = schema.internationalPhone(d.rsvpPhone);
  const contact = schema.rsvpLinks(d);
  const image = url(d.illustration);
  const mainDirections = schema.parseFamilyMapLink(d.venueMapsLink) || (d.venueAddress || d.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.venueAddress || d.venue)}` : '');
  const bridePhoto = url(d.bridePhoto), groomPhoto = url(d.groomPhoto), venuePhoto = url(d.venuePhoto);
  // Uploaded audio has priority; only actual direct HTTPS audio or family uploads.
  const musicUpload = text(d.musicUpload, 500);
  const upload = /^\/bfday\/uploads\/[a-f0-9]{48}\.(?:mp3|m4a|ogg|wav)$/.test(musicUpload) ? musicUpload : '';
  const musicLink = url(d.musicLink);
  const music = upload || (/^https:\/\//.test(musicLink) && /\.(?:mp3|m4a|ogg|wav)(?:\?|$)/i.test(musicLink) ? musicLink : '');
  const title = opts.title || (names ? `${names} · Shubh Sangam` : 'Shubh Sangam · Invitation');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head({paigaam,opts,title,description:names ? `An invitation to celebrate ${names}.` : 'A family invitation.',themeColor:'#8d1825'})}<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Great+Vibes&display=swap" rel="stylesheet"><link rel="stylesheet" href="/shubh-sangam/shubh-sangam.css?v=2"><script src="/shubh-sangam/shubh-sangam.js?v=1" defer></script></head><body data-preview="${!!opts.isPreview}">${previewBadge(opts)}
  <div class="ss-petals" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>
  <main><section class="ss-cover" aria-label="Invitation envelope"><div class="ss-cover__frame"><div class="ss-envelope" data-envelope><div class="ss-envelope__back"></div><div class="ss-envelope__flap"></div><div class="ss-envelope__front"></div><button type="button" class="ss-seal" data-open aria-label="Open invitation"><span aria-hidden="true"></span></button></div><p class="ss-cover__hint">Tap the seal to open</p><a href="#invitation" class="ss-cover__skip">Skip to invitation</a></div></section>
  <div class="ss-page" id="invitation"><div class="ss-garland" aria-hidden="true"></div><section class="ss-intro ss-section"><div class="ss-illustration">${image ? img(image,'','ss-illustration__image') : '<img src="/shubh-sangam/blessings.webp" alt="" class="ss-illustration__image">'}</div><p class="ss-kicker">A celebration of togetherness</p>${invitation ? `<p class="ss-invitation">${multiline(invitation)}</p>` : ''}${names ? `<h1 class="ss-names">${bride ? `<span>${e(bride)}</span>` : ''}${bride && groom ? '<i>&amp;</i>' : ''}${groom ? `<span>${e(groom)}</span>` : ''}</h1>` : '<h1 class="ss-names">You are invited</h1>'}${bridePhoto ? img(bridePhoto, bride ? `Portrait of ${bride}` : 'Bride portrait', 'ss-illustration__image') : ''}${groomPhoto ? img(groomPhoto, groom ? `Portrait of ${groom}` : 'Groom portrait', 'ss-illustration__image') : ''}${display([d.brideMother,d.brideFather].filter(Boolean).join(' & '),'ss-family-line')}${display(text(d.brideFamily, 300),'ss-family-line')}${display([d.groomMother,d.groomFather].filter(Boolean).join(' & '),'ss-family-line')}${display(text(d.groomFamily, 300),'ss-family-line')}${dateValue ? `<p class="ss-date">${e(dateValue)}</p>` : ''}${wedding ? `<p class="ss-date">Wedding time / Muhurat: ${e(wedding.timeLabel)} IST</p>` : ''}${venuePhoto ? img(venuePhoto, 'Wedding venue', 'ss-illustration__image') : ''}${display(text(d.venue, 200),'ss-venue')}${display(text(d.venueAddress, 300),'ss-venue')}${mainDirections ? `<a class="ss-button ss-button--red" href="${e(mainDirections)}" target="_blank" rel="noopener noreferrer">Get directions ↗</a>` : ''}</section>
  ${validTarget ? `<section class="ss-section ss-countdown" aria-labelledby="ss-count-title"><p class="ss-kicker">A date to remember</p><h2 id="ss-count-title">Counting down to the day</h2><div class="ss-scratch" data-scratch><div class="ss-count-inner"><p class="ss-count-caption">The celebration begins in</p><div class="ss-count" data-countdown="${e(validTarget)}" role="timer" aria-label="Countdown to the celebration"><span><b data-unit="days">—</b><small>days</small></span><span><b data-unit="hours">—</b><small>hours</small></span><span><b data-unit="minutes">—</b><small>minutes</small></span><span><b data-unit="seconds">—</b><small>seconds</small></span></div><p class="ss-count-ended" data-count-ended hidden>The celebration is here</p></div><canvas data-scratch-canvas aria-hidden="true" hidden></canvas></div><button class="ss-reveal" type="button" data-reveal hidden>Reveal countdown</button><p class="ss-scratch-help" data-scratch-help hidden>Scratch the gold to reveal, or use the button.</p></section>` : ''}
  ${events ? `<section class="ss-section ss-celebrations" aria-labelledby="ss-events-heading"><p class="ss-kicker">Come celebrate with us</p><h2 id="ss-events-heading">The festivities</h2><div class="ss-events">${events}</div></section>` : ''}
  ${photos.length ? `<section class="ss-section ss-gallery" aria-labelledby="ss-gallery-heading"><p class="ss-kicker">Moments to cherish</p><h2 id="ss-gallery-heading">Our gallery</h2><div class="ss-gallery__viewport" data-gallery>${photos.map((p,i)=>`<figure class="ss-slide" data-slide><img src="${e(p.src)}" alt="${e(p.alt || `Gallery photograph ${i+1}`)}" loading="lazy" decoding="async">${p.alt ? `<figcaption>${e(p.alt)}</figcaption>` : ''}</figure>`).join('')}</div>${photos.length>1 ? `<nav class="ss-gallery__controls" aria-label="Gallery navigation" data-gallery-controls hidden><button type="button" data-prev aria-label="Previous photo">←</button><span aria-live="polite" data-gallery-count></span><button type="button" data-next aria-label="Next photo">→</button></nav>` : ''}</section>` : ''}
  ${whatsapp ? `<section class="ss-section ss-rsvp" aria-labelledby="ss-rsvp-heading"><p class="ss-kicker">Kindly respond</p><h2 id="ss-rsvp-heading">RSVP</h2><p>Let us know if you can join us. Your response will open in WhatsApp for you to review and send.</p><form data-rsvp action="https://wa.me/${e(whatsapp)}" method="get" target="_blank"><label>Your name<input name="guestName" type="text" maxlength="100" autocomplete="name" required></label><label>Will you attend?<select name="attendance" required><option value="">Please select</option><option value="Joyfully attending">Joyfully attending</option><option value="Unable to attend">Unable to attend</option></select></label><label>Number of guests<input name="guests" type="number" min="1" max="30" inputmode="numeric" value="1"></label><label>Message <span>(optional)</span><textarea name="message" maxlength="500" rows="3"></textarea></label><input type="hidden" name="text" value=""><button class="ss-button ss-button--red" type="submit" data-rsvp-submit hidden>Continue to WhatsApp ↗</button><noscript><p>Please enable JavaScript to prepare your WhatsApp response.</p></noscript></form></section>` : `<section class="ss-section ss-rsvp"><p>Online RSVP is unavailable: no valid international contact number was provided.</p></section>`}
  ${(contact.email || contact.phone) ? `<section class="ss-section ss-contact"><p class="ss-kicker">Contact</p>${display(text(d.rsvpName, 80),'ss-family-line')}${contact.phone ? `<p><a href="${e(contact.phone)}">${e(d.rsvpPhone)}</a></p>` : ''}${contact.email ? `<p><a href="${e(contact.email)}">${e(d.rsvpEmail)}</a></p>` : ''}</section>` : ''}
  <section class="ss-section ss-closing"><div class="ss-closing__flower" aria-hidden="true">✺</div><p>With love and blessings from our families</p>${display([d.brideMother,d.brideFather,d.groomMother,d.groomFather].filter(Boolean).join(' · '),'ss-family-line')}<div class="ss-end-mark" aria-hidden="true">❧</div></section></div></main>
  ${music ? `<div class="ss-music"><audio data-audio src="${e(music)}" loop preload="none"></audio><button type="button" data-audio-toggle aria-pressed="false" aria-label="Play music">♪</button><span data-audio-status role="status" class="ss-sr-only"></span></div>` : ''}<noscript><style>.ss-cover__hint,.ss-seal{display:none}.ss-cover{min-height:40vh}.ss-petals{display:none}</style></noscript></body></html>`;
}
module.exports = { render };
