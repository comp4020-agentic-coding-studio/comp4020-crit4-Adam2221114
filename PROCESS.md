# Process overview

## What I built

I built **DECK**, a browser-based two-deck Web Audio instrument. Players can manipulate pitch, filter, level and sound character on each deck, then mix between Deck A and Deck B with a crossfader. The goal was to make the page feel playable rather than like a webpage explaining music.

## The moments that mattered

The first important step was getting a complete playable version working before spending time on visual polish. I implemented the two decks, persistent Web Audio synthesis, jog controls, FILTER, levels, pads and crossfader, then kept that version as a recoverable baseline. This meant later design changes could be compared against a known working instrument rather than changing everything at once.

[`515482f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-Adam2221114/commit/515482f)

The bigger change came from browser playtesting. Although `pnpm check` passed, the real interface exposed problems the automated checks did not: FILTER did not feel like a real rotary control, the visual style felt dated, and the mobile layout overflowed and clipped controls. Instead of shrinking the desktop interface, I redesigned mobile around Deck A/B switching, rebuilt FILTER as a full-circle rotary interaction, and simplified the visual system.

> “The mobile layout is currently broken and unusable. Do not solve this by simply shrinking the entire desktop controller.”

I accepted the redesign after checking it at both `1920×1080` and `390×844`, testing the controls, and checking for overflow and console errors.

The redesign is captured in the change from [`515482f...0d67240`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-Adam2221114/compare/515482f...0d67240).
