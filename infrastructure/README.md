# Sncs infrastructure

Two Terraform roots. Account 568402999432, region `us-east-1`, single environment.

| Root                  | Applied by                            | Holds                                        |
| --------------------- | ------------------------------------- | -------------------------------------------- |
| `terraform/bootstrap` | an operator, once, with admin creds   | state bucket, GitHub OIDC provider, CI roles |
| `terraform/main`      | the release pipeline (after approval) | site, API, email, Cloudflare records/rules   |

The pipeline never applies `bootstrap` and its release role is denied from changing the OIDC provider
or the `sncs-gha-*` roles.

## Local setup

```
aws login --profile sncs                 # IAM user, not root
cp .env.example .env                     # then fill in CLOUDFLARE_API_TOKEN (git-ignored)
set -a; . ./.env; set +a
```

## Tests (offline, no credentials)

```
cd terraform/bootstrap && terraform init -backend=false && terraform test
```

The AWS provider is mocked. Tests assert security properties (who can assume which role, what is denied,
nothing public), not the HCL text.

## Bootstrap (done 2026-10-05)

```
cd terraform/bootstrap
terraform init -backend-config="bucket=sncs-tfstate-568402999432" -backend-config="region=us-east-1"
terraform plan -var github_org=TestPilot23 -var github_repo=Sncs -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
```

The first apply ran with local state, which was then migrated into the bucket under
`bootstrap/terraform.tfstate`. The CI roles can only read and lock `main/*`, so they cannot see or alter
it. Changes to this root are always made by an operator, never by the pipeline.

## Main root

```
cd terraform/main
cp backend.hcl.example backend.hcl
terraform init -backend-config=backend.hcl
```

Do not run a bare local `terraform apply` here. Releases go through the pipeline, which refuses plans
that destroy or replace resources.
