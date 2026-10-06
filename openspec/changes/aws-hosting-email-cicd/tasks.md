Work on branch `feature/aws-hosting`. Tests are written first for every code task. Run `npm run lint`
before each commit. Check in with the user at the end of each phase.

## 1. Phase 1 — Prerequisites and discovery (operator + read-only)

- [ ] 1.1 User configures an AWS CLI profile (SSO or admin user with MFA) for account 568402999432 and
      confirms with `aws sts get-caller-identity`; enable root MFA and a cost budget alarm
- [ ] 1.2 (mail provider, DMARC, Cloudflare plan answered 2026-10-05) User answers the rest of Open Questions 1–6 in `design.md` (quote recipients, mail provider, Cloudflare
      plan, www usage, repo visibility)
- [x] 1.3 Discovery (read-only): `dig` NS/MX/TXT/`_dmarc` for the domain, list current Cloudflare records,
      and record how apex traffic reaches Forky today; save the output to `plan/dns-baseline.md`
- [x] 1.4 (filed 2026-10-05 via CLI, status PENDING, transactional, website stitchesncolorstudio.com) User files the SES production-access request in `us-east-1` (use case: transactional replies to
      a website quote form) and verifies the owner address meanwhile
- [x] 1.5 (Cloudflare token done and verified 2026-10-05: one zone only, DNS+WAF+Settings+Single Redirect Edit; Turnstile widget `sncs-contact` created 2026-10-05, site key 0x4AAAAAAFOlv7DmaStSQxTF (public); secret goes in infrastructure/.env as TURNSTILE_SECRET then SSM after the Phase 3 apply) User creates a scoped Cloudflare API token (Zone DNS edit, Zone Rulesets edit, this zone only)
      and a Turnstile widget; token goes in git-ignored `infrastructure/.env`
- [ ] 1.6 Record the baseline cache-header behavior of the live Forky site for parity checks later

## 2. Phase 2 — Terraform bootstrap and hosting stack

- [x] 2.1 Add `infrastructure/` skeleton, `.gitignore` entries for `.env` and state, README
- [x] 2.2 Bootstrap root: state bucket (versioned, encrypted, public access blocked, `use_lockfile`),
      GitHub OIDC provider, `sncs-gha-plan` and `sncs-gha-release` roles with dual-format trust
- [x] 2.3 (bootstrap and main-root tests done and mutation-checked) Write the plan-assertion tests (no WAF, no public bucket policy, no `*` principal, no apex
      MX/TXT managed, no `AdministratorAccess`) and see them fail against an empty root
- [x] 2.4 Main root: private S3 bucket with versioning and 30-day noncurrent expiry, OAC, CloudFront
      distribution, SPA-fallback CloudFront Function (not custom error responses), response headers policy
- [ ] 2.5 `terraform fmt`, `validate` clean (done); `tflint` not installed yet; commit
- [x] 2.6 (bootstrap and main root applied 2026-10-05, 12 resources each, 0 destroyed; main at duvf4vsqh9386.cloudfront.net) Operator applies bootstrap with admin credentials; main root applied with a saved plan after
      reviewing it; confirm `0 to destroy`
- [x] 2.7 (verified 2026-10-05: / and deep path 200, immutable/no-cache/86400 headers, security headers, 301 to HTTPS, br+gzip, missing file 403, direct S3 403) Upload a build manually once and verify on the CloudFront domain: `/`, deep path, cache headers

**Check in with user before Phase 3.**

## 3. Phase 3 — Contact backend (test-driven)

- [x] 3.1 Shared request type and field limits file imported by form and handler by relative path
- [x] 3.2 Write handler tests first: validation matrix, oversize body, wrong content type, Turnstile
      missing/invalid, honeypot, owner-send failure → 502 and no auto-reply, auto-reply failure → 200,
      CR/LF header injection, HTML escaping, auto-reply contains no free text, logs contain no PII
- [x] 3.2a Assert against the composed raw message, not SDK call counts
- [x] 3.3 Implement `lambda/contact/` (TypeScript, esbuild bundle, arm64) until tests pass
- [x] 3.4 Contract test: form validator and handler validator agree on a shared sample set
- [x] 3.5 Write form tests first (stubbed `fetch`): success, 400 field errors, 502 with tap-to-call phone
      link, network failure, double submit, Turnstile token missing, input preserved on failure
- [x] 3.6 Implement `Contact.tsx` changes: real submit, loading state, Turnstile widget, honeypot input,
      remove the "demo form" disclaimer; keep Material 3 styling and the existing look
- [x] 3.7 Terraform: HTTP API, Lambda (reserved concurrency only when the quota allows; account limit is 10 so it is unset, log retention), `/api/*` CloudFront behavior,
      stage throttling, SSM parameter with placeholder value and `ignore_changes`
- [x] 3.8 `npm run lint`, format, full test suite, build; commit

## 4. Phase 4 — Email identity, alarms and Cloudflare

- [x] 4.1 (applied 2026-10-05) Terraform: SES domain identity, Easy DKIM, custom MAIL FROM on `bounce.` (not `mail.`, which is a Google CNAME), configuration set, with all
      records created in the Cloudflare zone (DNS-only); confirm the plan changes no apex MX/TXT
- [x] 4.2 (applied 2026-10-05, cert ISSUED, alias attached) Terraform: ACM certificate with Cloudflare validation records; attach the alias only after
      issuance; do not create the apex record yet
- [x] 4.3 (applied; SNS email subscription awaiting the owner confirmation click) Terraform: SNS topic + owner subscription, alarms for Lambda errors, API 5xx, SES bounce rate
- [x] 4.4 (applied and live-verified: www 301, scanner paths 403, US-only rule kept) Terraform: Cloudflare Managed Ruleset, rate-limit rule, scanner-path rule, `www` redirect,
      Full (strict); document any rule the free plan cannot manage, with a verification command
- [x] 4.5 (done 2026-10-05 after the Phase 3 apply: version 2, length verified, not in state) Operator sets the Turnstile secret with `aws ssm put-parameter`; confirm it is absent from state
- [ ] 4.6 (DKIM and MAIL FROM verified SUCCESS 2026-10-05; SES case 179122544900542: AWS asked for more info, user replied 2026-10-05, awaiting a decision; the API status still reads DENIED) Apply; verify DKIM and MAIL FROM report SUCCESS; confirm the SES production request is granted
- [x] 4.7 (done 2026-10-05, all three simulator sends accepted) SES mailbox-simulator sends (`success@`, `bounce@`, `complaint@`) through the handler path
- [ ] 4.8 One real submission through the CloudFront domain; confirm owner mail and customer auto-reply
      both arrive and render correctly

**Check in with user before Phase 5.**

## 5. Phase 5 — Release pipeline

- [x] 5.1 (plan-guard, deploy order/cache headers and smoke are TypeScript with 42 mutation-checked tests; tf-plan/apply are bash) Pipeline steps as scripts under `scripts/` (build, plan-guard, deploy, smoke) so they can run
      locally if Actions is unavailable; tests for plan-guard against fixture plans (create, update,
      destroy, replace)
- [x] 5.2 (written; no plan on PRs because the repo is public and a plan needs the Cloudflare token, the real plan runs in the release workflow before approval) Extend `ci.yml`: Lambda tests, `terraform fmt`/`validate`/`test`
- [x] 5.3 (written; saved plan travels via the private state bucket `plans/`, not artifacts, because artifacts on a public repo are world-readable; needs a bootstrap apply) `release.yml`: verify → plan (+ guard) → approval via `production` environment → apply saved
      plan → deploy (assets, rest, `index.html` last, invalidate `/index.html` and `/`) → smoke
- [x] 5.4 (done 2026-10-05: bootstrap applied for plans/ access; envs production (owner reviewer) and release-plan, both limited to the release branch; token secret in both; site key variable in production; ruleset 24528591 locks release to the admin) Configure GitHub: `production` environment with the owner as required reviewer, environment
      variable `VITE_TURNSTILE_SITE_KEY`, restrict who can push `release`
- [x] 5.5 (run 37369511790 on 2026-10-05: verify, plan 0/1/0, owner approval, apply, deploy and smoke all green; independently re-checked on duvf4vsqh9386.cloudfront.net; GitHub Actions outage caused two stalled attempts before) Dry run: push the feature branch to `release` (user runs the push), review the plan, approve,
      confirm smoke checks pass on the CloudFront domain
- [x] 5.6 (run 37396527849 on a throwaway branch: release role refused with Not authorized to perform sts:AssumeRoleWithWebIdentity, plan role control worked and could not write; branch deleted) Prove a denied path: assume the release role from a non-`production` context and confirm denial
- [x] 5.7 (run 37396652361 deployed a marker meta tag, run 37397357382 re-released the previous commit and the tag was gone; both went through the production approval; throwaway branch deleted) Prove rollback: release the previous commit and confirm the older build serves

## 6. Phase 6 — Cutover and retirement

- [x] 6.1 (passed 2026-10-05) Final pre-cutover checks on the CloudFront domain and via `curl --resolve` for the real
      hostname: site, hashed asset header, deep path, `/api/contact` invalid body → 400
- [x] 6.2 (matched baseline 2026-10-05) Confirm the apex `A` record still matches `plan/dns-baseline.md` (value, proxied flag) for revert
- [x] 6.3 (done 2026-10-05 by one Cloudflare API PUT on the apex record, A to proxied CNAME duvf4vsqh9386.cloudfront.net; SMOKE_URL variable set to the real domain; revert = A 99.26.214.190 proxied) Cutover: change the apex record to the CloudFront domain, proxied (Terraform apply or one edit)
- [ ] 6.4 Verify on the real hostname: HTTPS, cache headers, `www` redirect, scanner path → 403, one real
      form submission with both emails; user confirms
- [ ] 6.5 With explicit user confirmation at that moment: stop and remove the Forky `Sncs-Web` container,
      Traefik labels, compose entry and local image; leave `~/docker/websites/Sncs/` untouched
- [ ] 6.6 Confirm the site still serves and the existing `@stitchesncolorstudio.com` mailboxes still
      receive mail

## 7. Phase 7 — Wrap-up

- [ ] 7.1 Update `claude.md`, `README.md` and `plan/plan.md`: hosting, pipeline, rollback, secrets
      locations, Cloudflare manual steps, cost; mark the superseded Docker/Forky notes
- [ ] 7.2 Add dependabot coverage for `infrastructure/` (Terraform providers) and `lambda/contact/`
- [ ] 7.3 Open the PR to `main` only after the release is live and verified; run `/opsx:archive`
- [ ] 7.4 Update project memory with the final state and gotchas found
