## Context

Sncs is a Vite + React 19 static site with hash routing. It is live at stitchesncolorstudio.com from an
nginx container on Forky (Traefik, image loaded by `docker save|load`). CI (`.github/workflows/ci.yml`)
runs lint, format, test, build and a docker smoke test on PRs but deploys nothing. The Contact page
validates client-side and then pretends to send.

The target is the new AWS account 568402999432. DNS for the domain is in Cloudflare and stays there.
Other mailboxes on the domain (for example `jeff@stitchesncolorstudio.com`) already exist at a provider
we have not yet identified, so nothing in this change may alter the apex MX or apex SPF.

Same author, same patterns as VOFbash (Cloudflare-managed ACM validation, SES domain identity in
Terraform, single environment) and CouncilAnchor (free-tier Cloudflare rules, no AWS WAF). Reuse the
patterns; do not extract a shared module (fewer than three consumers, and different repos).

## Goals / Non-Goals

**Goals**

- Site served from AWS with behavior at least equal to today's nginx (cache headers, deep-path fallback).
- Quote requests reach the shop's inbox reliably; the customer gets an immediate acknowledgement.
- Release is one approved action, with no long-lived AWS credentials anywhere.
- Everything reproducible from Terraform; the stack is cheap enough to ignore.

**Non-Goals**

- Storing submissions (no database, no admin UI). The owner's inbox is the system of record.
- Inbound mail handling or moving the existing mailboxes.
- Real gallery photos, font self-hosting, logo swaps (separate changes).
- A staging environment. One environment, as with VOFbash; a preview is the raw CloudFront domain
  before cutover.
- Content-Security-Policy enforcement (see Decision 4).

## Decisions

### 1. Hosting: private S3 + CloudFront, `us-east-1`, single region

The site is static, so S3 + CloudFront is the cheapest and simplest option and has no servers to patch.
ECS/Fargate or App Runner would cost an order of magnitude more to serve the same files. Amplify
Hosting is viable but hides the pieces we want in Terraform and would be a second pipeline. `us-east-1`
is required for the CloudFront ACM certificate and is a supported SES region, so one region covers
everything. The bucket is private with origin access control, versioning on (30-day noncurrent expiry)
so a bad deploy can be rolled back by object version.

Parity with `docker/nginx.conf`:

- Hashed `/assets/index-*` → `Cache-Control: public, max-age=31536000, immutable`.
- Unhashed brand images under `/assets/` → `max-age=86400`.
- `index.html` → `no-cache`.
- Extensionless paths → `/index.html` through a CloudFront Function on the site behavior (not distribution-wide
  custom error responses, which would also rewrite `/api/*` errors into `index.html`). Routing is hash-based, so
  this is only a safety net for stray deep links. A missing file with an extension stays an error.

Cache headers are set as object metadata at upload time (two `s3 sync` passes with different
`--cache-control`), not in CloudFront, so S3 is the single source of truth and the behavior is testable
against the bucket.

### 2. Domain and edge: Cloudflare proxied in front of CloudFront

DNS stays in Cloudflare (user decision) and is proxied so the free-tier firewall can run, matching
CouncilAnchor. VOFbash left its apex DNS-only; here the firewall is the point, so it is proxied.
Consequences to handle:

- Cloudflare SSL/TLS mode must be **Full (strict)**; CloudFront presents the ACM certificate.
- The ACM validation CNAMEs are created by Terraform and must be **DNS-only**.
- The apex uses a proxied CNAME to the CloudFront domain (Cloudflare flattens it). `www` redirects to the
  apex with a Cloudflare redirect rule, the same approach as VOFbash's `domain-redirects`.
- Cloudflare must not cache HTML: no "Cache Everything" rule; origin `Cache-Control` is honored.
- Free-tier rules (as in CouncilAnchor): Managed Ruleset, per-IP rate limit, scanner-path block. The
  free plan allows one rate-limit rule with a 10-second window, so the rate limit is zone-wide and cannot
  be stricter for `/api/contact`. The real per-endpoint abuse controls therefore live in AWS and the
  application (Decision 5). Verify the current free-plan limits when implementing; this is from memory
  of CouncilAnchor's setup, not re-checked.
- Cloudflare rules are managed in Terraform (cloudflare provider) where the provider and the free plan
  allow it. CouncilAnchor configured them in the dashboard and had to re-verify them by hand after zone
  changes; Terraform removes that. If a rule type cannot be managed on the free plan, document it as a
  manual step with a verification command rather than leaving it implicit.
- The Cloudflare API token comes only from `CLOUDFLARE_API_TOKEN` in the environment (local
  `infrastructure/.env`, git-ignored; GitHub environment secret in CI). Never in HCL, tfvars or state.
  Scope: Zone DNS edit, Zone Rulesets edit, on this one zone.

### 3. Contact backend: HTTP API + Lambda on the same origin

`/api/*` is a second CloudFront behavior pointing at an API Gateway HTTP API, so the browser calls
`/api/contact` on the site's own origin: no CORS, and Cloudflare rules can match the path. Lambda
function URLs behind CloudFront OAC were considered (one fewer service) but POST bodies need a
payload-hash header the browser cannot produce; HTTP API costs about $1 per million requests, which is
irrelevant here, and avoids that failure mode.

- Runtime: Node.js on the latest Lambda runtime available at implementation time (expected `nodejs24.x`;
  verify), arm64, bundled with esbuild into one file in CI and zipped by Terraform.
- Language: TypeScript. The request type and field limits live in one file imported by both the React
  form and the handler by relative path (no package; Coding Defaults). This is the only code shared and
  it prevents the client and server validators drifting.
- Controls: API Gateway stage throttling (low steady rate, small burst), a Lambda reserved-concurrency cap where the quota
  allows (this account's limit is 10, and AWS requires 10 to stay unreserved, so a cap is impossible until
  the quota is raised; throttling alone bounds concurrency meanwhile), request body size cap, and `Content-Type: application/json` required.
- Turnstile: the browser sends the Cloudflare Turnstile token; the handler verifies it server-side before
  doing anything else. Plus a honeypot field (hidden input; a filled value returns a fake success and
  sends nothing). Turnstile is free and invisible/managed; the honeypot costs nothing and catches
  unsophisticated bots when Turnstile is unavailable.
- The Turnstile **secret** is an SSM Parameter Store SecureString (free tier, versus $0.40/month for
  Secrets Manager). Terraform creates the parameter with a placeholder and `ignore_changes` on the value;
  the real value is set once out-of-band with `aws ssm put-parameter`. This keeps it out of state and
  avoids CouncilAnchor's secrets-drift destroy trap. The site key is public and is passed to the Vite
  build as `VITE_TURNSTILE_SITE_KEY` from a GitHub environment variable.

### 4. Security headers, no CSP yet

A CloudFront response headers policy sets HSTS (one year, no `includeSubDomains`/`preload`),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
strict-origin-when-cross-origin`. No enforced CSP: the site loads Google Fonts and now Turnstile, and an
unvalidated CSP that misses one breaks the page (CouncilAnchor's rule). Report-only first is a later
change.

### 5. Email: SES domain identity, two messages, no storage

Sending identity is the domain `stitchesncolorstudio.com` with Easy DKIM (3 CNAMEs, DNS-only) and a
custom MAIL FROM subdomain `bounce.stitchesncolorstudio.com` (its own MX and SPF TXT). The subdomain gives
SPF alignment for SES without editing the apex SPF, which the existing mailbox provider owns. Apex MX
and apex SPF are not touched. Discovery (2026-10-05, `plan/dns-baseline.md`): mail is Google Workspace, SPF is
`include:_spf.google.com`, and DMARC already exists as `p=quarantine; sp=reject`. The `mail.` name is
already a CNAME to Google webmail, which is why the MAIL FROM subdomain is `bounce.`. SES mail is From
the apex, so DMARC passes through DKIM alignment with Easy DKIM; no DMARC record is added or changed.

Messages, sent from `quotes@stitchesncolorstudio.com` with display name "Stitches-n-Color Studio":

1. **Owner notification** → the configured recipient list. `Reply-To` is the customer, so replying goes
   straight to them. Subject carries the service and customer name. All fields included.
2. **Customer auto-reply** → the customer. `Reply-To` is the shop inbox. Fixed template that thanks them,
   states the shop's hours and phone, and echoes only the service and quantity, **not** the free-text
   message. Reason: the form lets anyone make the shop's domain mail an arbitrary address, so the
   auto-reply must not carry attacker-chosen prose.

Order and failure semantics:

- Owner notification is sent first. If it fails, the endpoint returns 502 and sends no auto-reply; the
  form keeps the user's input and shows an error with the shop phone number.
- If the owner notification succeeds and the auto-reply fails, the endpoint still returns 200 and logs the
  failure. The lead is delivered; a missing acknowledgement is not worth a retry from the customer.
- Names and subjects have CR/LF and control characters stripped to prevent header injection; HTML bodies
  escape every interpolated value. The emails are multipart text + HTML.
- Logging records request id, service, outcome and error class. It does **not** log the message body,
  phone number or full email address (PII).
- Nothing is persisted. If SES is down the lead is lost, which is why failure is loud (502 plus the phone
  number) rather than silent. An SQS queue or DynamoDB table would remove that risk at the cost of two
  more resources and a retry path; revisit if volume justifies it.

**SES sandbox is a hard prerequisite.** A new account can only send to verified addresses, at 200/day.
The owner notification works in the sandbox if the recipient is verified; the customer auto-reply does
not. A production-access request must be filed early (it usually takes about a day) and must be granted
before cutover. Its use-case text should describe transactional replies to a website form.

An SES configuration set records bounces and complaints. A CloudWatch alarm on Lambda errors, on API
5xx, and on SES bounce rate notifies an SNS topic that emails the owner. This is the whole monitoring
story; it is deliberately small.

### 6. Terraform layout and state

Single root module at `infrastructure/terraform/` with one `bootstrap/` root applied once by an
operator with admin credentials: state bucket (`sncs-tfstate-568402999432`, versioned, encrypted, public
access blocked, S3-native locking via `use_lockfile`, so no DynamoDB table), the GitHub OIDC provider,
and the two CI roles. The main root is applied by the pipeline after that. Resource naming prefix `sncs-`.

Same-repo infrastructure (not a separate infra repo as CouncilAnchor has): one site, one owner, and
splitting would double the PR and branch overhead for a stack this size.

### 7. Release pipeline: GitHub Actions + OIDC, `release` branch, approval gate

The existing `ci.yml` stays the PR gate. A new `release.yml` runs on a push to the `release` branch:

1. **verify**: lint, format check, tests, build, Lambda tests, `terraform fmt -check` and `validate`.
2. **plan**: assume the read-only role, `terraform plan -out`, upload the plan and post a summary.
   A script-enforced guard fails the run if the plan destroys or replaces any resource (CouncilAnchor's
   `plan-guard.sh`). Intentional destroys are done by an operator, never by the pipeline.
3. **approve**: GitHub environment `production` with the owner as required reviewer.
4. **apply** the saved plan, then **deploy**: sync hashed assets, sync the rest, upload `index.html`
   last, invalidate `/index.html` and `/` only.
5. **smoke**: `GET /` returns 200 and contains `<div id="root">`; a hashed asset returns the immutable
   header; `POST /api/contact` with an intentionally invalid body returns 400 JSON. That last check
   proves CloudFront → API Gateway → Lambda is live without sending real email.

`main` is merged only after the release is live and verified, per the repository rule that main equals
released prod. The operator promotes with `git push origin <feature-branch>:release`, run by the user
(`!`), since pushing to the release branch is a prod action.

Two roles, both assumed via OIDC:

- `sncs-gha-plan`: read-only, plus state read/lock. Trust: any ref in `TestPilot23/Sncs`.
- `sncs-gha-release`: apply + deploy. Trust: only the `production` environment subject.

Neither is `AdministratorAccess`. The release role gets service-scoped permissions (S3, CloudFront, ACM,
API Gateway, Lambda, SES, SNS, CloudWatch, SSM, IAM limited to `sncs-*` roles and policies). The trust
condition must match both GitHub `sub` formats, the classic `repo:TestPilot23/Sncs:*` and the
immutable-ID form `repo:TestPilot23@<id>/Sncs@<id>:*`; CouncilAnchor's first deploy of a new repo failed
on exactly this. Confirm with CloudTrail if `AssumeRoleWithWebIdentity` is denied.

Rollback: push the previous known-good commit to `release` and approve; versioned S3 objects allow a
manual restore if the pipeline itself is the problem.

Deploys happen only from CI. There is no local deploy script, so a local build with a local `.env` cannot
reach prod (the CouncilAnchor localhost-outage failure mode).

### 8. Cutover and Forky retirement

Everything is built and verified on the raw `*.cloudfront.net` domain first, and the ACM validation and
SES DKIM records are created ahead of time because they do not affect live traffic. Verification on the
real hostname before DNS changes uses `curl --resolve` against a CloudFront edge IP.

Cutover replaces the apex record: today it is a proxied `A` to a home IP (no tunnel), and an `A` cannot
become a `CNAME` in place, so it is delete-then-create with a gap of seconds. The pipeline destroy guard
refuses this, so an operator performs it, with a saved plan. Reverting recreates the original `A`
(recorded in `plan/dns-baseline.md`); Forky still serves, so rollback is minutes. The wildcard `*` record
also points at Forky and is left alone. After the user confirms the live
site and a real form submission (owner mail and auto-reply both arrive), the Forky retirement is
done in the same session per the user's instruction: stop and remove `Sncs-Web`, remove its Traefik
labels and the compose entry, remove the local image. The WordPress database dump and old volumes under
`~/docker/websites/Sncs/` are **kept**; they are not part of this retirement and need a separate decision.
This step is destructive on prod infrastructure, so it is confirmed at the moment it happens and not
pre-authorized by this document.

## Testing strategy (no echo chambers)

- **Handler**: unit tests assert on the _composed raw message_ (headers, recipients, Reply-To, escaped
  body) for hostile inputs: CR/LF in name, HTML in message, oversized fields, missing Turnstile, honeypot
  filled, owner-send failure (expect 502 and no auto-reply), auto-reply failure (expect 200). Mocking
  `SESv2Client` alone would only restate the implementation, so assertions are about what would be sent,
  not which SDK method was called.
- **Contract**: a test fixes the shared request type and verifies both the React form's payload and the
  handler's validator accept and reject the same sample inputs.
- **Frontend**: form tests stub `fetch` and cover success, 400 field errors, 502 error with phone number,
  network failure, double-submit prevention, and Turnstile-token-missing.
- **Infrastructure**: `terraform fmt`, `validate`, `tflint`; a plan test asserts no WAF, no public bucket
  policy, no `*` principal, and that the apex MX/SPF records are not managed.
- **Live, once, at build time (not per release)**: send through the SES mailbox simulator addresses
  (`success@`, `bounce@`, `complaint@simulator.amazonses.com`) to prove delivery paths without hurting
  reputation, then one real submission to the owner inbox. Per-release live email tests are not run;
  they are suggested only when a change touches email.

## Risks / Trade-offs

- **SES sandbox / production access delay** blocks the auto-reply and cutover. File on day one.
- **Unknown existing mail provider**: mitigated by never editing apex MX/SPF and by the discovery task.
- **Lead loss if SES fails**: accepted for now, made loud, alarmed.
- **Double CDN** (Cloudflare → CloudFront) adds a hop and a second cache layer; accepted because the
  firewall was a stated requirement and HTML is not cached at Cloudflare.
- **Free-plan rate limit is zone-wide**: abuse control for the form relies on Turnstile, API throttling and
  reserved concurrency instead.
- **Auto-reply abuse**: bounded by Turnstile, throttling, fixed template with no free text, and SES
  sending limits; no per-recipient dedupe (would need storage).
- **Pipeline role breadth**: apply permissions are inherently powerful. Mitigated by environment-only
  trust, reviewer approval, service-scoped policy and the destroy guard.
- **GitHub Actions minutes/quota**: CouncilAnchor was blocked by org billing and storage limits several
  times. This pipeline is small, but if blocked, the fallback is an operator running the same scripts
  locally with the plan role, which is why the steps live in scripts, not only in workflow YAML.

## Migration Plan

1. Operator prerequisites (AWS profile, Cloudflare token, Turnstile keys, SES production request,
   owner address, DNS/MX/DMARC discovery).
2. Bootstrap root, then main root, via the pipeline from a branch.
3. Build and verify on the CloudFront domain, including one real submission.
4. Cutover DNS, verify the live hostname, confirm with the user.
5. Retire Forky `Sncs-Web` (confirmed at the time).
6. Merge to `main` only after the release is live and verified.

## Open Questions

1. Who receives quote requests (address or list)? Needed before the first email test.
2. ~~Mail provider / DMARC~~ Answered: Google Workspace, DMARC `p=quarantine` already present.
3. ~~Cloudflare plan~~ Answered: Free. Still open: is the Turnstile widget created under the same account?
4. What local AWS profile or SSO login should be used for account 568402999432? None of the five
   existing profiles maps to it.
5. Is `www.stitchesncolorstudio.com` currently in use, and should it redirect to the apex?
6. Is the repo `TestPilot23/Sncs` private? This affects Actions minutes and the OIDC subject format.
