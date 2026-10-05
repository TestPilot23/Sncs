#!/usr/bin/env bash
# Plans the main root, refuses destructive plans, and saves the plan to the private state bucket
# for the approved apply. Needs: AWS credentials (plan role), CLOUDFLARE_API_TOKEN, STATE_BUCKET,
# PLAN_ID, and a built lambda (npm run build:lambda).
set -euo pipefail
: "${STATE_BUCKET:?}" "${PLAN_ID:?}" "${CLOUDFLARE_API_TOKEN:?}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/infrastructure/terraform/main"

terraform init -input=false -backend-config="bucket=$STATE_BUCKET" -backend-config="region=us-east-1"
terraform plan -input=false -lock-timeout=60s -out=release.tfplan
terraform show -json release.tfplan > release.plan.json
terraform show -no-color release.tfplan > release.plan.txt

node "$root/scripts/plan-guard.ts" release.plan.json

# the plan refers to the lambda zip by path and hash, so it travels with the plan
tar -czf release.plan.tgz release.tfplan .build/contact.zip
aws s3 cp release.plan.tgz "s3://$STATE_BUCKET/plans/$PLAN_ID/release.plan.tgz" --only-show-errors
echo "saved plan to s3://$STATE_BUCKET/plans/$PLAN_ID/"
