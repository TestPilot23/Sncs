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

echo "static checks passed"
