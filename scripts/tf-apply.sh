#!/usr/bin/env bash
# Applies the plan saved by tf-plan.sh for this run: the one that was reviewed, never a fresh one.
# Needs: AWS credentials (release role), CLOUDFLARE_API_TOKEN, STATE_BUCKET, PLAN_ID.
set -euo pipefail
: "${STATE_BUCKET:?}" "${PLAN_ID:?}" "${CLOUDFLARE_API_TOKEN:?}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/infrastructure/terraform/main"

aws s3 cp "s3://$STATE_BUCKET/plans/$PLAN_ID/release.plan.tgz" release.plan.tgz --only-show-errors
tar -xzf release.plan.tgz

terraform init -input=false -backend-config="bucket=$STATE_BUCKET" -backend-config="region=us-east-1"
terraform apply -input=false -lock-timeout=60s release.tfplan
terraform output -json > "$root/infrastructure/outputs.json"
