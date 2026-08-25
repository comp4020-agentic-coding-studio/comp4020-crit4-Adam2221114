export interface CharacterPreset {
  name: string;
  waveforms: OscillatorType[];
}

// Distinct enough to be audibly different characters, not variations on one
// timbre. WARP (a live waveshaper drive) is Phase 2 — these stay plain.
export const CHARACTERS: CharacterPreset[] = [
  { name: "glass", waveforms: ["sine"] },
  { name: "buzz", waveforms: ["sawtooth"] },
  { name: "hollow", waveforms: ["square", "sine"] },
];
