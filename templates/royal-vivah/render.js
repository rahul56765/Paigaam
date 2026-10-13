'use strict';

const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { escape, head, previewBadge } = require('../../lib/bfday/page');

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
function ordinal(day) {
  const mod100 = day % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[day % 10] || 'TH');
  return `${day}${suffix}`;
}
function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return { save: escape(iso || ''), full: escape(iso || ''), final: escape(iso || '') };
  const day = Number(m[3]), month = Number(m[2]) - 1, year = m[1];
  if (month < 0 || month > 11) return { save: escape(iso), full: escape(iso), final: escape(iso) };
  return { save: `${ordinal(day)} ${MONTHS[month].slice(0, 3)} ${year}`, full: `${ordinal(day)} ${MONTHS[month]} ${year}`, final: `${day} ${MONTHS[month]} ${year}` };
}
function textBlock(value) { return escape(value).replace(/\n/g, '<br>'); }
function mapLink(href, label, className = '') {
  const text = `<span>${escape(label)}</span>`;
  return href ? `<a class="rv-map ${className}" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${text}</a>` : `<span class="${className}">${text}</span>`;
}
function eventMarkup(event, i) {
  const slot = `rv-event--${i + 1}`;
  return `<section class="rv-event ${slot}" aria-label="${escape(event.name)}">
    <h3 class="rv-event__title rv-fit">${escape(event.name)}</h3>
    <p class="rv-event__date rv-fit">${escape(event.date)}${event.time ? ` <span class="rv-event__sep">|</span> ${escape(event.time)}` : ''}</p>
    <p class="rv-event__venue rv-fit">${escape(event.venue)}</p>
    ${event.address ? `<p class="rv-event__address rv-fit">${escape(event.address)}</p>` : ''}
  </section>`;
}

function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const dates = dateParts(d.weddingDate);
  const couple = `${d.brideName} ${d.coupleJoiner || '&'} ${d.groomName}`;
  const title = opts.title || `${couple} · Royal Vivah`;
  const description = `${couple} invite you to celebrate on ${dates.full} in ${d.weddingCity || d.venueAddress}. Open the invitation for family, events and directions.`;
  const eventRows = (d.events || []).slice(0, 4).map(eventMarkup).join('\n');
  const venue = [d.venueName, d.venueAddress].filter(Boolean).join(', ');
  const venueMarkup = mapLink(d.mapLink, d.venueName || d.venueAddress || 'Open venue directions', 'rv-final__venue');
  const petals = Array.from({ length: 18 }, (_, i) => `<i class="rv-petal rv-petal--${i + 1}" aria-hidden="true"></i>`).join('');

  return `<!doctype html>
<html lang="en" class="rv-html">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#f7e8dc', image: config.ogImage })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,600;6..96,700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Great+Vibes&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/royal-vivah/royal.css?v=2">
<script src="/royal-vivah/royal.js?v=2" defer></script>
</head>
<body class="rv-body" data-preview="${!!opts.isPreview}">
${previewBadge(opts)}
<div class="rv-petals" aria-hidden="true">${petals}</div>
<main class="rv-story" id="rvStory" aria-label="${escape(couple)} wedding invitation">
  <section class="rv-scene rv-envelope" id="envelope" aria-label="Sealed wedding invitation" style="--rv-bg-image:url('/royal-vivah/envelope.webp')">
   <div class="rv-canvas rv-canvas--envelope">
    <img class="rv-envelope__photo" src="/royal-vivah/envelope.webp" alt="A dusty rose envelope with an ornate gold heart seal" fetchpriority="high">
    <img class="rv-envelope__open-still" src="/royal-vivah/envelope-open.webp" alt="" aria-hidden="true">
    <video class="rv-envelope__open-video" src="/royal-vivah/envelope-open.mp4" poster="/royal-vivah/envelope.webp" playsinline preload="none" aria-hidden="true"></video>
    <span class="rv-envelope__instruction" id="rvOpenHint">Tap to open</span>
    <button class="rv-envelope__seal" type="button" aria-label="Open the sealed invitation" aria-describedby="rvOpenHint"><span class="rv-visually-hidden">Open the invitation</span></button>
    <span class="rv-envelope__scroll" aria-hidden="true">↓</span>
   </div>
  </section>

  <section class="rv-scene rv-save" id="save-date" tabindex="-1" aria-label="Save the Date" style="--rv-bg-image:url('/royal-vivah/save-date.webp')">
   <div class="rv-canvas rv-canvas--save">
    <img class="rv-art" src="/royal-vivah/save-date.webp" alt="The illustrated Save the Date scene" loading="lazy">
    <video class="rv-save__handoff-video" src="/royal-vivah/save-date-handoff.mp4" poster="/royal-vivah/save-date.webp" muted playsinline preload="none" aria-hidden="true"></video>
    <div class="rv-save__names rv-fit" aria-label="${escape(couple)}">${escape(d.brideName)}<small>${escape(d.saveWeds)}</small>${escape(d.groomName)}</div>
    <p class="rv-save__date rv-fit">${dates.save}</p>
    <span class="rv-next-hint" aria-hidden="true">↓</span>
   </div>
  </section>

  <section class="rv-scene rv-families" id="families" aria-label="Family invitation" style="--rv-bg-image:url('/royal-vivah/families.webp')">
   <div class="rv-canvas rv-canvas--families">
    <img class="rv-art" src="/royal-vivah/families.webp" alt="Ornate floral family invitation border and palace illustration" loading="lazy">
    <h2 class="rv-family__heading rv-fit">${escape(d.blessingsHeading)}</h2>
    <p class="rv-family__bride-line rv-fit">${escape(d.brideFamilyLine)}</p>
    <p class="rv-family__request rv-fit">${textBlock(d.familyRequest)}</p>
    <p class="rv-family__bride rv-fit">${escape(d.brideName)}</p>
    <span class="rv-family__with">${escape(d.familyWith)}</span>
    <p class="rv-family__groom rv-fit">${escape(d.groomName)}</p>
    <p class="rv-family__groom-line rv-fit">${escape(d.groomFamilyLine)}</p>
    <p class="rv-family__date rv-fit">${dates.full}</p>
    <p class="rv-family__city rv-fit">${escape(d.weddingCity).toUpperCase()}</p>
    <span class="rv-next-hint" aria-hidden="true">↓</span>
   </div>
  </section>

  <section class="rv-scene rv-events" id="events" aria-label="Wedding festivities" style="--rv-bg-image:url('/royal-vivah/events.webp')">
   <div class="rv-canvas rv-canvas--events">
    <img class="rv-art" src="/royal-vivah/events.webp" alt="Four hand-painted wedding celebration illustrations and ornate borders" loading="lazy">
    <h2 class="rv-events__heading rv-fit">${escape(d.eventsHeading)}</h2>
    <p class="rv-events__couple rv-fit">${escape(couple)}</p>
    <p class="rv-events__date rv-fit">${dates.full}</p>
    ${eventRows}
    <span class="rv-next-hint" aria-hidden="true">↓</span>
   </div>
  </section>

  <section class="rv-scene rv-final" id="invitation" aria-label="Final invitation and venue directions" style="--rv-bg-image:url('/royal-vivah/invitation.webp')">
   <div class="rv-canvas rv-canvas--final">
    <img class="rv-art" src="/royal-vivah/invitation.webp" alt="Floral wedding invitation with feast illustration, preserved from the reference" loading="lazy">
    <h2 class="rv-final__heading rv-fit">${escape(d.invitationHeading)}</h2>
    <p class="rv-final__couple rv-fit"><span>${escape(d.brideName)} ${escape(d.coupleJoiner || '&')}</span><br>${escape(d.groomName)}</p>
    <p class="rv-final__lead rv-fit">${escape(d.invitationLead)}</p>
    <p class="rv-final__message rv-fit">${textBlock(d.invitationMessage)}</p>
    <p class="rv-final__date rv-fit">${dates.final}</p>
    <p class="rv-final__event rv-fit">${escape(d.finalEventTitle)}</p>
    <p class="rv-final__time rv-fit">${escape(d.weddingTime)}</p>
    <div class="rv-final__venue-wrap">${venueMarkup}<p class="rv-final__address rv-fit">${escape(d.venueAddress)}</p></div>
    <p class="rv-final__signoff rv-fit">${escape(d.closingLine)}</p>
    <p class="rv-final__families rv-fit">${escape(d.familySignoff)}</p>
    <span class="rv-next-hint rv-next-hint--end" aria-hidden="true">Invitation complete</span>
   </div>
  </section>
</main>
</body>
</html>`;
}

module.exports = { render, dateParts, eventMarkup };
