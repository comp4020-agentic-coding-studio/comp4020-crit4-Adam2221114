import { CHARACTERS, type CharacterPreset } from "./voices";

export type DeckId = "a" | "b";

// Fixed and bounded, independent of gesture speed: their only job is to stop
// a note clicking at on/off. The audible effect of spin speed lives in
// intensityGain/filter offsets instead — see updateDeck.
const ATTACK_SECONDS = 0.01;
const GLIDE_TIME_CONSTANT = 0.02;
const INTENSITY_TIME_CONSTANT = 0.03;
const MUTE_TIME_CONSTANT = 0.15;
const FADER_TIME_CONSTANT = 0.02;

// A deck's voice is a hardware-synth-style persistent oscillator: once its
// own first gesture starts it, it keeps sounding. Releasing the jog wheel
// settles intensity to this resting level instead of silence — the deck
// holds its last musical state rather than falling quiet when it stops
// spinning.
const REST_INTENSITY = 0.55;
const SETTLE_TIME_CONSTANT = 0.25;

const FILTER_MIN_HZ = 300;
const FILTER_MAX_HZ = 5000;
const SPEED_BRIGHTNESS_RANGE_HZ = 1500;
const FILTER_FLOOR_HZ = 80;
const FILTER_CEILING_HZ = 12000;

// A character with a second waveform (e.g. "hollow") plays it at this level;
// single-waveform characters mute the second oscillator rather than tearing
// it down, so a pad press can swap characters live with no dropout.
const SECOND_OSC_GAIN = 0.8;

const DEFAULT_CHARACTER_INDEX: Record<DeckId, number> = { a: 0, b: 1 };

interface Deck {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  osc2Gain: GainNode;
  filter: BiquadFilterNode;
  intensityGain: GainNode;
  envelopeGain: GainNode;
  channelGain: GainNode;
  crossfadeGain: GainNode;
  analyser: AnalyserNode;
  filterBaseHz: number;
  filterSpeedOffsetHz: number;
  started: boolean;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode;
let muteGain: GainNode;
let compressor: DynamicsCompressorNode;
let analyser: AnalyserNode | null = null;
// Audio nodes not reachable from the destination are allowed to go unprocessed
// in some engines — a dead-end analyser tap can silently stop updating. This
// silent bus keeps every per-deck analyser "live" without adding anything
// audible.
let silentSink: GainNode;
let decks: Record<DeckId, Deck> | null = null;

let crossfaderNorm = 0.5;
let muted = false;

function filterKnobToHz(norm: number): number {
  const t = Math.min(1, Math.max(0, norm));
  return FILTER_MIN_HZ * (FILTER_MAX_HZ / FILTER_MIN_HZ) ** t;
}

function recomputeFilter(audio: AudioContext, deck: Deck): void {
  const target = Math.min(
    FILTER_CEILING_HZ,
    Math.max(FILTER_FLOOR_HZ, deck.filterBaseHz + deck.filterSpeedOffsetHz),
  );
  deck.filter.frequency.setTargetAtTime(target, audio.currentTime, GLIDE_TIME_CONSTANT);
}

function applyCrossfader(audio: AudioContext): void {
  if (!decks) return;
  const t = Math.min(1, Math.max(0, crossfaderNorm));
  const now = audio.currentTime;
  decks.a.crossfadeGain.gain.setTargetAtTime(Math.cos(t * (Math.PI / 2)), now, GLIDE_TIME_CONSTANT);
  decks.b.crossfadeGain.gain.setTargetAtTime(Math.sin(t * (Math.PI / 2)), now, GLIDE_TIME_CONSTANT);
}

function buildDeck(audio: AudioContext, defaultCharacter: CharacterPreset): Deck {
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7;

  const intensityGain = audio.createGain();
  intensityGain.gain.value = 0.7;

  const envelopeGain = audio.createGain();
  envelopeGain.gain.value = 0;

  const channelGain = audio.createGain();
  channelGain.gain.value = 0.8;

  const crossfadeGain = audio.createGain();
  crossfadeGain.gain.value = 1;

  // Tapped after this deck's own crossfade gain, so the waveform the
  // visualizer reads already reflects both that deck's channel fader and
  // its current crossfader weighting — real signal, not a guess derived
  // from the two independently.
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.7;

  const osc2Gain = audio.createGain();

  const osc1 = audio.createOscillator();
  const osc2 = audio.createOscillator();
  osc1.frequency.value = 440;
  osc2.frequency.value = 880;

  osc1.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(intensityGain);
  intensityGain.connect(envelopeGain);
  envelopeGain.connect(channelGain);
  channelGain.connect(crossfadeGain);
  crossfadeGain.connect(masterGain);
  crossfadeGain.connect(analyser);
  analyser.connect(silentSink);

  osc1.start();
  osc2.start();

  const deck: Deck = {
    osc1,
    osc2,
    osc2Gain,
    filter,
    intensityGain,
    envelopeGain,
    channelGain,
    crossfadeGain,
    analyser,
    filterBaseHz: filterKnobToHz(0.4),
    filterSpeedOffsetHz: 0,
    started: false,
  };

  applyCharacterToDeck(deck, defaultCharacter, audio);
  recomputeFilter(audio, deck);
  return deck;
}

function applyCharacterToDeck(deck: Deck, preset: CharacterPreset, audio: AudioContext): void {
  deck.osc1.type = preset.waveforms[0];
  const secondWaveform = preset.waveforms[1];
  if (secondWaveform) {
    deck.osc2.type = secondWaveform;
    deck.osc2Gain.gain.setTargetAtTime(SECOND_OSC_GAIN, audio.currentTime, GLIDE_TIME_CONSTANT);
  } else {
    deck.osc2Gain.gain.setTargetAtTime(0, audio.currentTime, GLIDE_TIME_CONSTANT);
  }
}

function ensureContext(): AudioContext {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  ctx = new AudioContext();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.9;

  // A dedicated node for the sound/mute control, separate from masterGain —
  // muting ramps this to zero and back rather than stopping any oscillator.
  muteGain = ctx.createGain();
  muteGain.gain.value = muted ? 0 : 1;

  compressor = ctx.createDynamicsCompressor();

  // Tapped after the mute gain, before the compressor, so the visualizer
  // reads the same signal a listener actually hears: it flatlines when
  // muted rather than showing motion for sound nobody can hear.
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;

  masterGain.connect(muteGain);
  muteGain.connect(analyser);
  analyser.connect(compressor);
  compressor.connect(ctx.destination);

  silentSink = ctx.createGain();
  silentSink.gain.value = 0;
  silentSink.connect(ctx.destination);

  decks = {
    a: buildDeck(ctx, CHARACTERS[DEFAULT_CHARACTER_INDEX.a]),
    b: buildDeck(ctx, CHARACTERS[DEFAULT_CHARACTER_INDEX.b]),
  };
  applyCrossfader(ctx);

  return ctx;
}

// Every public setter below calls ensureContext(), and ensureContext resumes
// a suspended context whenever it's already running on the audio thread —
// so touching ANY control (wheel, knob, fader, pad) is enough to satisfy the
// "first gesture resumes AudioContext" rule, not just the wheel. Nodes exist
// silently (envelopeGain starts at 0) until a deck's own first gesture calls
// startDeck, so nothing is audible before that regardless of context state.
export function resume(): void {
  ensureContext();
}

// Returns null until the first gesture creates the AudioContext — callers
// (the visualizer) fall back to an idle animation until then.
export function getAnalyser(): AnalyserNode | null {
  return analyser;
}

// Per-deck taps for the visualizer's two-colour (cyan/magenta) waveform —
// each already reflects that deck's channel fader and crossfader weighting.
export function getDeckAnalyser(id: DeckId): AnalyserNode | null {
  return decks?.[id]?.analyser ?? null;
}

export function setMuted(nextMuted: boolean): void {
  const audio = ensureContext();
  muted = nextMuted;
  muteGain.gain.setTargetAtTime(muted ? 0 : 1, audio.currentTime, MUTE_TIME_CONSTANT);
}

export function isMuted(): boolean {
  return muted;
}

// Starts a deck's persistent voice on that deck's own first gesture. A no-op
// if it's already running — later gestures move it, they don't recreate it,
// so the underlying oscillators stay alive for the life of the page (or
// until muted) rather than being repeatedly built and torn down.
export function startDeck(id: DeckId, freqHz: number): void {
  const audio = ensureContext();
  const deck = decks?.[id];
  if (!deck || deck.started) return;

  deck.started = true;
  const now = audio.currentTime;
  deck.osc1.frequency.setValueAtTime(freqHz, now);
  deck.osc2.frequency.setValueAtTime(freqHz * 2, now);
  deck.envelopeGain.gain.cancelScheduledValues(now);
  deck.envelopeGain.gain.setValueAtTime(0, now);
  deck.envelopeGain.gain.setTargetAtTime(1, now, ATTACK_SECONDS);
}

export function updateDeck(id: DeckId, freqHz: number, speedNorm: number): void {
  const audio = ensureContext();
  const deck = decks?.[id];
  if (!deck || !deck.started) return;

  const now = audio.currentTime;
  deck.osc1.frequency.setTargetAtTime(freqHz, now, GLIDE_TIME_CONSTANT);
  deck.osc2.frequency.setTargetAtTime(freqHz * 2, now, GLIDE_TIME_CONSTANT);

  const clampedSpeed = Math.min(1, Math.max(0, speedNorm));
  deck.filterSpeedOffsetHz = clampedSpeed * SPEED_BRIGHTNESS_RANGE_HZ;
  recomputeFilter(audio, deck);

  // Slow spins sit quieter/darker; fast spins sit louder/brighter — audible
  // while the wheel is still moving, not just at the moment it's grabbed.
  const intensity = 0.45 + 0.55 * clampedSpeed;
  deck.intensityGain.gain.setTargetAtTime(intensity, now, INTENSITY_TIME_CONSTANT);
}

// Called on wheel release: spinning stops, but the voice keeps sounding.
// Speed's brightness contribution fades out and intensity settles to a
// comfortable sustained level instead of falling to silence.
export function settleDeck(id: DeckId): void {
  const audio = ensureContext();
  const deck = decks?.[id];
  if (!deck) return;

  deck.filterSpeedOffsetHz = 0;
  recomputeFilter(audio, deck);
  deck.intensityGain.gain.setTargetAtTime(REST_INTENSITY, audio.currentTime, SETTLE_TIME_CONSTANT);
}

export function setDeckFilter(id: DeckId, norm: number): void {
  const audio = ensureContext();
  const deck = decks?.[id];
  if (!deck) return;

  deck.filterBaseHz = filterKnobToHz(norm);
  recomputeFilter(audio, deck);
}

export function setDeckChannelGain(id: DeckId, norm: number): void {
  const audio = ensureContext();
  const deck = decks?.[id];
  if (!deck) return;

  const clamped = Math.min(1, Math.max(0, norm));
  deck.channelGain.gain.setTargetAtTime(clamped, audio.currentTime, FADER_TIME_CONSTANT);
}

export function setDeckCharacter(id: DeckId, preset: CharacterPreset): void {
  const audio = ensureContext();
  const deck = decks?.[id];
  if (!deck) return;

  applyCharacterToDeck(deck, preset, audio);
}

export function setCrossfader(norm: number): void {
  const audio = ensureContext();
  crossfaderNorm = Math.min(1, Math.max(0, norm));
  applyCrossfader(audio);
}
