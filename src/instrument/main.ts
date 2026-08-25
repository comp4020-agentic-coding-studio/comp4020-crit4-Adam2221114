import {
  type DeckId,
  getAnalyser,
  getDeckAnalyser,
  resume,
  setCrossfader,
  setDeckCharacter,
  setDeckChannelGain,
  setDeckFilter,
  setMuted,
  settleDeck,
  startDeck,
  updateDeck,
} from "./engine";
import { attachFader } from "./fader";
import { startIntroSignal } from "./intro";
import { attachKnob } from "./knobs";
import { attachPad } from "./pads";
import { startVisualizer } from "./visualizer";
import { CHARACTERS } from "./voices";
import { attachWheel } from "./wheel";

export function initInstrument(): void {
  const panel = document.querySelector<HTMLElement>(".panel");
  const invitation = document.querySelector<HTMLElement>("#invitation");
  const crossfaderInput = document.querySelector<HTMLInputElement>("#crossfader");
  const crossfaderDotA = document.querySelector<HTMLElement>("[data-xf-dot='a']");
  const crossfaderDotB = document.querySelector<HTMLElement>("[data-xf-dot='b']");
  const mixer = document.querySelector<HTMLElement>(".mixer");

  const app = document.querySelector<HTMLElement>("[data-app]");
  const startScreen = document.querySelector<HTMLElement>("[data-start-screen]");
  const startCanvas = document.querySelector<HTMLCanvasElement>("[data-start-canvas]");
  const enterButton = document.querySelector<HTMLButtonElement>("#enter-deck");
  const playToggle = document.querySelector<HTMLButtonElement>("#play-toggle");
  const statusText = document.querySelector<HTMLElement>("[data-status-text]");
  const statusTimer = document.querySelector<HTMLElement>("[data-status-timer]");

  let invited = true;
  function dismissInvitation(): void {
    if (!invited || !invitation) return;
    invited = false;
    invitation.classList.add("is-dismissed");
  }

  // Brief numeric feedback while a control is actively being moved, not a
  // permanent readout — each element fades itself out again after a short
  // pause in interaction, independent of every other element's timer.
  const readoutTimers = new WeakMap<HTMLElement, number>();
  function flashReadout(el: HTMLElement | null, text: string): void {
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-showing");
    const existing = readoutTimers.get(el);
    if (existing !== undefined) window.clearTimeout(existing);
    readoutTimers.set(
      el,
      window.setTimeout(() => el.classList.remove("is-showing"), 900),
    );
  }
  function formatPercent(norm: number): string {
    return `${Math.round(Math.min(1, Math.max(0, norm)) * 100)}%`;
  }
  function formatSignedStep(step: number): string {
    return step > 0 ? `+${step}` : String(step);
  }

  // A simple pause/resume session clock: accumulates elapsed time in
  // timerBaseMs across any number of pauses, rather than resetting on
  // resume — it reads as "time this session has been live" in total.
  let timerBaseMs = 0;
  let timerStartedAt: number | null = null;
  let timerIntervalId: number | null = null;
  function renderTimer(): void {
    if (!statusTimer) return;
    const elapsedMs = timerBaseMs + (timerStartedAt !== null ? Date.now() - timerStartedAt : 0);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    statusTimer.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  function startTimer(): void {
    timerStartedAt = Date.now();
    if (timerIntervalId === null) timerIntervalId = window.setInterval(renderTimer, 1000);
  }
  function stopTimer(): void {
    if (timerStartedAt !== null) {
      timerBaseMs += Date.now() - timerStartedAt;
      timerStartedAt = null;
    }
    if (timerIntervalId !== null) {
      window.clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  // Once any deck is sounding, the ambient equalizer bars in the mixer come
  // alive too — the interface should feel awake once there's something to
  // hear, not just when a specific control is being touched.
  function markLive(id: DeckId): void {
    panel?.classList.add("is-live");
    document.querySelector(`.deck-${id}`)?.classList.add("is-live");
  }

  function wireDeck(id: DeckId): void {
    const wheel = document.querySelector<HTMLElement>(`[data-wheel="${id}"]`);
    const filterKnob = document.querySelector<HTMLElement>(`[data-filter-knob="${id}"]`);
    const fader = document.querySelector<HTMLInputElement>(`[data-channel-fader="${id}"]`);
    const pads = document.querySelectorAll<HTMLButtonElement>(`[data-pad-deck="${id}"]`);
    const wheelReadout = document.querySelector<HTMLElement>(`[data-wheel-value="${id}"]`);
    const knobReadout = document.querySelector<HTMLElement>(`[data-knob-value="${id}"]`);
    const faderReadout = document.querySelector<HTMLElement>(`[data-fader-value="${id}"]`);

    if (wheel) {
      attachWheel(wheel, {
        onStart: (freqHz) => {
          resume();
          startDeck(id, freqHz);
          dismissInvitation();
          markLive(id);
        },
        onUpdate: (freqHz, speedNorm, stepIndex) => {
          updateDeck(id, freqHz, speedNorm);
          flashReadout(wheelReadout, formatSignedStep(stepIndex));
        },
        onSettle: () => settleDeck(id),
      });
    }

    if (filterKnob) {
      attachKnob(filterKnob, {
        onChange: (norm) => {
          setDeckFilter(id, norm);
          flashReadout(knobReadout, formatPercent(norm));
        },
      });
    }
    if (fader) {
      attachFader(fader, {
        onChange: (norm) => {
          setDeckChannelGain(id, norm);
          flashReadout(faderReadout, formatPercent(norm));
        },
      });
    }

    pads.forEach((pad) => {
      const preset = CHARACTERS[Number(pad.dataset.padCharacter ?? "0")] ?? CHARACTERS[0];
      attachPad(pad, {
        onPress: () => {
          resume();
          setDeckCharacter(id, preset);
          dismissInvitation();
          // Sticky selection: the pad that last set this deck's character
          // stays lit, so which sound is currently active is always visible,
          // not just for the brief press flash.
          pads.forEach((p) => p.classList.toggle("is-selected", p === pad));
        },
      });
    });
  }

  wireDeck("a");
  wireDeck("b");

  // Mobile shows one deck's controls at a time (see the max-width media
  // query in styles.css); these tabs are hidden entirely on desktop, where
  // both decks are already visible side by side.
  const deckTabs = document.querySelectorAll<HTMLButtonElement>("[data-deck-tab]");
  deckTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.deckTab as DeckId;
      panel?.setAttribute("data-active-deck", id);
      deckTabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    });
  });

  const signalCanvas = document.querySelector<HTMLCanvasElement>("[data-signal-canvas]");
  if (signalCanvas && panel) {
    startVisualizer(signalCanvas, panel, {
      getMaster: getAnalyser,
      getDeckA: () => getDeckAnalyser("a"),
      getDeckB: () => getDeckAnalyser("b"),
    });
  }

  if (crossfaderInput) {
    attachFader(crossfaderInput, {
      onChange: (norm) => {
        setCrossfader(norm);
        // Same equal-power law as the audio mix, applied to the two glow
        // dots beside the crossfader so the mixer visibly leans toward
        // whichever deck is louder — not just an audio change, a visible one.
        const t = Math.min(1, Math.max(0, norm));
        crossfaderDotA?.style.setProperty("--level", String(Math.cos(t * (Math.PI / 2))));
        crossfaderDotB?.style.setProperty("--level", String(Math.sin(t * (Math.PI / 2))));
        mixer?.style.setProperty("--mix-balance", String(t));
      },
    });
  }

  if (startCanvas) startIntroSignal(startCanvas);

  // ENTER DECK is the user gesture the autoplay policy requires: it resumes
  // the shared AudioContext, but nothing is audible yet — a deck's own
  // envelope only opens once its wheel or a pad is first touched.
  enterButton?.addEventListener("click", () => {
    resume();
    app?.setAttribute("data-entered", "true");
    panel?.removeAttribute("inert");
    startScreen?.setAttribute("inert", "");
    startTimer();
    renderTimer();
  });

  // Pause/resume is not a score or fail state — the transport control of a
  // hardware instrument. It reuses the same mute GainNode ramp as before, so
  // pausing only silences output; every knob, fader, pad and pitch value
  // stays exactly where it was, ready the instant playback resumes.
  let paused = false;
  function setPaused(nextPaused: boolean): void {
    paused = nextPaused;
    resume();
    setMuted(paused);
    playToggle?.classList.toggle("is-paused", paused);
    playToggle?.setAttribute("aria-label", paused ? "Resume deck" : "Pause deck");
    if (statusText) statusText.textContent = paused ? "○ PAUSED" : "● LIVE";
    panel?.classList.toggle("is-paused", paused);
    if (paused) stopTimer();
    else startTimer();
  }
  playToggle?.addEventListener("click", () => setPaused(!paused));
}
