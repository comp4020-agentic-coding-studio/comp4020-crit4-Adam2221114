import { defineConfig } from "astro/config";

// The deployed site lives under a path: this org's Pages are served at
// comp4020-agentic-coding-studio.github.io/<repo>/, so `base` has to match
// this repo's exact name or every asset 404s on the live URL while still
// working locally. See CLAUDE.md's "The stack is swappable" section.
export default defineConfig({
  base: "/comp4020-crit4-Adam2221114/",
  // Flat file output (index.html, ...) keeps every page at the same
  // directory depth, so internal links can stay plain-relative and work
  // unchanged under any serving root — the local `dlx linkinator ./dist`
  // check has no subpath, the real GitHub Pages URL does, and relative
  // links resolve correctly either way.
  build: {
    format: "file",
  },
  // Astro only inlines a page's <script> when its bundled size is under
  // Vite's assetsInlineLimit (default 4kb) — past that it's emitted as an
  // external file referenced with the `base` path above, which 404s when
  // linkinator crawls the local dist/ (no comp4020-crit4-Adam2221114/
  // subfolder locally, even though it resolves fine on GitHub Pages). This
  // page is a single self-contained script with no code-splitting to gain
  // from an external file, so raise the limit well past its size to keep it
  // inlined and the local link check meaningful.
  vite: {
    build: {
      assetsInlineLimit: 1024 * 1024,
    },
  },
});
