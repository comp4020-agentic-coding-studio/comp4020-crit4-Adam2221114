// Channel faders and the crossfader are native range inputs styled with CSS
// orientation — dragging a real range input already matches the physical
// motion of a fader (vertical) or a crossfader (horizontal), so unlike the
// jog wheels and knobs there's no custom drag math here, just a value read.
export interface FaderOptions {
  onChange: (norm: number) => void;
}

export function attachFader(input: HTMLInputElement, { onChange }: FaderOptions): void {
  const min = Number(input.min || "0");
  const max = Number(input.max || "1");

  // No initial onChange call here: that would build the AudioContext at page
  // load, before any gesture. The HTML default values are chosen to already
  // match the engine's own defaults, so nothing needs to sync until the
  // fader actually moves.
  input.addEventListener("input", () => {
    onChange((Number(input.value) - min) / (max - min));
  });
}
