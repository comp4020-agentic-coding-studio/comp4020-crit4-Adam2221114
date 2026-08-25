// Major pentatonic (no semitone step can land as a "wrong" note against it),
// spanning three octaves from A3 so both a slow spin and a fast one land
// somewhere comfortable to listen to.
const PENTATONIC_STEPS = [0, 2, 4, 7, 9];
const ROOT_HZ = 220;
const OCTAVES = 3;

function buildScale(): number[] {
  const table: number[] = [];
  for (let octave = 0; octave < OCTAVES; octave += 1) {
    for (const step of PENTATONIC_STEPS) {
      table.push(ROOT_HZ * 2 ** ((octave * 12 + step) / 12));
    }
  }
  return table;
}

export const SCALE = buildScale();

export function xToFrequency(xNorm: number): number {
  const clamped = Math.min(1, Math.max(0, xNorm));
  const index = Math.round(clamped * (SCALE.length - 1));
  return SCALE[index];
}

// Jog-wheel pitch: one full turn = one octave (STEPS_PER_TURN steps), wrapped
// cyclically over the whole table so any amount of spinning — a nudge or many
// turns — always lands on a consonant note, never an ever-rising pitch.
const STEPS_PER_TURN = PENTATONIC_STEPS.length;

export function frequencyForRotation(radians: number): number {
  const stepsFloat = (radians / (2 * Math.PI)) * STEPS_PER_TURN;
  const index = (Math.round(stepsFloat) % SCALE.length + SCALE.length) % SCALE.length;
  return SCALE[index];
}

// Unwrapped (not cyclic like frequencyForRotation's index): a live "how far
// from where you started" readout, e.g. for a brief on-screen "+3" while the
// wheel is being turned.
export function stepIndexForRotation(radians: number): number {
  return Math.round((radians / (2 * Math.PI)) * STEPS_PER_TURN);
}
