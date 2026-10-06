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
- `docker compose up -d --build` — SUPERSEDED (was the Forky nginx hosting, retired 2026-10-05); kept
  only for local preview on port 8087
- `npm run build:lambda` — bundle the contact Lambda to `lambda/contact/dist/index.cjs`; Lambda and
  pipeline-script tests run in the same `npm test`; their deps live in the root `package.json`

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

## Hosting, email and release (live since 2026-10-05)

- Hosting: private S3 bucket behind CloudFront (OAC), AWS account 568402999432, us-east-1. Cloudflare
  holds DNS (proxied): the apex is a CNAME to the CloudFront domain, `www` 301s to the apex. Never touch
  the apex MX/SPF/`google._domainkey` records (Google Workspace mail). Baseline in `plan/dns-baseline.md`.
- Contact form: `POST /api/contact` (CloudFront → HTTP API → Lambda in `lambda/contact/`). Cloudflare
  Turnstile + honeypot, then SES sends the owner mail to `quotes@stitchesncolorstudio.com` and a fixed
  auto-reply to the customer (auto-reply stays inert until SES production access is granted).
- Infrastructure: Terraform in `infrastructure/terraform/{bootstrap,main}`; see `infrastructure/README.md`.
  `bootstrap` is operator-applied; `main` is applied by the pipeline from a saved plan.
- Release: push to the `release` branch. GitHub Actions runs verify, then plan (a guard fails on any
  destroy/replace), then waits for approval in the `production` environment, then applies the saved plan,
  deploys (hashed assets, other files, `index.html` last), invalidates, and smoke-tests the real domain.
  Only the `production` environment can assume the `sncs-gha-release` role.
- Rollback: push the previous good commit to `release` (admin bypass of the branch ruleset) and approve;
  proven on 2026-10-05. DNS revert: recreate the apex `A` record from `plan/dns-baseline.md`.
- Secrets: Cloudflare token in git-ignored `infrastructure/.env` and the GitHub environment secrets;
  Turnstile secret in SSM Parameter Store (`aws ssm put-parameter`, never in Terraform state).
  Turnstile site key is a public GitHub variable.
- Cloudflare free plan: rules are managed in Terraform; anything the plan cannot manage is noted in
  `infrastructure/README.md`.
- Cost (estimate, not yet measured): about $1/month at this traffic; check the first bill.
- Retired: the Forky `Sncs-Web` container. The old WordPress dump and volumes remain in
  `~/docker/websites/Sncs/` on Forky.

## Known gaps

- `logo-nav.png` and `logo-circle.png` couldn't be exported from the design project (files
  exceed the design MCP's 256 KiB read cap). Nav/favicon currently use `logo-script.png` and a
  `stitches.png`-derived favicon. Drop the originals into `public/assets/` and update
  `src/components/Nav.tsx` + `index.html` when available.
