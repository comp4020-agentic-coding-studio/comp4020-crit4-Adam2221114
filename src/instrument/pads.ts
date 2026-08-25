// A performance pad live-swaps its deck's oscillator waveform in place
// (OscillatorNode.type is settable without rebuilding the node) rather than
// retriggering a note — the deck's voice is persistent, so a pad press must
// not interrupt or restart the sustained sound, only recolour it.
const LIT_DURATION_MS = 180;

export interface PadOptions {
  onPress: () => void;
}

export function attachPad(button: HTMLButtonElement, { onPress }: PadOptions): void {
  button.addEventListener("click", () => {
    onPress();
    button.classList.add("is-lit");
    window.setTimeout(() => button.classList.remove("is-lit"), LIT_DURATION_MS);
  });
}
