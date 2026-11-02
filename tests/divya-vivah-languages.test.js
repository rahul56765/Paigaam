'use strict';
// Portable regression snapshots: approved Marathi copy, schema and asset hashes.
// Run: node --test tests/divya-vivah-languages.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const config = require('../templates/divya-vivah/config');
const schema = require('../templates/divya-vivah/schema');
const renderer = require('../templates/divya-vivah/render');
const locale = require('../templates/divya-vivah/locales');
const { boot } = require('./divya-vivah-runtime.test');
const root = path.resolve(__dirname, '..');
const keyFor = (language, id) => language + id[0].toUpperCase() + id.slice(1);
const dataOf = html => JSON.parse(html.match(/<script\b[^>]*id="dv-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const render = customer_data => renderer.renderDivya({ customer_data });
const APPROVED = {
  "demo": {
    "prayer": "॥ श्री गणेशाय नमः ॥",
    "introduction": "आपणांस कळविण्यात अत्यंत आनंद होत आहे की,\nआमचे चिरंजीव आणि सौ. यांचा शुभविवाह सोहळा\nआयोजित केला आहे.",
    "groomName": "पियुष",
    "brideName": "स्नेहा",
    "joiner": "आणि",
    "weddingHeading": "यांचा शुभविवाह सोहळा",
    "dateLabel": "दिनांक",
    "weekday": "गुरुवार",
    "dayText": "२४",
    "monthYearText": "मे २०२६",
    "timeLabel": "वेळ",
    "timePeriod": "सायंकाळी",
    "timeText": "६.००",
    "timeSuffix": "वाजता",
    "venueLabel": "स्थळ",
    "venueName": "आनंदम लॉन्स",
    "venueAddress": "सातपूर रोड, नाशिक फाटा जवळ,\nनाशिक - ४२२२२२",
    "presenceMessage": "आपली उपस्थिती व शुभाशीर्वाद\nआमच्यासाठी अत्यंत मोलाचे आहेत.",
    "hostsLabel": "निमंत्रक",
    "familyDetails": "देशमुख परिवार",
    "contactText": "मो. ९८२२३ ४५६७८",
    "gateLabel": "शुभविवाहाचे आमंत्रण",
    "tapLabel": "स्पर्श करून उघडा",
    "countdownHeading": "शुभक्षणाची प्रतीक्षा",
    "countdownDescription": "आपल्या उपस्थितीने हा सोहळा अविस्मरणीय होवो.",
    "locationHeading": "विवाहस्थळ",
    "directionsLabel": "दिशा पहा",
    "nextLabel": "शुभक्षण व विवाहस्थळ",
    "backLabel": "आमंत्रण पहा",
    "weddingDayMessage": "आज आहे तो मंगल दिवस!",
    "afterWeddingMessage": "आपल्या शुभाशीर्वादांसाठी धन्यवाद!",
    "daysLabel": "दिवस",
    "hoursLabel": "तास",
    "minutesLabel": "मिनिटे",
    "secondsLabel": "सेकंद",
    "weddingDate": "2026-05-24",
    "weddingTime": "18:00",
    "mapQuery": ""
  },
  "fields": [
    {
      "id": "prayer",
      "type": "text",
      "maxLength": 80
    },
    {
      "id": "introduction",
      "type": "textarea",
      "maxLength": 400
    },
    {
      "id": "groomName",
      "type": "text",
      "maxLength": 26,
      "required": true
    },
    {
      "id": "joiner",
      "type": "text",
      "maxLength": 20
    },
    {
      "id": "brideName",
      "type": "text",
      "maxLength": 26,
      "required": true
    },
    {
      "id": "weddingHeading",
      "type": "text",
      "maxLength": 100
    },
    {
      "id": "dateLabel",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "weekday",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "dayText",
      "type": "text",
      "maxLength": 12
    },
    {
      "id": "monthYearText",
      "type": "text",
      "maxLength": 50
    },
    {
      "id": "timeLabel",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "timePeriod",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "timeText",
      "type": "text",
      "maxLength": 20
    },
    {
      "id": "timeSuffix",
      "type": "text",
      "maxLength": 20
    },
    {
      "id": "venueLabel",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "venueName",
      "type": "text",
      "maxLength": 100
    },
    {
      "id": "venueAddress",
      "type": "textarea",
      "maxLength": 240
    },
    {
      "id": "presenceMessage",
      "type": "textarea",
      "maxLength": 240
    },
    {
      "id": "hostsLabel",
      "type": "text",
      "maxLength": 40
    },
    {
      "id": "familyDetails",
      "type": "textarea",
      "maxLength": 180
    },
    {
      "id": "contactText",
      "type": "text",
      "maxLength": 100
    },
    {
      "id": "gateLabel",
      "type": "text",
      "maxLength": 80
    },
    {
      "id": "tapLabel",
      "type": "text",
      "maxLength": 80
    },
    {
      "id": "countdownHeading",
      "type": "text",
      "maxLength": 100
    },
    {
      "id": "countdownDescription",
      "type": "textarea",
      "maxLength": 240
    },
    {
      "id": "locationHeading",
      "type": "text",
      "maxLength": 80
    },
    {
      "id": "directionsLabel",
      "type": "text",
      "maxLength": 60
    },
    {
      "id": "nextLabel",
      "type": "text",
      "maxLength": 80
    },
    {
      "id": "backLabel",
      "type": "text",
      "maxLength": 80
    },
    {
      "id": "weddingDayMessage",
      "type": "text",
      "maxLength": 120
    },
    {
      "id": "afterWeddingMessage",
      "type": "text",
      "maxLength": 140
    },
    {
      "id": "daysLabel",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "hoursLabel",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "minutesLabel",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "secondsLabel",
      "type": "text",
      "maxLength": 30
    },
    {
      "id": "weddingDate",
      "type": "date",
      "required": true
    },
    {
      "id": "weddingTime",
      "type": "text",
      "maxLength": 5,
      "required": true
    },
    {
      "id": "mapQuery",
      "type": "text",
      "maxLength": 240
    }
  ]
};
const ASSET_HASHES = {
  "public/divya-vivah/invitation.webp": "25643ed9eba2eb25b66e037c8547e93a1e572f7713b96600b728ef1d52327ab9",
  "public/divya-vivah/opening.mp4": "767a3edbcd03f72eccc5bb57b6f8cb13f2f207aa50b006e0a6b533c1d51ee334",
  "public/divya-vivah/opening-poster.jpg": "4b6f3397a299daa46c8985af36eef522be91416a4f75ad34da20afa6cb94e220",
  "public/divya-vivah/invite.css": "c262b952fac3df65878c7d94c5451282a1a87bd3a8e3431a98f37e6419de673c",
  "public/divya-vivah/fonts/TiroDevanagariMarathi-Regular.ttf": "8e1d4edf924c0685f1383d0d37aa7c4662103d2e485e53b535b4528af5acd966",
  "public/divya-vivah/fonts/Amita-Regular.ttf": "551369ea6a8caeaa9d2dc31719564ba2379a445d16e6994bc7adbf9446a2b63d"
};

test('approved Marathi defaults and original schema limits are unchanged; exactly 70 fields are additive', () => {
  const ids = APPROVED.fields.filter(f => !['weddingDate', 'weddingTime', 'mapQuery'].includes(f.id)).map(f => f.id);
  assert.equal(ids.length, 35);
  assert.deepEqual(config.localeCopyFields, ids);
  assert.deepEqual(config.languages, ['mr', 'hi', 'en']);
  assert.equal(config.fields.length, APPROVED.fields.length + 70);
  for (const old of APPROVED.fields) {
    const current = config.fields.find(f => f.id === old.id);
    for (const property of ['type', 'maxLength', 'required']) assert.equal(current[property], old[property], `${old.id}.${property}`);
    assert.equal(current.default, APPROVED.demo[old.id]);
    assert.equal(config.demo[old.id], APPROVED.demo[old.id]);
  }
  const placed = config.steps.flatMap(step => step.fields);
  assert.equal(new Set(placed).size, config.fields.length);
  for (const id of ids) for (const lang of ['hi', 'en']) {
    const field = config.fields.find(f => f.id === keyFor(lang, id));
    const original = config.fields.find(f => f.id === id);
    assert.ok(field, `${lang}.${id} has an editor field`);
    assert.equal(field.type, original.type);
    assert.equal(field.maxLength, original.maxLength);
    assert.equal(field.required, false);
    assert.ok(placed.includes(field.id));
  }
});

test('all 70 independent translations survive strict validation and safe JSON, unknown keys do not', () => {
  const input = { ...APPROVED.demo, unknown: 'ignore', enUnknown: 'ignore' };
  for (const lang of ['hi', 'en']) for (const [i, id] of config.localeCopyFields.entries()) input[keyFor(lang, id)] = `${lang}${String.fromCharCode(65 + i)} custom`;
  const clean = schema.validate(input);
  assert.equal(Object.hasOwn(clean, 'unknown'), false);
  assert.equal(Object.hasOwn(clean, 'enUnknown'), false);
  const state = dataOf(render(clean));
  for (const lang of ['mr', 'hi', 'en']) {
    assert.deepEqual(Object.keys(state.copies[lang]).sort(), [...config.localeCopyFields].sort());
    for (const id of config.localeCopyFields) assert.equal(state.copies[lang][id], lang === 'mr' ? APPROVED.demo[id] : input[keyFor(lang, id)], `${lang}.${id}`);
  }
  for (const language of ['mr', 'hi', 'en']) {
    const h = boot({ language, customer: clean });
    for (const el of h.document.querySelectorAll('[data-copy]')) assert.equal(el.textContent, state.copies[language][el.dataset.copy], `${language}.${el.dataset.copy}`);
    assert.equal(h.$('#dv-count-status').textContent, state.copies[language].afterWeddingMessage);
    const weddingDay = boot({ language, customer: clean, now: '2026-05-24T12:30:00Z' });
    assert.equal(weddingDay.$('#dv-count-status').textContent, state.copies[language].weddingDayMessage);
  }
  for (const lang of ['hi', 'en']) for (const id of config.localeCopyFields) {
    const field = config.fields.find(f => f.id === keyFor(lang, id));
    assert.throws(() => schema.validate({ ...input, [field.id]: 'a'.repeat(field.maxLength + 1) }), { code: 'validation' });
    assert.throws(() => schema.validate({ ...input, [field.id]: { unsafe: true } }), { code: 'validation' });
    assert.throws(() => schema.validate({ ...input, [field.id]: '\u0000' }), { code: 'validation' });
  }
});

test('legacy personalization inherits actual Marathi family details, never another family’s sample names', () => {
  const custom = { ...APPROVED.demo, groomName: 'अभिजीत', brideName: 'मुक्ता', venueName: 'सुमंगल सभागृह', venueAddress: 'पुणे ४११००१', familyDetails: 'जोशी परिवार', contactText: '९९८८७७६६५५' };
  const state = dataOf(render(custom));
  for (const lang of ['hi', 'en']) for (const id of ['groomName', 'brideName', 'venueName', 'venueAddress', 'familyDetails', 'contactText']) {
    assert.equal(state.copies[lang][id], locale.digits(custom[id], lang));
    assert.doesNotMatch(state.copies[lang][id], /Piyush|पीयूष|Sneha|Deshmukh|Anandam/);
  }
});

for (const language of ['mr', 'hi', 'en']) {
  test(`${language}: explicit initial choice precedes any tap/video/reveal; native dialog cannot be escaped`, async () => {
    const h = boot({ language: null });
    const dialog = h.$('#dv-language');
    assert.equal(dialog.tagName, 'DIALOG');
    assert.equal(dialog.getAttribute('aria-labelledby'), 'dv-language-title');
    assert.equal(dialog.getAttribute('aria-describedby'), 'dv-language-description');
    assert.equal(dialog.open, true);
    assert.equal(dialog.showModalCalls, 1);
    assert.equal(h.$('#dv-gate').inert, true);
    assert.equal(h.$('#dv-language-close').hidden, true);
    assert.equal(h.$('[data-language="en"]').textContent, 'English', 'stub preserves renderer text, not invented defaults');
    await h.click('#dv-open');
    assert.equal((await h.key('Escape')).defaultPrevented, true);
    assert.equal((await h.cancelLanguage()).defaultPrevented, true);
    h.advance(30000);
    assert.equal(dialog.open, true);
    assert.equal(h.video.playCalls, 0);
    assert.equal(h.$('#dv-main').inert, true);
    assert.equal(h.$('#dv-map').src, '');
    assert.equal(h.window.scrollCalls.length, 0);
    await h.click(`[data-language="${language}"]`);
    assert.equal(dialog.open, false);
    assert.equal(h.document.documentElement.lang, language);
    assert.equal(h.document.documentElement.getAttribute('lang'), language);
    assert.equal(h.document.body.getAttribute('lang'), language);
    assert.equal(h.$('#dv-gate').inert, false);
    assert.equal(h.document.activeElement, h.$('#dv-open'));
    assert.equal(h.video.playCalls, 0);
    await h.click('#dv-open');
    assert.equal(h.video.playCalls, 1);
  });

  test(`${language}: complete copy, printed date/time/contact/address and countdown digit localization`, () => {
    const h = boot({ language, now: '2030-05-23T10:26:56Z', customer: { weddingDate: '2030-05-24', weddingTime: '18:00' } });
    const state = dataOf(h.html);
    for (const el of h.document.querySelectorAll('[data-copy]')) assert.equal(el.textContent, state.copies[language][el.dataset.copy], el.dataset.copy);
    for (const id of ['weekday', 'timeText', 'contactText', 'venueAddress', 'monthYearText']) assert.ok(h.$(`[data-copy="${id}"]`).textContent);
    const printed = ['dayText', 'monthYearText', 'timeText', 'contactText', 'venueAddress'].map(id => h.$(`[data-copy="${id}"]`).textContent).join(' ');
    assert.doesNotMatch(printed, language === 'en' ? /[०-९]/ : /[0-9]/);
    assert.equal(h.$('[data-copy="weekday"]').textContent, language === 'en' ? 'Thursday' : 'गुरुवार');
    assert.deepEqual(h.units(), language === 'en' ? { days: '01', hours: '02', minutes: '03', seconds: '04' } : { days: '०१', hours: '०२', minutes: '०३', seconds: '०४' });
    h.advance(1000);
    assert.equal(h.units().seconds, language === 'en' ? '03' : '०३');
    const target = h.$('.dv-target');
    assert.equal(target.getAttribute('datetime'), '2030-05-24T18:00:00+05:30');
    assert.doesNotMatch(target.textContent, language === 'en' ? /[०-९]|मे|प्रमाणवेळ/ : /[0-9]/);
    assert.match(target.textContent, language === 'en' ? /May 2030/ : language === 'hi' ? /मई २०३०/ : /मे,? २०३०/);
    const past = boot({ language });
    assert.equal(past.$('#dv-count-status').textContent, state.copies[language].afterWeddingMessage);
    const day = boot({ language, now: '2026-05-24T12:30:00Z' });
    assert.equal(day.$('#dv-count-status').textContent, state.copies[language].weddingDayMessage);
  });
}

test('preview skip waits for a real initial language selection too', async () => {
  const h = boot({ language: null, preview: true, search: '?skip=1' });
  h.advance(1000);
  assert.equal(h.$('#dv-language').open, true);
  assert.equal(h.$('#dv-main').inert, true);
  assert.equal(h.window.scrollCalls.length, 0);
  await h.click('[data-language="en"]');
  h.advance(900);
  assert.equal(h.$('#dv-main').inert, false);
  assert.equal(h.document.documentElement.lang, 'en');
  assert.equal(h.video.playCalls, 0);
});

test('later switches retain video time, reveal state, canonical map pin, target date and scroll position', async () => {
  const query = '19.9975,73.7898';
  const h = boot({ customer: { mapQuery: query, weddingDate: '2030-05-24', weddingTime: '18:00' } });
  await h.click('#dv-open');
  h.video.currentTime = 9.05;
  await h.video.emit('timeupdate'); h.advance(900);
  h.observations[0].intersect(true);
  const before = { time: h.video.currentTime, plays: h.video.playCalls, pauses: h.video.pauseCalls, scrolls: h.window.scrollCalls.length, datetime: h.$('.dv-target').getAttribute('datetime') };
  for (const lang of ['hi', 'en', 'mr', 'en']) {
    await h.click('#dv-language-change');
    assert.equal(h.$('#dv-language').open, true);
    await h.click(`[data-language="${lang}"]`);
    assert.equal(h.video.currentTime, before.time);
    assert.equal(h.video.playCalls, before.plays);
    assert.equal(h.video.pauseCalls, before.pauses);
    assert.equal(h.window.scrollCalls.length, before.scrolls);
    assert.equal(h.$('#dv-main').inert, false);
    assert.equal(h.$('#dv-gate').hidden, true);
    assert.equal(h.$('.dv-target').getAttribute('datetime'), before.datetime);
    for (const link of [h.$('.dv-directions'), h.$('#dv-map-link')]) {
      const url = new URL(link.getAttribute('href'));
      assert.equal(url.searchParams.get('destination'), query);
      assert.equal(url.searchParams.get('hl'), lang);
      assert.equal(url.searchParams.getAll('hl').length, 1);
      assert.equal(url.searchParams.get('api'), '1');
    }
    const map = new URL(h.$('#dv-map').src);
    assert.equal(map.searchParams.get('q'), query);
    assert.equal(map.searchParams.get('hl'), lang);
    assert.equal(map.searchParams.getAll('hl').length, 1);
  }
  await h.click('#dv-language-change');
  assert.equal((await h.key('Escape')).defaultPrevented, true);
  assert.equal(h.$('#dv-language').open, false);
  assert.equal(h.document.activeElement, h.$('#dv-language-change'));
});

test('localized map fallback pin always derives from original Marathi venue, not translated text', async () => {
  const h = boot();
  const expected = `${config.demo.venueName}, ${config.demo.venueAddress.replace(/\n/g, ', ')}`;
  for (const language of ['en', 'hi', 'mr']) {
    await h.click('#dv-language-change'); await h.click(`[data-language="${language}"]`);
    assert.equal(new URL(h.$('#dv-map').dataset.src).searchParams.get('q'), expected);
    assert.equal(new URL(h.$('.dv-directions').getAttribute('href')).searchParams.get('destination'), expected);
    assert.equal(h.$('#dv-map').src, '', 'changing language does not eagerly load a map');
  }
});

test('visible errors, accessibility text, language UI and media-loading states change with locale', async () => {
  const h = boot({ play: () => Promise.reject(new Error('unavailable')) });
  await h.click('#dv-open');
  for (const lang of ['en', 'hi', 'mr']) {
    await h.click('#dv-language-change'); await h.click(`[data-language="${lang}"]`);
    const ui = locale.ui[lang];
    assert.equal(h.$('#dv-video-status').textContent, ui.videoFailed);
    assert.equal(h.$('#dv-language-title').textContent, ui.languageDialogTitle);
    assert.equal(h.$('#dv-language-description').textContent, ui.languageDialogSubtitle);
    assert.equal(h.$('#dv-language-change').getAttribute('title'), ui.changeLanguageLabel);
    assert.equal(h.$('#dv-art').getAttribute('alt'), ui.artAlt);
    assert.equal(h.$('#dv-map-link').textContent, ui.mapsLabel + ' ↗');
    assert.equal(h.$(`[data-language="${lang}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(h.$('#dv-invitation').getAttribute('aria-label'), dataOf(h.html).copies[lang].weddingHeading);
  }
  for (const language of ['mr', 'hi', 'en']) {
    const loading = boot({ language }); await loading.click('#dv-open');
    await loading.video.emit('waiting');
    assert.equal(loading.$('#dv-video-status').textContent, locale.ui[language].videoLoading);
    loading.advance(15000);
    assert.equal(loading.$('#dv-video-status').textContent, locale.ui[language].videoSlow);
  }
});

test('all locale dates and wedding-day boundaries remain India-local across visitor timezones', () => {
  const script = `const {boot}=require(${JSON.stringify(path.join(__dirname, 'divya-vivah-runtime.test.js'))});
    process.stdout.write(JSON.stringify(['mr','hi','en'].map(language => ['2026-05-24T12:29:59Z','2026-05-24T12:30:00Z','2026-05-24T18:29:59Z','2026-05-24T18:30:00Z'].map(now=>{const h=boot({language,now});return {units:h.units(),status:h.$('#dv-count-status').textContent,target:h.$('.dv-target').textContent}}))));`;
  const results = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati'].map(TZ => JSON.parse(execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ, DIVYA_RUNTIME_PROBE: '1' }, encoding: 'utf8' })));
  for (const result of results) assert.deepEqual(result, results[0]);
  for (const [i, language] of ['mr', 'hi', 'en'].entries()) {
    const cases = results[0][i];
    assert.equal(cases[0].units.seconds, language === 'en' ? '01' : '०१');
    assert.equal(cases[0].status, '');
    const copies = dataOf(render(config.demo)).copies[language];
    assert.equal(cases[1].status, copies.weddingDayMessage);
    assert.equal(cases[2].status, copies.weddingDayMessage);
    assert.equal(cases[3].status, copies.afterWeddingMessage);
  }
});

test('long translations stay bounded text in stable artwork markup and cannot inject HTML/script', () => {
  const malicious = '</script><img src=x onerror=alert(1)>&';
  const custom = { ...config.demo };
  for (const lang of ['hi', 'en']) for (const id of config.localeCopyFields) {
    const field = config.fields.find(f => f.id === keyFor(lang, id));
    custom[field.id] = malicious.repeat(Math.ceil(field.maxLength / malicious.length)).slice(0, field.maxLength);
  }
  const clean = schema.validate(custom);
  const html = render(clean);
  assert.doesNotMatch(html, /<img src=x|<script>alert|onerror=alert\(1\)>/);
  const state = dataOf(html);
  assert.equal((html.match(/<dialog\b/g) || []).length, 1);
  assert.equal((html.match(/<video\b/g) || []).length, 1);
  assert.equal((html.match(/<iframe\b/g) || []).length, 1);
  for (const lang of ['hi', 'en']) {
    const h = boot({ language: lang, customer: clean });
    for (const el of h.document.querySelectorAll('[data-copy]')) assert.equal(el.textContent, state.copies[lang][el.dataset.copy]);
    assert.equal(h.$('#dv-art').getAttribute('src'), '/divya-vivah/invitation.webp');
    assert.equal(h.$('#dv-video').getAttribute('poster'), '/divya-vivah/opening-poster.jpg');
    for (const el of h.document.querySelectorAll('[data-fit]')) assert.match(el.style.fontSize, /^\d+(?:\.\d+)?px$/);
  }
});

test('approved artwork, video, poster, original fonts and original CSS bytes remain unchanged', () => {
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  for (const [filename, expected] of Object.entries(ASSET_HASHES)) {
    const bytes = fs.readFileSync(path.join(root, filename));
    // The complete approved 8441-byte stylesheet is an immutable prefix;
    // language and font rules may only be appended after it.
    assert.equal(hash(filename.endsWith('invite.css') ? bytes.subarray(0, 8441) : bytes), expected, filename);
  }
});

test('empty/default invitations use complete language defaults rather than Marathi sample words in English', () => {
 const payload=dataOf(render({}));
 assert.equal(payload.copies.en.groomName,'Piyush');
 assert.equal(payload.copies.en.weekday,'Thursday');
 assert.equal(payload.copies.en.monthYearText,'May 2026');
 assert.equal(payload.copies.en.venueName,'Anandam Lawns');
 assert.equal(payload.copies.hi.timePeriod,'सायंकाल');
});

test('every localized field rejects overlong, wrong-type, control-character and illegal newline copy', () => {
 for(const f of config.fields.filter(field=>/^(hi|en)[A-Z]/.test(field.id))){
  for(const value of ['x'.repeat(f.maxLength+1),{invalid:true},'a\u0007']){
   assert.throws(()=>schema.validate({...config.demo,[f.id]:value},{mode:'draft'}),f.id);
  }
  if(f.type==='text')assert.throws(()=>schema.validate({...config.demo,[f.id]:'a\nb'},{mode:'draft'}),f.id);
 }
});

test('Hindi event time uses localized 24-hour numerals without English am/pm',()=>{
 const h=boot({language:'hi'});
 assert.doesNotMatch(h.$('.dv-target').textContent,/\b(?:am|pm)\b/i);
 assert.match(h.$('.dv-target').textContent,/१८:००/);
});

test('Marathi computed countdown time has no English am/pm either; stored Marathi copy stays unchanged',()=>{
 const h=boot({language:'mr'});
 assert.doesNotMatch(h.$('.dv-target').textContent,/\b(?:am|pm)\b/i);
 assert.equal(config.demo.timeText,'६.००');
 assert.equal(config.demo.timePeriod,'सायंकाळी');
});
