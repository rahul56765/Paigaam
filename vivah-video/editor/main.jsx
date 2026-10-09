import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { Invite } from '../src/Invite.jsx';
import { normalize, validate, LIMITS } from '../src/lib/schema.js';
import { buildTimeline, FPS } from '../src/lib/timeline.js';
import { PRESETS } from '../src/lib/themes.js';
import { LANGUAGES } from '../src/lib/i18n.js';
import './styles.js';

const root = document.getElementById('vv-root');
const ASSET_BASE = root.dataset.assetBase || '/vivah-video/assets';

const api = async (url, opts = {}) => {
  const r = await fetch(url, { credentials: 'same-origin', ...opts, headers: { ...(opts.body && !(opts.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const setIn = (obj, path, value) => {
  const out = clone(obj);
  let o = out;
  for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
  o[path[path.length - 1]] = value;
  return out;
};
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const ERR = {
  rate_limited: 'Too many requests right now — please try again a little later.',
  unsupported_file: 'That file type is not supported.',
  too_large: 'That file is too large.',
  too_many_files: 'Upload limit reached for this invitation.',
};
const friendly = (e) => ERR[e.message] || e.message || 'Something went wrong.';

/* ---------- small form atoms ---------- */
const Field = ({ label, hint, children }) => (
  <label className="f"><span className="fl">{label}</span>{children}{hint ? <span className="fh">{hint}</span> : null}</label>
);
const Text = ({ value, onChange, max, placeholder }) => <input value={value || ''} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
const Area = ({ value, onChange, max, rows = 3, placeholder }) => <textarea value={value || ''} maxLength={max} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
);
const Section = ({ title, children, open }) => (
  <details className="sec" open={open}><summary>{title}</summary><div className="secb">{children}</div></details>
);
const Row = ({ children }) => <div className="row">{children}</div>;
const IconBtn = ({ onClick, title, children, disabled }) => <button type="button" className="ib" title={title} aria-label={title} onClick={onClick} disabled={disabled}>{children}</button>;

/* ---------- uploads ---------- */
async function upload(inviteId, kind, file) {
  const r = await fetch(`/api/vivah-video/invites/${inviteId}/media?kind=${kind}`, { method: 'POST', body: file, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j.url;
}
async function pollJob(id, onTick) {
  for (;;) {
    const j = await api(`/api/vivah-video/jobs/${id}`);
    onTick && onTick(j);
    if (j.status === 'done' || j.status === 'failed') return j;
    await new Promise((r) => setTimeout(r, 2500));
  }
}

/* ---------- story scene card (fixed template scenes) ---------- */
function StoryCard({ story, index, events, library, onChange, onRemove, onMove, count }) {
  const set = (k, v) => onChange({ ...story, [k]: v });
  const lib = library[story.scene];
  return (
    <div className="card">
      <div className="cardh"><b>Scene {index + 1}{lib ? ` · ${lib.label}` : ''}</b>
        <span><IconBtn title="Move up" onClick={() => onMove(-1)} disabled={index === 0}>↑</IconBtn><IconBtn title="Move down" onClick={() => onMove(1)} disabled={index === count - 1}>↓</IconBtn><IconBtn title="Remove" onClick={onRemove}>✕</IconBtn></span>
      </div>
      <div className="media">
        {lib ? <div className="thumbs"><figure><video src={`${ASSET_BASE}/${lib.src}`} poster={`${ASSET_BASE}/${lib.poster}`} muted loop autoPlay playsInline preload="none" /></figure></div> : null}
        <div style={{ flex: 1, minWidth: 220 }}>
          <Field label="Scene"><Select value={story.scene} onChange={(v) => set('scene', v)} options={Object.entries(library).map(([k, l]) => [k, l.label])} /></Field>
          <Field label="Plays after"><Select value={story.after} onChange={(v) => set('after', v)} options={[['main', 'Main card (before events)'], ...events.map((e) => [e.id, e.title || 'Event'])]} /></Field>
          <Field label={`On-screen time: ${Number(story.holdSec).toFixed(1)}s`}><input type="range" min="2.5" max="8" step="0.1" value={story.holdSec} onChange={(e) => set('holdSec', Number(e.target.value))} /></Field>
        </div>
      </div>
    </div>
  );
}

/* ---------- event card ---------- */
function EventCard({ ev, index, count, onChange, onRemove, onMove }) {
  const set = (k, v) => onChange({ ...ev, [k]: v });
  const changePreset = (preset) => {
    const pr = PRESETS[preset];
    onChange({ ...ev, preset, theme: pr.theme, title: pr.title, tagline: pr.tagline });
  };
  return (
    <div className="card">
      <div className="cardh"><b>{ev.title || 'Event'}</b>
        <span><IconBtn title="Move up" onClick={() => onMove(-1)} disabled={index === 0}>↑</IconBtn><IconBtn title="Move down" onClick={() => onMove(1)} disabled={index === count - 1}>↓</IconBtn><IconBtn title="Remove event" onClick={onRemove}>✕</IconBtn></span>
      </div>
      <Field label="Preset"><Select value={ev.preset} onChange={changePreset} options={Object.keys(PRESETS).map((k) => [k, k === 'custom' ? 'Custom event' : PRESETS[k].title])} /></Field>
      <Row>
        <Field label="Title" hint="Combined titles work: “Haldi & Mehendi”."><Text value={ev.title} max={LIMITS.title} onChange={(v) => set('title', v)} /></Field>
        <Field label="Date"><input type="date" value={ev.date} onChange={(e) => set('date', e.target.value)} /></Field>
      </Row>
      <Field label="Tagline"><Text value={ev.tagline} max={LIMITS.tagline} onChange={(v) => set('tagline', v)} /></Field>
      <div className="sub">
        <span className="fl">Timings</span>
        {ev.timings.map((t, i) => (
          <div className="row tight" key={i}>
            <input placeholder="Label (optional)" value={t.label} maxLength={LIMITS.timing} onChange={(e) => set('timings', ev.timings.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input placeholder="Time, e.g. 7:00 PM" value={t.time} maxLength={LIMITS.timing} onChange={(e) => set('timings', ev.timings.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
            <IconBtn title="Remove timing" onClick={() => set('timings', ev.timings.filter((_, j) => j !== i))}>✕</IconBtn>
          </div>
        ))}
        {ev.timings.length < LIMITS.timings ? <button type="button" className="link" onClick={() => set('timings', [...ev.timings, { label: '', time: '' }])}>+ Add timing</button> : null}
      </div>
      <Row>
        <Field label="Venue"><Text value={ev.venue} max={LIMITS.venue} onChange={(v) => set('venue', v)} /></Field>
        <Field label="Dress code"><Text value={ev.dressCode} max={LIMITS.venue} onChange={(v) => set('dressCode', v)} /></Field>
      </Row>
      <Field label="Address"><Text value={ev.address} max={LIMITS.address} onChange={(v) => set('address', v)} /></Field>
      <Field label={`On-screen time: ${ev.holdSec.toFixed(1)}s`}><input type="range" min="2.5" max="15" step="0.1" value={ev.holdSec} onChange={(e) => set('holdSec', Number(e.target.value))} /></Field>
    </div>
  );
}

/* ---------- app ---------- */
function App() {
  const [data, setData] = useState(null);
  const [inviteId, setInviteId] = useState(null);
  const [saveState, setSaveState] = useState('');
  const [renders, setRenders] = useState({});
  const [toast, setToast] = useState('');
  const [library, setLibrary] = useState([]);
  const [stories, setStories] = useState({});
  const player = useRef(null);
  const creating = useRef(null);

  // boot: existing invite (owner cookie) or the reference sample
  useEffect(() => {
    (async () => {
      const q = new URLSearchParams(location.search).get('invite') || localStorage.getItem('vv_invite');
      const cfg = await api('/api/vivah-video/config');
      setLibrary(cfg.music || []);
      setStories(cfg.stories || {});
      if (q) {
        try {
          const inv = await api(`/api/vivah-video/invites/${q}`);
          setInviteId(inv.id); setData(inv.data); refreshJobs(inv.jobs);
          return;
        } catch { localStorage.removeItem('vv_invite'); }
      }
      setData(cfg.sample);
    })().catch((e) => setToast(friendly(e)));
  }, []);

  const refreshJobs = (jobs) => {
    const r = {};
    for (const j of jobs || []) if (j.kind === 'render' && !r[j.params.format]) r[j.params.format] = j;
    setRenders(r);
  };

  const ensureInvite = useCallback(async () => {
    if (inviteId) return inviteId;
    if (!creating.current) {
      creating.current = api('/api/vivah-video/invites', { method: 'POST', body: JSON.stringify({ data }) }).then(({ id }) => {
        setInviteId(id); localStorage.setItem('vv_invite', id);
        history.replaceState(null, '', `?invite=${id}`);
        return id;
      }).finally(() => { creating.current = null; });
    }
    return creating.current;
  }, [inviteId, data]);

  // autosave (debounced) once the invitation exists
  useEffect(() => {
    if (!inviteId || !data) return;
    setSaveState('Saving…');
    const t = setTimeout(() => {
      api(`/api/vivah-video/invites/${inviteId}`, { method: 'PUT', body: JSON.stringify({ data }) })
        .then(() => setSaveState('Saved')).catch((e) => setSaveState(friendly(e)));
    }, 900);
    return () => clearTimeout(t);
  }, [data, inviteId]);

  const norm = useMemo(() => (data ? normalize(data) : null), [data]);
  const tl = useMemo(() => (norm ? buildTimeline(norm, FPS) : null), [norm]);
  const errors = useMemo(() => (data ? validate(data) : []), [data]);
  const inputProps = useMemo(() => ({ data: norm, assetBase: ASSET_BASE }), [norm]);

  if (!data || !norm) return <div className="loading">Loading the editor…</div>;
  const set = (path, value) => setData((d) => setIn(d, path, value));
  const order = data.meta.order;

  const moveIn = (key, i, dir) => setData((d) => {
    const arr = clone(d[key]); const j = i + dir;
    if (j < 0 || j >= arr.length) return d;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...d, [key]: arr };
  });

  const render = async (format) => {
    try {
      const id = await ensureInvite();
      await api(`/api/vivah-video/invites/${id}`, { method: 'PUT', body: JSON.stringify({ data }) });
      const { jobId } = await api(`/api/vivah-video/invites/${id}/render`, { method: 'POST', body: JSON.stringify({ format }) });
      setRenders((r) => ({ ...r, [format]: { status: 'queued', progress: 0 } }));
      const done = await pollJob(jobId, (j) => setRenders((r) => ({ ...r, [format]: j })));
      if (done.status === 'failed') setToast(`Render failed: ${done.error}`);
    } catch (e) { setToast(friendly(e)); }
  };

  const scenes = tl.segments.filter((s) => s.kind !== 'end');
  const label = (s) => s.kind === 'event' ? s.event.title : s.kind === 'story' ? `Scene: ${(stories[s.story.scene] || {}).label || 'story'}` : { opener: 'Opening', main: 'Main card', closing: 'Sharing the Joy' }[s.kind];
  const totalSec = (tl.durationInFrames / FPS).toFixed(1);

  return (
    <div className="wv">
      <div className="form">
        <header className="top">
          <h1>Vivah · animated wedding film</h1>
          <p>Personalise the invitation and event details. The original scenes, logo reveal and motion are made once for this template; your logo always shares the same frame as the initials fallback.</p>
          {errors.length ? <ul className="errs">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        </header>

        <Section title="Couple" open>
          <Row>
            <Field label="Bride's name"><Text value={data.couple.bride} max={LIMITS.name} onChange={(v) => set(['couple', 'bride'], v)} /></Field>
            <Field label="Groom's name"><Text value={data.couple.groom} max={LIMITS.name} onChange={(v) => set(['couple', 'groom'], v)} /></Field>
          </Row>
          <Row>
            <Field label="Bride monogram override (optional)" hint="Leave blank to use the bride’s first initial."><Text value={data.couple.brideInitial} max={3} onChange={(v) => set(['couple', 'brideInitial'], v)} /></Field>
            <Field label="Groom monogram override (optional)" hint="Leave blank to use the groom’s first initial."><Text value={data.couple.groomInitial} max={3} onChange={(v) => set(['couple', 'groomInitial'], v)} /></Field>
          </Row>
          <Field label="Name order">
            <div className="seg">
              {[['bride_first', 'Bride & Groom'], ['groom_first', 'Groom & Bride']].map(([v, l]) => (
                <button type="button" key={v} className={order === v ? 'on' : ''} onClick={() => setData((d) => ({ ...d, meta: { ...d.meta, order: v }, hosts: { ...d.hosts, relationWord: v === 'bride_first' ? (d.hosts.relationWord === 'beloved son' ? 'beloved daughter' : d.hosts.relationWord) : (d.hosts.relationWord === 'beloved daughter' ? 'beloved son' : d.hosts.relationWord) } }))}>{l}</button>
              ))}
            </div>
          </Field>
          <Field label="Language / script" hint="Type names and lines in your script; template words switch automatically."><Select value={data.meta.lang} onChange={(v) => set(['meta', 'lang'], v)} options={Object.entries(LANGUAGES)} /></Field>
        </Section>

        <Section title="Logo scene & colourway" open>
          <Field label="Colourway"><Select value={data.meta.palette} onChange={(v) => set(['meta', 'palette'], v)} options={[["soft", "Ivory · dusty rose · sage · gold"], ["maroon_gold", "Deep maroon · antique gold"]]} /></Field>
          <Field label="Upload your logo (transparent PNG)" hint="The logo and monogram share the same fixed 470 × 470 px frame and reveal, so the animation stays identical.">
            <input type="file" accept="image/png,.png" onChange={async (e) => { const f = e.target.files[0]; if (!f) return; try { const id = await ensureInvite(); const url = await upload(id, 'logo', f); set(['meta', 'logoUpload'], url); } catch (er) { setToast(friendly(er)); } }} />
            {data.meta.logoUpload ? <><img src={data.meta.logoUpload} alt="Uploaded transparent logo preview" style={{ display: 'block', width: 110, height: 110, objectFit: 'contain', marginTop: 8, background: '#fffaf3', border: '1px solid #ead9c2', borderRadius: 10 }} /><button type="button" className="link" onClick={() => set(['meta', 'logoUpload'], '')}>Use initials instead</button></> : <span className="fh">No logo uploaded: initials from the couple’s names appear in the same frame.</span>}
          </Field>
        </Section>

        <Section title="Ganesha opener">
          <Field label="Cover date line"><Text value={data.opener.coverLine} max={LIMITS.line} onChange={(v) => set(['opener', 'coverLine'], v)} /></Field>
          <Field label="Cover venue line"><Text value={data.opener.coverVenue} max={LIMITS.line} onChange={(v) => set(['opener', 'coverVenue'], v)} /></Field>
        </Section>

        <Section title="Blessings & hosts">
          <Field label="Blessing icons">
            <div className="checks">{['ganesha', 'kalash'].map((ic) => (
              <label key={ic}><input type="checkbox" checked={data.blessing.icons.includes(ic)} onChange={(e) => set(['blessing', 'icons'], e.target.checked ? [...data.blessing.icons, ic] : data.blessing.icons.filter((x) => x !== ic))} /> {ic === 'ganesha' ? 'Ganesha' : 'Kalash'}</label>
            ))}</div>
          </Field>
          <Row>
            <Field label="Invocation 1"><Text value={data.blessing.invocations[0]} max={60} onChange={(v) => set(['blessing', 'invocations'], [v, data.blessing.invocations[1] || ''])} /></Field>
            <Field label="Invocation 2"><Text value={data.blessing.invocations[1]} max={60} onChange={(v) => set(['blessing', 'invocations'], [data.blessing.invocations[0] || '', v])} /></Field>
          </Row>
          <Field label="Blessing of elders"><Area value={data.blessing.text} max={LIMITS.block} onChange={(v) => set(['blessing', 'text'], v)} /></Field>
          <Field label="Hosts' request line"><Area value={data.hosts.request} max={LIMITS.block} rows={2} onChange={(v) => set(['hosts', 'request'], v)} /></Field>
          <Field label="Relation word" hint="e.g. “beloved daughter” / “beloved son”"><Text value={data.hosts.relationWord} max={LIMITS.line} onChange={(v) => set(['hosts', 'relationWord'], v)} /></Field>
        </Section>

        <Section title="Families">
          {[['brideFamily', "Bride's family"], ['groomFamily', "Groom's family"]].map(([k, t]) => (
            <div className="card" key={k}><div className="cardh"><b>{t}</b></div>
              <Field label="Parents' names" hint={k === (order === 'bride_first' ? 'brideFamily' : 'groomFamily') ? 'Shown as the hosts on the main card.' : ''}><Text value={data[k].parents} max={LIMITS.line} onChange={(v) => set([k, 'parents'], v)} /></Field>
              <Field label="Relation line" hint={k === (order === 'bride_first' ? 'groomFamily' : 'brideFamily') ? 'Shown under the second name, e.g. “Son of …”.' : ''}><Text value={data[k].relation} max={LIMITS.line} onChange={(v) => set([k, 'relation'], v)} /></Field>
              <Field label="Address (optional)"><Area value={data[k].address} max={LIMITS.address} rows={2} onChange={(v) => set([k, 'address'], v)} /></Field>
            </div>
          ))}
          <Row>
            <Field label="Main card date line"><Text value={data.mainCard.dateLine} max={LIMITS.line} onChange={(v) => set(['mainCard', 'dateLine'], v)} /></Field>
            <Field label="Main card venue line"><Text value={data.mainCard.venueLine} max={LIMITS.line} onChange={(v) => set(['mainCard', 'venueLine'], v)} /></Field>
          </Row>
        </Section>

        <Section title={`Events (${data.events.length})`} open>
          {data.events.map((ev, i) => (
            <EventCard key={ev.id} ev={ev} index={i} count={data.events.length}
              onChange={(n) => set(['events', i], n)} onMove={(d) => moveIn('events', i, d)}
              onRemove={() => setData((d) => ({ ...d, events: d.events.filter((_, j) => j !== i), stories: d.stories.map((s) => (s.after === ev.id ? { ...s, after: 'main' } : s)) }))} />
          ))}
          {data.events.length < LIMITS.events ? (
            <div className="add">
              <span>Add event:</span>
              {Object.keys(PRESETS).map((k) => (
                <button type="button" className="chip" key={k} onClick={() => setData((d) => ({ ...d, events: [...d.events, { id: uid('e'), preset: k, theme: PRESETS[k].theme, propSet: '', title: PRESETS[k].title, tagline: PRESETS[k].tagline, date: '', timings: [{ label: '', time: '' }], venue: '', address: '', dressCode: '', holdSec: 6 }] }))}>{k === 'custom' ? 'Custom' : PRESETS[k].title}</button>
              ))}
            </div>
          ) : null}
        </Section>

        <Section title={`Story scenes (${data.stories.length})`} open>
          <p className="note">Hand-painted story scenes that come with this template. Pick the scenes you like, place them between events and set how long each plays.</p>
          {data.stories.map((s, i) => (
            <StoryCard key={s.id} story={s} index={i} count={data.stories.length} events={data.events} library={stories}
              onChange={(n) => set(['stories', i], n)} onMove={(d) => moveIn('stories', i, d)}
              onRemove={() => set(['stories'], data.stories.filter((_, j) => j !== i))} />
          ))}
          {data.stories.length < LIMITS.stories && Object.keys(stories).length ? (
            <div className="add"><span>Add scene:</span>
              {Object.entries(stories).map(([k, l]) => <button type="button" className="chip" key={k} onClick={() => set(['stories'], [...data.stories, { id: uid('s'), scene: k, after: data.events[0] ? data.events[0].id : 'main', holdSec: 5 }])}>{l.label}</button>)}
            </div>
          ) : null}
        </Section>

        <Section title="Sharing the Joy (closing card)">
          <Field label="Title"><Text value={data.closing.title} max={LIMITS.title} onChange={(v) => set(['closing', 'title'], v)} /></Field>
          <Field label="Blessing"><Area value={data.closing.blessing} max={LIMITS.block} rows={2} onChange={(v) => set(['closing', 'blessing'], v)} /></Field>
          <Field label="Looking forward to celebrating"><Area value={data.closing.celebrating} max={LIMITS.block} rows={2} onChange={(v) => set(['closing', 'celebrating'], v)} /></Field>
          <div className="sub"><span className="fl">Family blocks</span>
            {data.closing.families.map((f, i) => (
              <div className="card" key={i}>
                <div className="row tight"><input placeholder="Heading, e.g. Nanihal Paksh" value={f.heading} maxLength={LIMITS.line} onChange={(e) => set(['closing', 'families', i, 'heading'], e.target.value)} /><IconBtn title="Remove block" onClick={() => set(['closing', 'families'], data.closing.families.filter((_, j) => j !== i))}>✕</IconBtn></div>
                <textarea rows={3} placeholder="Names, one per line" value={f.names} maxLength={LIMITS.block} onChange={(e) => set(['closing', 'families', i, 'names'], e.target.value)} />
              </div>
            ))}
            {data.closing.families.length < LIMITS.families ? <button type="button" className="link" onClick={() => set(['closing', 'families'], [...data.closing.families, { heading: '', names: '' }])}>+ Add family block</button> : null}
          </div>
          <div className="sub"><span className="fl">RSVP contacts</span>
            {data.closing.rsvp.map((r, i) => (
              <div className="row tight" key={i}>
                <input placeholder="Name" value={r.name} maxLength={LIMITS.name} onChange={(e) => set(['closing', 'rsvp', i, 'name'], e.target.value)} />
                <input placeholder="Phone" value={r.phone} maxLength={20} inputMode="tel" onChange={(e) => set(['closing', 'rsvp', i, 'phone'], e.target.value)} />
                <IconBtn title="Remove contact" onClick={() => set(['closing', 'rsvp'], data.closing.rsvp.filter((_, j) => j !== i))}>✕</IconBtn>
              </div>
            ))}
            {data.closing.rsvp.length < LIMITS.rsvp ? <button type="button" className="link" onClick={() => set(['closing', 'rsvp'], [...data.closing.rsvp, { name: '', phone: '' }])}>+ Add contact</button> : null}
          </div>
          <Field label="Map / directions link (https)" hint="Shown on the share page and as “Directions” on the closing card."><Text value={data.closing.mapLink} max={300} placeholder="https://maps.google.com/…" onChange={(v) => set(['closing', 'mapLink'], v)} /></Field>
          <Field label="Your QR code (optional PNG)" hint="Upload a crisp PNG. It appears on the closing invitation card.">
            <input type="file" accept="image/png,.png" onChange={async (e) => { const f = e.target.files[0]; if (!f) return; try { const id = await ensureInvite(); const url = await upload(id, 'qr', f); set(['closing', 'qrCode'], url); } catch (er) { setToast(friendly(er)); } }} />
            {data.closing.qrCode ? <><img src={data.closing.qrCode} alt="Uploaded QR code preview" style={{ width: 120, height: 120, objectFit: 'contain', marginTop: 8, background: '#fff' }} /><button type="button" className="link" onClick={() => set(['closing', 'qrCode'], '')}>Remove QR code</button></> : <span className="fh">No QR uploaded yet.</span>}
          </Field>
        </Section>

        <Section title="Music & extras">
          <Field label="Music">
            <Select value={data.meta.music.src} onChange={(v) => set(['meta', 'music', 'src'], v)} options={[['', 'No music'], ...library.map((m) => [m.src, m.label]), ...(data.meta.music.src && !library.some((m) => m.src === data.meta.music.src) ? [[data.meta.music.src, 'My uploaded track']] : [])]} />
          </Field>
          <label className="btn ghost">Upload your background audio (MP3 / MP4)<input type="file" accept="audio/mpeg,video/mp4,.mp3,.mp4" hidden onChange={async (e) => { const f = e.target.files[0]; if (!f) return; try { const id = await ensureInvite(); const url = await upload(id, 'music', f); set(['meta', 'music', 'src'], url); } catch (er) { setToast(friendly(er)); } }} /></label>
          <p className="note">No music is included. MP4 uploads need an audio track; only their sound is used.</p>
          <Field label={`Music volume: ${Math.round(data.meta.music.volume * 100)}%`}><input type="range" min="0" max="1" step="0.05" value={data.meta.music.volume} onChange={(e) => set(['meta', 'music', 'volume'], Number(e.target.value))} /></Field>
          <label className="checkline"><input type="checkbox" checked={!!data.meta.rsvpOnEndCard} onChange={(e) => set(['meta', 'rsvpOnEndCard'], e.target.checked)} /> Show the guest RSVP / wishes link on the end card</label>
        </Section>
      </div>

      <aside className="preview">
        <div className="pv">
          <Player ref={player} component={Invite} inputProps={inputProps} durationInFrames={tl.durationInFrames} compositionWidth={1080} compositionHeight={1920} fps={FPS}
            controls acknowledgeRemotionLicense style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 14, overflow: 'hidden', background: '#1b0b10' }} />
        </div>
        <div className="meta"><span>{totalSec}s · 1080×1920 · 30fps</span><span className="save">{inviteId ? saveState : 'Not saved yet'}</span></div>
        <div className="jumps">{scenes.map((s, i) => <button type="button" key={i} className="chip" onClick={() => player.current && player.current.seekTo(Math.min(s.start + s.duration - (s.exit ? s.exit.len : 0) - 1, s.start + (s.enter ? s.enter.len : 0) + 3.2 * FPS))}>{label(s)}</button>)}</div>
        <div className="actions">
          {['9x16', '16x9'].map((f) => {
            const r = renders[f];
            const busy = r && (r.status === 'queued' || r.status === 'running');
            return (
              <div key={f} className="ract">
                <button type="button" className="btn" disabled={busy || errors.length > 0} onClick={() => render(f)}>{busy ? `Rendering ${f === '9x16' ? '9:16' : '16:9'}… ${Math.round((r.progress || 0) * 100)}%` : `Render MP4 ${f === '9x16' ? '9:16 (Status/Reels)' : '16:9'}`}</button>
                {r && r.status === 'done' && r.result && r.result.url ? <a href={`${r.result.url}?download=1`}>Download</a> : null}
                {r && r.status === 'failed' ? <span className="err">Failed</span> : null}
              </div>
            );
          })}
          {inviteId ? <p className="share">Share link: <a href={`/v/${inviteId}`} target="_blank" rel="noopener">{location.origin}/v/{inviteId}</a></p> : null}
        </div>
        {toast ? <div className="toast" role="alert" onClick={() => setToast('')}>{toast}</div> : null}
      </aside>
    </div>
  );
}

createRoot(root).render(<App />);
