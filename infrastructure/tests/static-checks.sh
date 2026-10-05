#!/usr/bin/env bash
# Checks the mocked terraform tests cannot express: resource types that must never exist.
set -euo pipefail
cd "$(dirname "$0")/../terraform"

if grep -rEn --include='*.tf' 'resource[[:space:]]+"aws_waf(v2)?_' .; then
  echo "FAIL: an AWS WAF resource is declared. Request filtering is Cloudflare's job (see spec)." >&2
  exit 1
fi
echo "static checks passed"
