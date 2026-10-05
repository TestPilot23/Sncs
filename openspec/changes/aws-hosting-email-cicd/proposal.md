## Why

Sncs is served from a single nginx container on Forky (a home server) whose image is moved by
`docker save|load`. There is no registry, no deploy automation, and the Contact page is a demo form
that discards every quote request. A customer who fills it in believes they have reached the shop and
has not. Moving to the dedicated AWS account (568402999432) removes the home-server dependency from a
revenue-facing site, and wiring the form to email makes the site capture leads.

## What Changes

- Host the built static site in a private S3 bucket behind CloudFront (origin access control), in
  `us-east-1`, replacing the Forky `Sncs-Web` container.
- Serve `https://stitchesncolorstudio.com` from CloudFront with an ACM certificate. DNS stays in
  Cloudflare and is managed from Terraform; the zone is proxied and gets the same free-tier firewall
  rules CouncilAnchor uses (managed ruleset, per-IP rate limit, scanner-path block).
- Add a contact-form backend: `POST /api/contact` (API Gateway HTTP API → Lambda, same origin through a
  CloudFront behavior) that validates the request, emails the quote to the shop through SES, and sends
  the customer an auto-reply.
- Verify `stitchesncolorstudio.com` as an SES sending identity (DKIM + custom MAIL FROM) without
  touching the apex MX or SPF, so the existing `@stitchesncolorstudio.com` mailboxes keep working.
- Replace the demo form's client-side-only submit with a real request, real error handling, and
  spam controls (honeypot + Cloudflare Turnstile); remove the "demo form" disclaimer.
- Add a GitHub Actions release pipeline using OIDC (no long-lived AWS keys): push to a `release`
  branch → build, test, manual approval, sync to S3, invalidate CloudFront, smoke-check the live URL.
- Manage all AWS and Cloudflare resources in Terraform in this repo (single environment).
- Cut over DNS from Forky to CloudFront, then retire the Forky container, Traefik labels and compose
  entry immediately after live verification.
- Initialise OpenSpec in this repo.

## Capabilities

### New Capabilities

- `static-site-hosting`: private S3 origin, CloudFront distribution, cache and security-header policy,
  client-route fallback; parity with the current nginx behavior.
- `custom-domain-edge`: apex and `www` on Cloudflare, ACM certificate, Terraform-managed records,
  Cloudflare firewall rules, credentials handling.
- `contact-quote-email`: contact endpoint, validation, owner notification, customer auto-reply, SES
  sending identity, abuse controls, failure behavior.
- `release-pipeline`: GitHub OIDC roles, CI gates, approval-gated deploy from `release`, Terraform
  plan/apply, post-deploy verification, rollback.

### Modified Capabilities

None. This repo has no existing specs.

## Impact

- **Code:** `src/pages/Contact.tsx` (real submit, error and loading states, Turnstile widget),
  `tests/` (form behavior against a stubbed endpoint), new `lambda/contact/`, new `infrastructure/`
  Terraform, new `.github/workflows/` deploy and infra workflows. `Dockerfile`, `compose.yaml` and
  `docker/nginx.conf` stay for local use only after cutover.
- **Systems:** new AWS account resources (S3, CloudFront, ACM, API Gateway, Lambda, SES, IAM, CloudWatch,
  SNS); Cloudflare zone records and rules; retirement of the Forky `Sncs-Web` container and Traefik
  routing.
- **Cost:** expected under about $2/month (S3/CloudFront/Lambda/API Gateway inside or near free tier,
  SES at $0.10 per 1,000 messages, Terraform state bucket pennies). No AWS WAF — it was the dominant
  cost on CouncilAnchor and is replaced by Cloudflare's free tier.
- **Prerequisites outside this repo:** a working AWS CLI profile for 568402999432, a scoped Cloudflare API
  token for the zone, a Cloudflare Turnstile site key, an SES production-access request (new accounts
  start in the sandbox and can only email verified addresses), and the shop's quote-recipient address.
- **Risk:** DNS cutover is the only moment of customer-visible risk; the plan keeps the Cloudflare
  record change a single revertible edit until Forky is retired.
