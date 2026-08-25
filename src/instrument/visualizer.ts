// A real signal readout, not a decorative loop: each deck's line is drawn
// from that deck's own AnalyserNode (tapped after its channel fader AND
// crossfader gain — see engine.ts), so amplitude, colour balance and the
// two lines visually meeting in the centre all come from the actual audio
// graph, not a duplicated calculation. Additive ("lighter") blending means
// cyan (A) and magenta (B) genuinely combine wherever both are present,
// rather than one simply being drawn on top of the other.
const IDLE_AMPLITUDE_RATIO = 0.03;
const LIVE_AMPLITUDE_RATIO = 0.4;
const IDLE_SPEED = 0.012;

export interface VisualizerSources {
  getMaster: () => AnalyserNode | null;
  getDeckA: () => AnalyserNode | null;
  getDeckB: () => AnalyserNode | null;
}

function readRms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer);
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const centered = (buffer[i] - 128) / 128;
    sumSquares += centered * centered;
  }
  return Math.sqrt(sumSquares / buffer.length);
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  buffer: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
  amplitudeRatio: number,
  color: string,
  glow: number,
): void {
  const step = width / (buffer.length - 1);
  ctx.beginPath();
  for (let i = 0; i < buffer.length; i += 1) {
    const centered = (buffer[i] - 128) / 128;
    const x = i * step;
    const y = height / 2 + centered * height * amplitudeRatio;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function startVisualizer(
  canvas: HTMLCanvasElement,
  panel: HTMLElement,
  { getMaster, getDeckA, getDeckB }: VisualizerSources,
): void {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let bufferA: Uint8Array<ArrayBuffer> | null = null;
  let bufferB: Uint8Array<ArrayBuffer> | null = null;
  let bufferMaster: Uint8Array<ArrayBuffer> | null = null;
  let idlePhase = 0;

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
    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    ctx2d!.clearRect(0, 0, width, height);
    ctx2d!.lineWidth = 2.5 * dpr;
    ctx2d!.lineJoin = "round";
    ctx2d!.lineCap = "round";

    const deckA = getDeckA();
    const deckB = getDeckB();
    const master = getMaster();

    if (deckA || deckB) {
      ctx2d!.globalCompositeOperation = "lighter";

      let level = 0;
      if (deckA) {
        if (!bufferA || bufferA.length !== deckA.fftSize) bufferA = new Uint8Array(deckA.fftSize);
        const rms = readRms(deckA, bufferA);
        level = Math.max(level, rms);
        drawLine(ctx2d!, bufferA, width, height, LIVE_AMPLITUDE_RATIO, "#7dd3fc", (5 + rms * 26) * dpr);
      }
      if (deckB) {
        if (!bufferB || bufferB.length !== deckB.fftSize) bufferB = new Uint8Array(deckB.fftSize);
        const rms = readRms(deckB, bufferB);
        level = Math.max(level, rms);
        drawLine(ctx2d!, bufferB, width, height, LIVE_AMPLITUDE_RATIO, "#f472b6", (5 + rms * 26) * dpr);
      }

      ctx2d!.globalCompositeOperation = "source-over";
      panel.style.setProperty("--audio-level", String(Math.min(1, level * 4)));
    } else if (master) {
      if (!bufferMaster || bufferMaster.length !== master.fftSize) {
        bufferMaster = new Uint8Array(master.fftSize);
      }
      const rms = readRms(master, bufferMaster);
      drawLine(ctx2d!, bufferMaster, width, height, LIVE_AMPLITUDE_RATIO, "#b9c3ff", (5 + rms * 26) * dpr);
      panel.style.setProperty("--audio-level", String(Math.min(1, rms * 4)));
    } else {
      idlePhase += IDLE_SPEED;
      const steps = 64;
      ctx2d!.beginPath();
      for (let i = 0; i <= steps; i += 1) {
        const x = (i / steps) * width;
        const y = height / 2 + Math.sin(i * 0.32 + idlePhase) * height * IDLE_AMPLITUDE_RATIO;
        if (i === 0) ctx2d!.moveTo(x, y);
        else ctx2d!.lineTo(x, y);
      }
      ctx2d!.shadowColor = "rgba(180, 190, 255, 0.5)";
      ctx2d!.shadowBlur = 4 * dpr;
      ctx2d!.strokeStyle = "rgba(180, 190, 255, 0.55)";
      ctx2d!.stroke();
      panel.style.setProperty("--audio-level", "0");
    }
  }

  requestAnimationFrame(frame);
}
