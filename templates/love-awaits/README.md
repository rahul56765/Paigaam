# Love Awaits

The proposal that refuses to take no for an answer — a Paigaam port of
[ft976/97](https://github.com/ft976/97) ("Love Awaits", live at
97-lac.vercel.app; no license file in the source repo, ported with mechanics
preserved and all copyrighted material replaced).

Tap to begin: a universe of pink stardust condenses into a beating heart, a
cat companion makes the sender's case, and the question stands — **Will You
Be My Forever?** Every **No** walks the ladder (*Wait… Really? → Don't Break
My Heart → I'm Pleading With You → Please… Don't Do This → LAST CHANCE!*),
swapping the cat's reaction — sad, pleading, grumpy, knife, gun — and at the
last rung the No button literally dodges the hand that tries to press it.
**Yes, Forever** bursts the screen in confetti, and the answer is remembered:
every return visit lands on the *Forever & Always* card until they replay it.

## Routes

| Route | What |
|---|---|
| `/create/love-awaits` | five-step generator (draft → preview → publish) |
| `/love-awaits/demo` | sample proposal (Meher → Rahul) |
| `/love-awaits/preview/:id` | owner-only live preview |
| `/p/love-<18hex>` | the published proposal |
| `POST /api/love-awaits/draft` | save draft (creator-cookie ownership) |
| `POST /api/love-awaits/publish` | free instant publish |

## Editable fields

`recipientName` (required), `senderName`, `introTitle`, `question`,
`questionNote` (the line beneath the question), `yesLabel`, `noLabel`,
`finaleTitle`, `finaleLine`. The five escalation messages after the question
are the template's own — they are the experience. Everything defaults to the
original copy, so an untouched form still asks the designed question.

## Mechanics (ported 1:1)

- Six-message ladder, same copy, same emoji, same image per rung.
- The opener gate: nothing plays until the first tap (the audio gesture), the
  same "Tap to Begin Our Story".
- At ladder rung 6 (LAST CHANCE) the No button dodges: a random offset of
  ±175px on hover *and* touchstart, exactly the original's
  `random(-350..350)/2`.
- Yes → 100-particle burst (two colours, power-out, 1.5s), the cat-kiss
  finale card, and `localStorage` persistence — "permanent acceptance state".
- Replay Memory clears the flag and reloads, same as the original.
- The background: the same 7,000-point particle heart. The original builds a
  random scatter, eases it 4.5s into a parametric heart curve
  (`16sin³t, 13cos t − 5cos 2t − 2cos 3t − cos 4t`), then breathes it at
  `sin(t·5)·0.03` with a slow sway — the port reproduces each of those
  constants on a canvas 2D field with additive blending. Reduced-motion
  renders the finished heart, static.

## The library question

The original loads React, Babel standalone, three.js, GSAP and Tailwind from
CDNs. Paigaam is a zero-dependency server and templates ship no libraries, so
the port re-expresses the choreography in vanilla terms: the particle heart
is a hand-rolled canvas simulation (identical constants), the confetti burst
is the same hand-rolled canvas engine Valentine Say Yes uses, and the React
state machine is three server-rendered stages toggled by a small scene
controller. Same experience, nothing to install.

## The music question

The original's soundtrack is a commercial MP3 — Ed Sheeran's "Perfect",
ripped from a piracy site (Mr-Jat.in) and committed to the repo. It cannot be
redistributed, so the port ships **no recording**. On the same tap gesture it
starts a generative Web Audio score (soft chords and bell overtones in F,
scheduled with free oscillators — the Saalgirah precedent), with a mute
control in the corner. The mood arrives; the copyright doesn't.

## Media

Seven cat images (the opener comic + five reaction ladder rungs + the kiss
finale — 1 GIF and 6 animated WebP, ~1.6MB total). `love.webp` from the
source repo is unreferenced by the original `index.html` and is not shipped.
Like every Paigaam binary, the images live base64 in `assets/love-awaits/`
with a sha256 manifest, boot-healed into `public/love-awaits/media/` by
`lib/loveAwaitsMedia.js` — text-only git APIs corrupt raw binaries.
