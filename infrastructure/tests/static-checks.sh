#!/usr/bin/env bash
# Checks the mocked terraform tests cannot express: resource types that must never exist.
set -euo pipefail
cd "$(dirname "$0")/../terraform"

if grep -rEn --include='*.tf' 'resource[[:space:]]+"aws_waf(v2)?_' .; then
  echo "FAIL: an AWS WAF resource is declared. Request filtering is Cloudflare's job (see spec)." >&2
  exit 1
fi
# The Turnstile secret is set out of band; without ignore_changes a later apply would overwrite it
# with the placeholder and silently break the contact form.
if ! awk '/resource "aws_ssm_parameter" "turnstile_secret"/,/^}/' main/api.tf | grep -Eq 'ignore_changes[[:space:]]*=[[:space:]]*\[value\]'; then
  echo "FAIL: aws_ssm_parameter.turnstile_secret must keep lifecycle { ignore_changes = [value] }." >&2
  exit 1
fi

# The certificate covers only the apex. www is redirected by Cloudflare, which serves its own
# certificate there, so no SAN (and no wildcard) belongs on the CloudFront certificate.
if grep -n 'subject_alternative_names' main/*.tf; then
  echo "FAIL: the ACM certificate must not declare subject_alternative_names." >&2
  exit 1
fi

# The apex is the one record an operator replaces at cutover; Terraform must never manage it
# (as A/AAAA/CNAME, or as MX/TXT, which Google Workspace owns).
if grep -nE '^[[:space:]]*name[[:space:]]*=[[:space:]]*(var\.domain|"@")[[:space:]]*$' main/*.tf; then
  echo "FAIL: a DNS record is declared on the bare apex. Only an operator replaces the apex record, at cutover." >&2
  exit 1
fi

echo "static checks passed"
