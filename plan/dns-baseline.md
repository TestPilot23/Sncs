# DNS baseline — stitchesncolorstudio.com (captured 2026-10-05, read-only, Cloudflare Free, Full setup)

17 records. Restore these exactly if a cutover must be reverted.

| Name                     | Type  | Content                                               | Proxy    |
| ------------------------ | ----- | ----------------------------------------------------- | -------- |
| apex                     | A     | 99.26.214.190 (home WAN → Forky/Traefik)              | Proxied  |
| `*`                      | A     | 99.26.214.190                                         | Proxied  |
| `_domainconnect`         | CNAME | connect.domains.google.com                            | Proxied  |
| `mail`                   | CNAME | ghs.googlehosted.com (Google webmail)                 | Proxied  |
| apex                     | MX    | aspmx.l.google.com (1), alt1/alt2 (5), alt3/alt4 (10) | DNS only |
| apex                     | NS    | ns-cloud-a1..a4.googledomains.com (leftover)          | DNS only |
| `_acme-challenge.sinks2` | TXT   | (Sinks cert challenge, do not touch)                  | DNS only |
| `_dmarc`                 | TXT   | `v=DMARC1; p=quarantine; sp=reject; ri=84600`         | DNS only |
| `google._domainkey`      | TXT   | Google Workspace DKIM key                             | DNS only |
| apex                     | TXT   | `v=spf1 include:_spf.google.com ~all`                 | DNS only |

## Consequences for this change

- Mail is Google Workspace. Never edit apex MX/SPF/`google._domainkey`.
- DMARC exists (`p=quarantine`). SES mail From the apex aligns through SES Easy DKIM; nothing to add.
- `mail.` is already a CNAME, so the SES MAIL FROM subdomain cannot be `mail.`. Use `bounce.`.
- No Cloudflare tunnel: the apex is a proxied A to a home IP. Cutover = delete that A, create the
  proxied CNAME to CloudFront. Revert = recreate the A above.
- The wildcard `*` also points at Forky, so `www` and any other subdomain reach Forky today. Leave the
  wildcard alone (other Forky sites may use it); the `www` redirect rule runs at the Cloudflare edge before
  the origin.
- The account holds other zones (councilanchor.com etc.): the API token must be scoped to this zone only.
