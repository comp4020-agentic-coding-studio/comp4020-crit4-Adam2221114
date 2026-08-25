# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows;
`src/pages/index.astro`'s head points at it. Replace it and the `description`
meta, and copy the head block into any new page. The card URL resolves against
the page that names it, like any link --- `./card.png` is wrong one directory
down, and nothing in CI checks it, so look at the deployed head when you add
pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## Working conventions

- After visual or content changes, verify the rendered site and rerun
  `pnpm check`, `pnpm build`, and
  `pnpm dlx linkinator ./dist --silent --skip "^https?://(?!localhost|127)"`
  before committing.

## C4: the instrument

A realistic compact DJ controller, not a synth dashboard or a play surface.
**LEFT DECK | CENTER MIXER | RIGHT DECK** — a stranger should recognise DJ
hardware before reading anything.

Two decks, each a persistent Web Audio voice:
- jog wheel → pitch (cumulative rotation, wrapped cyclically onto the
  pentatonic scale — always consonant, however far it spins)
- jog wheel spin speed → live filter brightness + intensity (a wheel has no
  Y axis, so this is what gesture speed did on the old play surface)
- FILTER knob → base brightness for that deck, live while sounding
- channel fader → that deck's level into the mix
- 1–2 performance pads → live-swap that deck's oscillator waveform without
  interrupting the sustained note

Crossfader mixes the two decks with an equal-power law: center = both
audible, no dip or spike at any position.

**Persistent, hardware-synth style, same principle as before.** The first
gesture on a deck resumes the shared `AudioContext` (autoplay policy — no
sound before it) and starts that deck's oscillators; they keep sounding
after release. Nothing rebuilds a voice on every interaction — controls
modify a live `AudioParam` via `engine.ts`'s `startDeck`/`updateDeck`/
`settleDeck`/`setDeckFilter`/`setDeckChannelGain`, or, for pads, live-swap
`OscillatorNode.type` via `setDeckCharacter`. A separate SOUND toggle ramps a
dedicated mute `GainNode`; it never stops an oscillator.

**Phase 1 only:** two decks (wheel, filter, fader, 1–2 pads each), one
crossfader, the `TOUCH THE DECK` invitation, the SOUND toggle. No PULSE/
tempo knob, no BPM sync, looping, track loading, waveform displays, cue
points, EQ bands, effects menus, or song libraries — not yet.

**Automated checks are not sufficient here.** `pnpm check` only proves the
code runs; it can't judge whether it looks and feels like real hardware.
Manual play-and-look in a real browser is a hard gate before any Phase 2
work: stop after Phase 1 is green and wait for that feedback.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.
