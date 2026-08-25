import { frequencyForRotation } from "./scale";

// Calibrates raw angular speed (rad/ms) into the engine's 0..1 intensity
// range — tuned so a comfortable spin reaches "fast" without needing a flick.
const MAX_ANGULAR_SPEED_RAD_PER_MS = 0.02;

// Keyboard alternative: arrow keys move the paired range input by whole
// steps; each step is half a pentatonic step's worth of rotation, so a press
// is a small, deliberate nudge rather than a full octave jump.
const RADIANS_PER_KEYBOARD_STEP = Math.PI / 5;

export interface WheelOptions {
  onStart: (freqHz: number) => void;
  onUpdate: (freqHz: number, speedNorm: number) => void;
  onSettle: () => void;
}

// A real jog wheel, not an X-position sensor: dragging tracks the pointer's
// angle around the wheel's center and accumulates it across any number of
// turns (see frequencyForRotation's cyclic wrap), and the visible platter
// rotates by that same accumulated angle so it looks like it's turning.
export function attachWheel(root: HTMLElement, { onStart, onUpdate, onSettle }: WheelOptions): void {
  const platterOrNull = root.querySelector<HTMLElement>("[data-wheel-platter]");
  const inputOrNull = root.querySelector<HTMLInputElement>("input[type=range]");
  if (!platterOrNull || !inputOrNull) return;
  const platter = platterOrNull;
  const input = inputOrNull;

  let rotation = 0;
  let dragging = false;
  let lastAngle = 0;
  let lastTime = 0;
  let started = false;

  function render(): void {
    platter.style.transform = `rotate(${rotation}rad)`;
  }

  function begin(freqHz: number): void {
    if (!started) {
      started = true;
      // Marks the deck as sounding so CSS can give it a permanent, gentle
      // "alive" glow — an idle deck should read as waiting, not broken.
      root.classList.add("is-live");
      onStart(freqHz);
    }
    onUpdate(freqHz, 0);
  }

  function pulseSpin(intensity: number, holdMs = 0): void {
    root.style.setProperty("--spin-intensity", String(intensity));
    if (holdMs > 0) {
      window.setTimeout(() => root.style.setProperty("--spin-intensity", "0"), holdMs);
    }
  }

  function angleFromEvent(event: PointerEvent): number {
    const rect = root.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(event.clientY - cy, event.clientX - cx);
  }

  function unwrapDelta(delta: number): number {
    if (delta > Math.PI) return delta - 2 * Math.PI;
    if (delta < -Math.PI) return delta + 2 * Math.PI;
    return delta;
  }

  root.addEventListener("pointerdown", (event) => {
    dragging = true;
    root.setPointerCapture(event.pointerId);
    root.classList.add("is-active");
    input.focus();
    lastAngle = angleFromEvent(event);
    lastTime = event.timeStamp;
    begin(frequencyForRotation(rotation));
    event.preventDefault();
  });

  root.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const angle = angleFromEvent(event);
    const delta = unwrapDelta(angle - lastAngle);
    const dt = Math.max(1, event.timeStamp - lastTime);
    const speedNorm = Math.min(1, Math.abs(delta) / dt / MAX_ANGULAR_SPEED_RAD_PER_MS);

    rotation += delta;
    lastAngle = angle;
    lastTime = event.timeStamp;
    render();
    pulseSpin(speedNorm);
    onUpdate(frequencyForRotation(rotation), speedNorm);
    event.preventDefault();
  });

  const end = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("is-active");
    root.releasePointerCapture(event.pointerId);
    pulseSpin(0);
    onSettle();
  };

  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);

  input.addEventListener("input", () => {
    rotation = Number(input.value) * RADIANS_PER_KEYBOARD_STEP;
    render();
    pulseSpin(0.6, 200);
    begin(frequencyForRotation(rotation));
    onSettle();
  });

  render();
}
