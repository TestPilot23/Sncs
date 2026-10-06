#!/usr/bin/env bash
# Prints SITE_BUCKET / DISTRIBUTION_ID / DOMAIN lines (from tf-apply.sh) for $GITHUB_ENV.
set -euo pipefail
f="$(cd "$(dirname "$0")/.." && pwd)/infrastructure/outputs.json"
echo "SITE_BUCKET=$(jq -r .site_bucket.value "$f")"
echo "DISTRIBUTION_ID=$(jq -r .distribution_id.value "$f")"
echo "DISTRIBUTION_DOMAIN=$(jq -r .distribution_domain.value "$f")"
