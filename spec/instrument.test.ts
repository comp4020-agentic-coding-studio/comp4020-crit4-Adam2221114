import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// This week's published spec (crit 4, "An instrument") asks for a browser
// instrument: live synthesis, not playback, playable uninstructed. Most of
// that only a person can judge at the crit — expressiveness, feel, whether a
// stranger picks it up with no instructions — see spec/README.md. What
// follows is the slice that's mechanically checkable from the shipped build:
// real synthesis over a prerecorded track, and an actual way to trigger it.
//
// NOT covered here (judge at the crit, not in this file):
//   - "expressive... two players sound different"
//   - "a stranger can play it uninstructed"
//   - "no way to play it wrong — no score, no fail state"
//   - "deployed and live by the cutoff" — that's /ship and /preflight, not a
//     unit test against this working copy
const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files();
const htmlFiles = shipped.filter((path) => path.endsWith(".html"));
const jsFiles = shipped.filter((path) => path.endsWith(".js"));

// Astro inlines a page's <script> into the HTML itself while it's small
// (astro.config.mjs raises the inline limit for exactly this); once the
// synth code grows past that it lands in its own file under dist/. Reading
// both means this test survives that switch instead of quietly going blind.
const scriptSources = htmlFiles
  .map((path) => readFileSync(path, "utf8"))
  .concat(jsFiles.map((path) => readFileSync(path, "utf8")))
  .join("\n");

describe("instrument: live synthesis, not playback", () => {
  it("ships no prerecorded audio or video track", () => {
    for (const path of htmlFiles) {
      const doc = new JSDOM(readFileSync(path, "utf8")).window.document;
      for (const el of doc.querySelectorAll("audio, video")) {
        const hasSrc =
          el.hasAttribute("src") || el.querySelector("source[src]") !== null;
        expect(
          hasSrc,
          `${path} plays back a track instead of synthesising sound live`,
        ).toBe(false);
      }
    }
  });

  it("uses the Web Audio API to generate sound", () => {
    expect(
      /AudioContext/.test(scriptSources),
      "no AudioContext found — the brief asks for sound made live in the page",
    ).toBe(true);
    expect(
      /OscillatorNode|createOscillator|AudioBufferSourceNode|createBufferSource/.test(
        scriptSources,
      ),
      "no oscillator or buffer source found — that's what actually produces the sound",
    ).toBe(true);
  });
});

describe("instrument: something to play", () => {
  it("has a control a player can act on, not just navigation", () => {
    const home = htmlFiles.find((path) => path.endsWith("index.html"));
    expect(home, "no index.html in dist/").toBeTruthy();
    const doc = new JSDOM(readFileSync(home!, "utf8")).window.document;

    const controls = doc.querySelectorAll(
      'button, [role="button"], [tabindex], input, canvas, svg',
    );
    const outsideNav = Array.from(controls).filter((el) => !el.closest("nav"));
    expect(
      outsideNav.length,
      "no playable surface found outside the nav — a stranger needs something to act on",
    ).toBeGreaterThan(0);
  });
});
