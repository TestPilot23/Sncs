# Sncs — Stitches-n-Color Studio

Marketing site for Stitches-n-Color Embroidery Studio (Florissant, MO — custom embroidery,
screen printing, digitizing, heat transfers). Ported from the claude.ai/design project "Sncs"
(`Stitches-n-Color Studio.html`).

## Stack

- Vite 8 + React 19 + TypeScript, no router dependency (hand-rolled hash routing in
  `src/hooks/useHashRoute.ts` so the site works on any static host)
- Vitest + Testing Library (jsdom) — specs live in `tests/`
- oxlint (`npm run lint`) + Prettier (`npm run format`, 100-char width)

## Commands

- `npm run dev` — dev server
- `npm test` — full regression suite
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the production build

## Layout

- `src/data/content.ts` — ALL site copy (services, testimonials, gallery, FAQs, nav). Content
  edits go here, never in components.
- `src/components/` — shared UI (Nav, Footer, Btn, Peek mascot, icons, blocks)
- `src/pages/` — Home, Services, Gallery, About, Contact
- `src/styles/site.css` — the whole design system; brand tokens in `:root`
- `public/assets/` — brand images served as-is

## Design notes

- The design's "tweaks panel" was intentionally dropped; its approved defaults are baked into
  `site.css` (`--accent` lime / `--accent-2` purple, Fredoka/Nunito, cream bg, radius tokens
  from the 18px setting).
- Gallery tiles are striped `Ph` placeholders by design — swap for real photos when available.
- Contact form is client-side demo only; no backend yet (future phase).

## Known gaps

- `logo-nav.png` and `logo-circle.png` couldn't be exported from the design project (files
  exceed the design MCP's 256 KiB read cap). Nav/favicon currently use `logo-script.png` and a
  `stitches.png`-derived favicon. Drop the originals into `public/assets/` and update
  `src/components/Nav.tsx` + `index.html` when available.
