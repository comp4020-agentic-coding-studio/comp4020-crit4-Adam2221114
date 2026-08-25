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
import { attachKnob } from "./knobs";
import { attachPad } from "./pads";
import { startVisualizer } from "./visualizer";
import { CHARACTERS } from "./voices";
import { attachWheel } from "./wheel";

export function initInstrument(): void {
  const panel = document.querySelector<HTMLElement>(".panel");
  const invitation = document.querySelector<HTMLElement>("#invitation");
  const soundToggle = document.querySelector<HTMLButtonElement>("#sound-toggle");
  const crossfaderInput = document.querySelector<HTMLInputElement>("#crossfader");
  const crossfaderDotA = document.querySelector<HTMLElement>("[data-xf-dot='a']");
  const crossfaderDotB = document.querySelector<HTMLElement>("[data-xf-dot='b']");
  const mixer = document.querySelector<HTMLElement>(".mixer");

  let invited = true;
  function dismissInvitation(): void {
    if (!invited || !invitation) return;
    invited = false;
    invitation.classList.add("is-dismissed");
  }

  // Once any deck is sounding, the ambient equalizer bars in the mixer come
  // alive too — the interface should feel awake once there's something to
  // hear, not just when a specific control is being touched.
  function markLive(id: DeckId): void {
    panel?.classList.add("is-live");
    document.querySelector(`.deck-${id}`)?.classList.add("is-live");
  }

  function wireDeck(id: DeckId): void {
    const deckSection = document.querySelector<HTMLElement>(`.deck-${id}`);
    const wheel = document.querySelector<HTMLElement>(`[data-wheel="${id}"]`);
    const filterKnob = document.querySelector<HTMLElement>(`[data-filter-knob="${id}"]`);
    const fader = document.querySelector<HTMLInputElement>(`[data-channel-fader="${id}"]`);
    const pads = document.querySelectorAll<HTMLButtonElement>(`[data-pad-deck="${id}"]`);

    if (wheel) {
      attachWheel(wheel, {
        onStart: (freqHz) => {
          resume();
          startDeck(id, freqHz);
          dismissInvitation();
          markLive(id);
        },
        onUpdate: (freqHz, speedNorm) => updateDeck(id, freqHz, speedNorm),
        onSettle: () => settleDeck(id),
      });
    }

    if (filterKnob) {
      attachKnob(filterKnob, {
        onChange: (norm) => {
          setDeckFilter(id, norm);
          // Turning FILTER toward "brighter" visibly brightens this deck's
          // own glow too — the knob's effect is felt and seen together.
          deckSection?.style.setProperty("--filter-level", String(norm));
        },
      });
    }
    if (fader) attachFader(fader, { onChange: (norm) => setDeckChannelGain(id, norm) });

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

  // Not a score or fail state — the sound/power control of a hardware
  // instrument. Ramps the whole instrument's output smoothly, both decks
  // included, rather than stopping anything.
  if (soundToggle) {
    let muted = false;
    soundToggle.addEventListener("click", () => {
      muted = !muted;
      setMuted(muted);
      soundToggle.setAttribute("aria-pressed", String(muted));
      soundToggle.textContent = muted ? "MUTED" : "SOUND";
      soundToggle.classList.toggle("is-muted", muted);
    });
  }
}
