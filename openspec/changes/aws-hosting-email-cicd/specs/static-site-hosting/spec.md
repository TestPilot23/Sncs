## ADDED Requirements

### Requirement: Site Is Served From a Private S3 Origin Through CloudFront

The built site (`dist/`) SHALL be stored in a private S3 bucket in account 568402999432, `us-east-1`,
reachable only through a CloudFront distribution using origin access control. The bucket SHALL block all
public access and SHALL have versioning enabled with noncurrent versions expiring after 30 days.

#### Scenario: Direct bucket access is refused

- **WHEN** a client requests an object from the bucket's S3 endpoint without CloudFront
- **THEN** the request is denied

#### Scenario: Site is served through the distribution

- **WHEN** a browser requests `/` on the CloudFront domain
- **THEN** it receives `index.html` containing `<div id="root">` over HTTPS

#### Scenario: Plain HTTP is upgraded

- **WHEN** a client requests the site over HTTP
- **THEN** it is redirected to HTTPS

### Requirement: Cache Headers Match the Current nginx Behavior

Objects SHALL carry `Cache-Control` set at upload time: hashed build files under `/assets/index-` use
`public, max-age=31536000, immutable`; other files under `/assets/` use `public, max-age=86400`;
`index.html` uses `no-cache`.

#### Scenario: Hashed bundle is cached for a year

- **WHEN** a client requests the hashed JavaScript bundle
- **THEN** the response `Cache-Control` is `public, max-age=31536000, immutable`

#### Scenario: Entry document is always revalidated

- **WHEN** a client requests `/`
- **THEN** the response `Cache-Control` is `no-cache`

#### Scenario: Brand image caches for a day

- **WHEN** a client requests an unhashed image under `/assets/`
- **THEN** the response `Cache-Control` is `public, max-age=86400`

### Requirement: Client-Side Paths Fall Back to the Entry Document

Requests whose last path segment has no file extension SHALL return `index.html` with status 200, through
a CloudFront Function on the site behavior only, so a stray deep link does not show an S3 error page. A
request for a missing file that has an extension SHALL NOT be rewritten, and `/api` paths SHALL never be
rewritten. The distribution SHALL NOT define distribution-wide custom error responses, because those apply
to every behavior and would turn API errors into `index.html`.

#### Scenario: Deep path

- **WHEN** a client requests `/some/deep/path`
- **THEN** it receives `index.html` with status 200

#### Scenario: Missing file stays a failure

- **WHEN** a client requests `/assets/missing.png` and no such object exists
- **THEN** it does not receive `index.html` with status 200

#### Scenario: API paths are not masked

- **WHEN** a client requests `/api/contact` and the API returns an error
- **THEN** the API's status and body are returned, not `index.html`

### Requirement: Responses Carry Baseline Security Headers

The distribution SHALL attach a response headers policy setting `Strict-Transport-Security` with
`max-age` of at least one year and without `includeSubDomains` or `preload`, `X-Content-Type-Options:
nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`. It
SHALL NOT enforce a `Content-Security-Policy`.

#### Scenario: Headers present on the site and the API

- **WHEN** a client requests `/` or `/api/contact`
- **THEN** each of the four headers is present with the stated value

#### Scenario: No enforced CSP

- **WHEN** any response is inspected
- **THEN** it contains no `Content-Security-Policy` header

### Requirement: No AWS WAF Is Provisioned

The stack SHALL NOT create any `aws_wafv2_web_acl`. Request filtering is provided by Cloudflare.

#### Scenario: Plan inspection

- **WHEN** the Terraform plan is evaluated
- **THEN** it contains no WAF web ACL
