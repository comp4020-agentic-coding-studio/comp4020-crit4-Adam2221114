// A restrained ambient signal line for the start screen only — pure
// decoration, drawn without touching the engine or its AudioContext (that
// stays silent until ENTER DECK, the instrument's own first-gesture rule).
export function startIntroSignal(canvas: HTMLCanvasElement): void {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let phase = 0;

  function resize(): void {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  resize();
  window.addEventListener("resize", resize);

  function frame(): void {
    requestAnimationFrame(frame);
    const { width, height } = canvas;
    if (width === 0 || height === 0) return;

    phase += 0.01;
    ctx2d!.clearRect(0, 0, width, height);
    ctx2d!.lineWidth = 1.5 * dpr;
    ctx2d!.lineJoin = "round";
    ctx2d!.lineCap = "round";
    ctx2d!.beginPath();

    const steps = 96;
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * width;
      const y =
        height / 2 +
        Math.sin(i * 0.22 + phase) * height * 0.08 +
        Math.sin(i * 0.05 + phase * 0.6) * height * 0.05;
      if (i === 0) ctx2d!.moveTo(x, y);
      else ctx2d!.lineTo(x, y);
    }

    ctx2d!.strokeStyle = "rgba(148, 163, 184, 0.32)";
    ctx2d!.stroke();
  }

  requestAnimationFrame(frame);
}
