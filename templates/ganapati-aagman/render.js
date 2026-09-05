'use strict';

const translations = require('./translations');
const { logoFull } = require('../../lib/brand');
const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const text = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
function safeImage(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return '';
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; } catch { return ''; }
}
function eventDate(value, locale, fallback) {
  const pending = `<p class="date-text">${escape(fallback)}</p>`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return pending;
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return pending;
  const format = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: locale.startsWith('en') ? 'latn' : 'deva', timeZone: 'UTC' });
  const parts = Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value]));
  return `<time class="date-display" datetime="${escape(value)}" aria-label="${escape(format.format(date))}"><span class="date-weekday" aria-hidden="true">${escape(parts.weekday)}</span><span class="date-day" aria-hidden="true">${escape(parts.day)}</span><span class="date-month" aria-hidden="true">${escape(parts.month)}</span><span class="date-year" aria-hidden="true">${escape(parts.year)}</span></time>`;
}
function eventTime(value, locale, fallback) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return fallback;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: false, numberingSystem: locale.startsWith('en') ? 'latn' : 'deva', timeZone: 'UTC' }).format(new Date(`2026-01-01T${value}:00Z`));
}

function eventZone(value, locale, date) {
  const options = { timeZone: text(value, 'Asia/Kolkata'), timeZoneName: 'long' };
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Date(`${date}T12:00:00Z`) : new Date('2026-01-01T12:00:00Z');
  try { return new Intl.DateTimeFormat(locale, options).formatToParts(Number.isFinite(instant.getTime()) ? instant : new Date('2026-01-01T12:00:00Z')).find(part => part.type === 'timeZoneName').value; }
  catch { return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Kolkata', timeZoneName: 'long' }).formatToParts(new Date('2026-01-01T12:00:00Z')).find(part => part.type === 'timeZoneName').value; }
}

function renderInvitation(paigaam = {}, opts = {}) {
  const data = paigaam.customer_data && typeof paigaam.customer_data === 'object' ? paigaam.customer_data : {};
  const lang = ['en', 'hi', 'mr'].includes(data.language) ? data.language : 'en';
  const t = translations[lang];
  const preview = !!opts.isPreview;
  let origin = '';
  try { const url = new URL(opts.baseUrl); if (['http:', 'https:'].includes(url.protocol)) origin = url.origin; } catch {}
  const canonical = !preview && paigaam.slug ? `${origin}/p/${encodeURIComponent(paigaam.slug)}` : '';
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${t.whatsappMessage}\n${canonical}`)}`;
  const family = text(data.familyName, t.familyDefault);
  const title = `${t.title} · ${family}`;
  const description = `${family} ${t.familySuffix}. ${text(data.customMessage, t.messageDefault)}`;
  const parents = [text(data.fatherName), text(data.motherName)].filter(Boolean).join(` ${t.and} `);
  const photos = (Array.isArray(data.photos) ? data.photos : []).slice(0, 10).map((photo, index) => ({ url: safeImage(photo && photo.url), alt: text(photo && photo.alt, `${t.photoAlt} · ${new Intl.NumberFormat(t.locale, { numberingSystem: lang === 'en' ? 'latn' : 'deva' }).format(index + 1)}`) })).filter(photo => photo.url);
  const scene = (name, eyebrow, cues, locked) => `<section id="${name === 'formation' ? 'beginning' : 'arrival'}" class="film-section${locked ? ' is-locked' : ''}" data-scene="${name}" ${locked ? 'data-locked="true"' : ''} aria-label="${escape(eyebrow)}">
    <div class="film-sticky"><div class="film-frame">
      <img class="film-still" src="/ganapati/media/${name}-start.jpg" data-start="/ganapati/media/${name}-start.jpg" data-end="/ganapati/media/${name}-end.jpg" alt="" ${locked ? 'loading="lazy"' : ''} width="720" height="1280">
      <video class="film-video" data-src="/ganapati/media/${name}.mp4" preload="none" muted playsinline disablepictureinpicture disableremoteplayback tabindex="-1" aria-hidden="true" poster="/ganapati/media/${name}-start.jpg"></video>
      <span class="film-border" aria-hidden="true"></span>
    </div><div class="film-caption"><h2 class="sr-only">${escape(eyebrow)}</h2>${cues.map((cue, index) => `<p class="cue${index === 0 ? ' cue-first' : ''}" data-start="${escape(cue.start)}" data-end="${escape(cue.end)}">${escape(cue.text)}</p>`).join('')}</div>
    <a class="film-skip" href="#invitation">${escape(t.skip)} <span aria-hidden="true">↘</span></a>
    <p class="media-error" hidden>${escape(t.mediaFallback)}</p>
    ${locked ? `<p class="locked-note">${escape(t.journeyLocked)}</p>` : ''}
    </div></section>`;
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f5efdf">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
${preview ? '<meta name="robots" content="noindex, nofollow, noarchive">' : canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''}
<meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:locale" content="${lang === 'en' ? 'en_IN' : lang + '_IN'}"><meta property="og:image" content="${escape(origin)}/ganapati/media/formation-end.jpg"><meta property="og:image:alt" content="${escape(t.welcome)}">${canonical ? `<meta property="og:url" content="${escape(canonical)}">` : ''}
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/brand/favicon-512.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Noto+Serif+Devanagari:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/ganapati/invitation.css"><script src="/ganapati/invitation.js" defer></script></head>
<body class="ganapati lang-${lang}" data-preview="${preview}" data-share-title="${escape(title)}" data-share-copied="${escape(t.copied)}" data-share-failed="${escape(t.shareFailed)}">
<a class="skip-link" href="#invitation">${escape(t.skip)}</a>
${preview ? `<div class="preview-badge">${escape(t.preview)}</div>` : ''}
<main>
<section class="intro" aria-labelledby="intro-title"><div class="intro-art"><img src="/ganapati/media/formation-end.jpg" alt="" width="720" height="1280" fetchpriority="high"><div class="art-wash"></div></div>
<div class="intro-top"><a href="/" class="brand-logo" aria-label="Paigaam">${logoFull(112)}</a><span class="eyebrow">${escape(t.title)}</span></div>
<div class="intro-copy"><p class="eyebrow">${escape(t.invitation)}</p><h1 id="intro-title">${escape(t.welcome)}</h1><p class="intro-subtitle">${escape(t.subtitle)}</p><a href="#beginning" class="button enter-button" id="enter">${escape(t.enter)}<span aria-hidden="true">↓</span></a><p class="scroll-hint">${escape(t.scroll)}</p></div><span class="intro-bottom" aria-hidden="true">✦</span></section>
${scene('formation', t.sceneOneEyebrow, t.formationCues, false)}
<section class="interlude"><span class="ornament" aria-hidden="true">✦</span><p class="eyebrow">${escape(t.pauseEyebrow)}</p><h2>${escape(t.pauseTitle).replace(/\n/g, '<br>')}</h2><div class="stem" aria-hidden="true"></div></section>
<section class="letter-section" id="letter"><div class="letter"><div class="letter-copy"><p class="eyebrow">${escape(t.letterEyebrow)}</p><h2>${escape(t.letterTitle)}</h2><p class="letter-body">${escape(t.letterBody)}</p><p class="letter-signature">${escape(family)}</p></div><button type="button" class="open-button" id="open-invitation" aria-controls="arrival" aria-expanded="false" data-opened="${escape(t.opened)}"><img class="letter-artwork" src="/ganapati/media/journey-start.jpg" alt="${escape(t.letterArtAlt)}" width="720" height="1280" loading="lazy"><span class="button letter-action"><span class="open-label">${escape(t.open)}</span><span aria-hidden="true">↗</span></span></button></div></section>
${scene('journey', t.journeyEyebrow, t.journeyCues, true)}
<section class="invitation-section" id="invitation" tabindex="-1"><div class="invitation-inner"><p class="blessing">${escape(t.blessing)}</p><div class="fine-rule" aria-hidden="true"></div><h2 class="family-name">${escape(family)}</h2><p class="family-suffix">${escape(t.familySuffix)}</p>${parents ? `<p class="family-parents"><span>${escape(t.parentsPrefix)}</span><br>${escape(parents)}</p>` : ''}${text(data.familyMembers) ? `<p class="family-members"><span>${escape(t.familyMembers)}</span><br>${escape(data.familyMembers)}</p>` : ''}<p class="personal-message">${escape(text(data.customMessage, t.messageDefault))}</p>
<div class="event-block"><p class="eyebrow">${escape(t.detailsEyebrow)}</p><h3>${escape(t.detailsTitle)}</h3><div class="event-grid"><div class="event-date"><p class="eyebrow">${escape(t.when)}</p>${eventDate(data.eventDate, t.locale, t.datePending)}<p class="event-time">${escape(eventTime(data.eventTime, t.locale, t.timePending))}</p><p class="time-zone">${escape(eventZone(data.timezone, t.locale, data.eventDate))}</p></div></div>
<div class="detail-actions">${!preview && paigaam.id ? `<a class="text-link" href="/api/ganapati/calendar/${encodeURIComponent(paigaam.id)}">${escape(t.calendar)} <span aria-hidden="true">+</span></a>` : ''}${!preview ? `<a class="text-link whatsapp-link" id="whatsapp-share" href="${escape(whatsappUrl)}" data-message="${escape(t.whatsappMessage)}" target="_blank" rel="noopener noreferrer">${escape(t.whatsapp)} <span aria-hidden="true">↗</span></a><button type="button" class="text-link" id="share">${escape(t.share)} <span aria-hidden="true">↗</span></button>` : ''}</div>${preview ? `<p class="preview-note">${escape(t.previewNote)}</p>` : ''}<p class="share-status" id="share-status" role="status"></p></div></div></section>
${photos.length ? `<section class="gallery" aria-labelledby="gallery-title"><div class="gallery-heading"><p class="eyebrow">${escape(t.galleryEyebrow)}</p><h2 id="gallery-title">${escape(t.galleryTitle)}</h2></div><div class="gallery-grid">${photos.map((photo, i) => `<figure><img src="${escape(photo.url)}" alt="${escape(photo.alt)}" loading="lazy" decoding="async" width="720" height="900"><figcaption>${new Intl.NumberFormat(t.locale, { minimumIntegerDigits: 2, numberingSystem: lang === 'en' ? 'latn' : 'deva' }).format(i + 1)}</figcaption></figure>`).join('')}</div></section>` : ''}
<section class="venue-section" id="venue" aria-labelledby="venue-title"><div class="venue-inner"><p class="eyebrow">${escape(t.venueEyebrow)}</p><h2 id="venue-title">${escape(t.venueTitle)}</h2><div class="fine-rule" aria-hidden="true"></div><p class="venue-name">${escape(text(data.venueName, t.venueDefault))}</p><p class="address">${escape(text(data.address, t.addressPending))}</p>${text(data.address) ? `<a class="text-link" href="https://www.google.com/maps/search/?api=1&amp;query=${escape(encodeURIComponent(text(data.address)))}" target="_blank" rel="noopener noreferrer">${escape(t.directions)} <span aria-hidden="true">↗</span></a>` : ''}</div></section>
<section class="closing"><span class="ornament" aria-hidden="true">✦</span><h2>${escape(t.closing)}</h2><p>${escape(t.closingSmall)}</p><p class="final-blessing">${escape(t.finalBlessing)}</p><p class="closing-family">${escape(family)}</p></section>
</main><footer><span>${escape(t.madeWith)}</span> <a href="/" class="brand-logo" aria-label="Paigaam">${logoFull(96)}</a></footer>
<audio id="invitation-music" data-src="/ganapati/media/music.mp3" preload="none" loop></audio><button class="music-toggle" id="music-toggle" type="button" aria-label="${escape(t.musicOff)}" title="${escape(t.musicOff)}" aria-pressed="false" data-on="${escape(t.musicOn)}" data-off="${escape(t.musicOff)}" data-failed="${escape(t.musicFailed)}" data-loading="${escape(t.musicLoading)}"><span class="music-icon" aria-hidden="true">♫</span><span class="music-label">${escape(t.musicOff)}</span></button><p class="music-status" id="music-status" role="status" aria-live="polite"></p>
<noscript><style>.film-video,.music-toggle,#share{display:none!important}.open-button{pointer-events:none}.letter-action{display:none!important}.film-caption{height:auto!important}.cue{position:static!important;opacity:1!important;margin:14px auto!important}.film-section{height:auto!important;min-height:0!important}.film-sticky{position:relative!important}.locked-note{display:none!important}</style></noscript>
</body></html>`;
}

module.exports = { renderInvitation };
