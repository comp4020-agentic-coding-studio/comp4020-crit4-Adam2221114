// A real rotary control, not a slider styled into a circle: the underlying
// <input type="range"> stays for native focus and arrow-key support, but its
// pointer events are disabled (see styles.css) so dragging anywhere on the
// knob face rotates the visible indicator instead of jumping to a click
// position the way a native range track would.
const MIN_ANGLE_DEG = -135;
const MAX_ANGLE_DEG = 135;

// How much vertical drag it takes to sweep the full 0..1 range. Wider than
// it looks like it needs to be: at the knob's enlarged size, a short sweep
// makes ordinary pointer jitter (a shaky hand, a coalesced batch of touch
// events) read as a visible wobble. A longer, deliberate throw is both more
// stable and closer to how a real fader-style rotary control feels.
const DRAG_PX_FOR_FULL_SWEEP = 260;

// The pointer only ever sets a *target*; a rAF loop eases the visible/audible
// value toward it every frame. Pointer events arrive at whatever rate the
// device/browser feels like (bursty on fast mouse flicks, uneven on touch),
// so writing straight from each event makes the knob exactly as jumpy as the
// raw input. Re-sampling once per frame makes the motion evenly paced no
// matter how choppy the source events are. High enough to stay responsive —
// it settles within a handful of frames, well under the ~150-200ms where lag
// becomes noticeable.
const SMOOTHING_PER_FRAME = 0.4;
const SNAP_EPSILON = 0.0008;

export interface KnobOptions {
  onChange: (norm: number) => void;
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
    const angle = MIN_ANGLE_DEG + norm * (MAX_ANGLE_DEG - MIN_ANGLE_DEG);
    indicator.style.transform = `rotate(${angle}deg)`;
    // Drives the glowing fill-arc ring in CSS, so the current position reads
    // clearly at a glance and not just from the thin indicator line.
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
    targetNorm = Math.min(1, Math.max(0, norm));
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  let dragging = false;
  let startY = 0;
  let startNorm = 0;

  root.addEventListener("pointerdown", (event) => {
    dragging = true;
    startY = event.clientY;
    startNorm = targetNorm;
    root.setPointerCapture(event.pointerId);
    root.classList.add("is-active");
    input.focus();
    event.preventDefault();
  });

  root.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deltaY = startY - event.clientY;
    setTarget(startNorm + deltaY / DRAG_PX_FOR_FULL_SWEEP);
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

  input.addEventListener("input", () => {
    setTarget((Number(input.value) - min) / (max - min));
  });

  paint(displayNorm);
}
