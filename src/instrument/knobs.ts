// A real rotary control: grab anywhere on the knob face and turn it around
// its own centre, the way a hardware dial works — not a vertical fader
// wearing a circle's clothing. Pointer Events (not mouse/touch-specific
// listeners) so the same code drives mouse, touch and pen alike.
//
// One full physical turn (2π radians) sweeps the whole 0..1 parameter range.
// Because the drag reads as a *delta* between successive pointer angles
// (unwrapDelta, same fix as the jog wheel's own rotation tracking in
// wheel.ts) rather than an absolute angle-to-value mapping, crossing the
// atan2 seam at ±180° never reads as a jump — only ever the short way round.
const RADIANS_PER_FULL_SWEEP = 2 * Math.PI;

// The pointer only ever sets a *target*; a rAF loop eases the visible/audible
// value toward it every frame so the motion stays evenly paced regardless of
// how bursty the source pointer events are (fast mouse flicks, coalesced
// touch batches).
const SMOOTHING_PER_FRAME = 0.4;
const SNAP_EPSILON = 0.0008;

export interface KnobOptions {
  onChange: (norm: number) => void;
}

function angleFromEvent(root: HTMLElement, event: PointerEvent): number {
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

export function attachKnob(root: HTMLElement, { onChange }: KnobOptions): void {
  const inputOrNull = root.querySelector<HTMLInputElement>("input[type=range]");
  const indicatorOrNull = root.querySelector<HTMLElement>("[data-knob-indicator]");
  if (!inputOrNull || !indicatorOrNull) return;
  const input = inputOrNull;
  const indicator = indicatorOrNull;

  const min = Number(input.min || "0");
  const max = Number(input.max || "1");

  let displayNorm = (Number(input.value) - min) / (max - min);
  let targetNorm = displayNorm;
  let rafId: number | null = null;

  function paint(norm: number): void {
    // A full 0..360° sweep, not the old ±135° arc — the indicator and the
    // fill-ring (driven by --knob-fill in styles.css) both read as one
    // continuous circle, matching how the control is actually turned.
    indicator.style.transform = `rotate(${norm * 360}deg)`;
    root.style.setProperty("--knob-fill", String(norm));
  }

  function tick(): void {
    const diff = targetNorm - displayNorm;
    if (Math.abs(diff) < SNAP_EPSILON) {
      displayNorm = targetNorm;
      rafId = null;
    } else {
      displayNorm += diff * SMOOTHING_PER_FRAME;
      rafId = requestAnimationFrame(tick);
    }
    input.value = String(min + displayNorm * (max - min));
    paint(displayNorm);
    onChange(displayNorm);
  }

  function setTarget(norm: number): void {
    // Clamped, not wrapped: the filter has real endpoints (deepest/brightest),
    // so past either end the knob soft-stops — further turning in that
    // direction simply has no further effect, like a hardware pot's stop.
    targetNorm = Math.min(1, Math.max(0, norm));
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  let dragging = false;
  let lastAngle = 0;

  root.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastAngle = angleFromEvent(root, event);
    root.setPointerCapture(event.pointerId);
    root.classList.add("is-active");
    input.focus();
    event.preventDefault();
  });

  root.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const angle = angleFromEvent(root, event);
    const delta = unwrapDelta(angle - lastAngle);
    lastAngle = angle;
    setTarget(targetNorm + delta / RADIANS_PER_FULL_SWEEP);
    // Without this, a fast drag can be interpreted as a text-selection or
    // scroll gesture mid-stream on some browsers, which visibly stalls the
    // knob until the gesture is released.
    event.preventDefault();
  });

  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("is-active");
    root.releasePointerCapture(event.pointerId);
  };

  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  // Keyboard alternative: arrow keys still move the paired range input by its
  // native step, independent of the drag math above.
  input.addEventListener("input", () => {
    setTarget((Number(input.value) - min) / (max - min));
  });

  paint(displayNorm);
}
