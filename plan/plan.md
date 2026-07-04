# Sncs — Design Import Plan (2026-07-02)

Import the "Stitches-n-Color Studio" design from claude.ai/design and implement it as a
production Vite + React + TS static site.

## Phase 1 — Site import (this branch: `feature/site-import`)

- [x] Scaffold Vite react-ts project, git init, feature branch
- [x] Import assets from design project (3 of 5 intact; see Known gaps in claude.md)
- [x] Port `site.css` with tweak defaults baked in
- [x] Port shared components (icons, Nav, Footer, Btn, Peek, blocks) to typed React
- [x] Port pages: Home, Services, Gallery, About, Contact
- [x] Hash routing + per-page titles
- [x] Regression tests: routing, gallery filter, FAQ accordion, contact form validation
- [x] Lint + format + build clean; verified rendering in headless Chrome
- [ ] Obtain full-size `logo-nav.png` / `logo-circle.png` from Jeff and swap in

## Phase 2 — Candidates (not started, discuss first)

- [ ] Real gallery photos to replace striped placeholders
- [ ] Contact form backend (email or quote-intake endpoint)
- [x] Dockerize (multi-stage build → nginx:alpine, compose on port 8087)
- [x] Deploy to Forky (2026-07-03): replaced Sncs WordPress stack; Traefik routes
      stitchesncolorstudio.com → Sncs-Web container; WP DB dumped to
      `~/docker/websites/Sncs/wordpress-backup/`, all old data/volumes retained
- [ ] CI to rebuild/redeploy image on release
- [ ] Self-host fonts if we want to drop the Google Fonts CDN
