## ADDED Requirements

### Requirement: Canonical Host Is Served Over HTTPS With an ACM Certificate

The site SHALL be served at `https://stitchesncolorstudio.com` from the CloudFront distribution with a
publicly trusted ACM certificate covering the apex. The certificate's DNS validation records SHALL be
created by Terraform in the Cloudflare zone, DNS-only, and the CloudFront alias SHALL NOT be attached
until the certificate is issued.

#### Scenario: Canonical host serves the site

- **WHEN** a browser requests `https://stitchesncolorstudio.com/`
- **THEN** it receives the site with no certificate warning

#### Scenario: Apply waits for validation

- **WHEN** Terraform is applied for the first time with the canonical host set
- **THEN** the certificate is issued before the distribution is updated to use it

### Requirement: The Zone Is Proxied and Uses Full (Strict) TLS

The apex record SHALL point at the CloudFront distribution and be proxied by Cloudflare, and the zone's
SSL/TLS mode SHALL be Full (strict). Cloudflare SHALL NOT cache HTML: no cache-everything rule exists
and origin `Cache-Control` is honored.

#### Scenario: Traffic passes through Cloudflare

- **WHEN** DNS for the apex is resolved
- **THEN** the answer is a Cloudflare address and responses carry Cloudflare's edge headers

#### Scenario: New deploy is visible immediately

- **WHEN** a release uploads a new `index.html` and invalidates CloudFront
- **THEN** the next request to `/` returns the new document

### Requirement: www Redirects to the Apex

`www.stitchesncolorstudio.com` SHALL redirect permanently to `https://stitchesncolorstudio.com`,
preserving the path and query, using a Cloudflare redirect rule.

#### Scenario: www request

- **WHEN** a client requests `https://www.stitchesncolorstudio.com/gallery?x=1`
- **THEN** it receives a 301 to `https://stitchesncolorstudio.com/gallery?x=1`

### Requirement: Free-Tier Cloudflare Protection Is Active

The zone SHALL have the Cloudflare Free Managed Ruleset active, a per-IP rate-limit rule blocking a
client that exceeds 100 requests per 10 seconds on non-static paths, and a custom rule blocking common
scanner paths (`/.env`, `/.git`, `/wp-*`, `/xmlrpc.php`, `phpmyadmin`, `/cgi-bin/`, any path ending
`.php`). These rules SHALL be managed in Terraform where the provider and plan allow it; any rule that
cannot be SHALL be listed with a verification command in the repository docs.

#### Scenario: Scanner path

- **WHEN** a client requests `/.env` or `/wp-login.php`
- **THEN** Cloudflare answers 403 and `/` is unaffected

#### Scenario: Flooding client

- **WHEN** one client sends more than 100 matching requests within 10 seconds
- **THEN** further requests receive 429 for the mitigation window

### Requirement: Existing Zone Rules Are Preserved

Rules that already protect the zone SHALL be adopted into Terraform state, not replaced. In particular the
active custom rule that blocks all traffic from outside the US (`ip.geoip.country ne "US"`) SHALL remain
enabled, with the same expression and action, alongside the new rules. A ruleset resource replaces every
rule in its phase, so an existing entrypoint SHALL be imported before the first apply.

#### Scenario: US-only block survives

- **WHEN** Terraform is applied to the zone
- **THEN** a visitor from outside the US is still blocked

#### Scenario: Existing ruleset is imported first

- **WHEN** the zone already has a custom firewall ruleset
- **THEN** it is imported into state before the plan, and the plan changes it in place rather than creating a second one

### Requirement: Existing Mail DNS Is Never Modified

Terraform SHALL NOT create, change or delete the apex `MX` or apex `TXT` (SPF) records, and SHALL import
no existing mail record. Only records for SES (DKIM CNAMEs, the MAIL FROM subdomain) and ACM validation
SHALL be added.

#### Scenario: Plan against the live zone

- **WHEN** Terraform is planned against the zone with existing mail records
- **THEN** the plan changes no apex MX or apex TXT record

### Requirement: Cloudflare Credentials Stay Out of Source Control and State

The Cloudflare API token SHALL be supplied only through `CLOUDFLARE_API_TOKEN` in the process
environment, SHALL appear in no tracked file, variable value or Terraform state, and SHALL be scoped to
this one zone. The local file that holds it SHALL be git-ignored.

#### Scenario: Missing token fails before changes

- **WHEN** Terraform runs without `CLOUDFLARE_API_TOKEN`
- **THEN** it fails with an authentication error before any resource is changed

#### Scenario: Local token file ignored

- **WHEN** `infrastructure/.env` contains a token
- **THEN** git reports it ignored and it cannot be staged without force

### Requirement: Cutover Is a Single Reversible Record Change

Moving live traffic from Forky to CloudFront SHALL be one operator-run change that replaces the apex `A` record with a proxied CNAME to CloudFront, performed only
after the site and contact form are verified on the CloudFront domain. Forky SHALL keep serving until
that change, so reverting is recreating the original apex `A` record recorded in `plan/dns-baseline.md`.

#### Scenario: Verified before cutover

- **WHEN** the cutover is about to be made
- **THEN** the site, a hashed asset and the contact endpoint have already passed their checks on the CloudFront domain

#### Scenario: Revert

- **WHEN** the live site misbehaves after cutover and Forky has not been retired
- **THEN** recreating the recorded apex `A` record returns traffic to Forky

### Requirement: Forky Is Retired After Live Verification

The Forky `Sncs-Web` container, its Traefik labels, its compose entry and its local image SHALL be removed
once the user confirms the live site and a real form submission (both emails arrived). The WordPress
database dump and old volumes under `~/docker/websites/Sncs/` SHALL be left in place. The removal SHALL
be confirmed with the user at that moment.

#### Scenario: Retirement

- **WHEN** the user confirms live verification and approves the removal
- **THEN** `Sncs-Web` no longer runs and the apex still serves from CloudFront

#### Scenario: Backups retained

- **WHEN** retirement completes
- **THEN** the WordPress dump and old volumes still exist
