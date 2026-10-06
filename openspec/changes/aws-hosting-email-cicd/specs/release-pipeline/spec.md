## ADDED Requirements

### Requirement: AWS Access From CI Uses OIDC, Not Stored Keys

GitHub Actions SHALL authenticate to AWS 568402999432 through the GitHub OIDC provider and short-lived
role credentials. No AWS access key or secret SHALL exist in the repository, its secrets or its variables.

#### Scenario: No static credentials

- **WHEN** repository and environment secrets are listed
- **THEN** none is an AWS access key

#### Scenario: Role assumed with a short-lived token

- **WHEN** a release workflow runs
- **THEN** it assumes its role through `AssumeRoleWithWebIdentity`

### Requirement: Two Roles Separate Planning From Releasing

`sncs-gha-plan` SHALL be read-only with state read and lock access and SHALL be assumable from any ref in
the repository. `sncs-gha-release` SHALL be able to apply and deploy and SHALL be assumable only from the
`production` GitHub environment. Neither SHALL have `AdministratorAccess`; IAM permissions SHALL be
limited to roles and policies named `sncs-*`. Each trust policy SHALL match both the classic
`repo:TestPilot23/Sncs:*` and the immutable-ID `sub` formats.

#### Scenario: Release role refused outside the environment

- **WHEN** a workflow on a branch without the `production` environment tries to assume `sncs-gha-release`
- **THEN** the assumption is denied

#### Scenario: Plan role cannot change infrastructure

- **WHEN** the plan role attempts to create or modify any resource
- **THEN** the call is denied

#### Scenario: Either sub format is accepted

- **WHEN** GitHub issues a classic or an immutable-ID subject for the repository
- **THEN** the matching role can be assumed from an allowed context

### Requirement: Pull Requests Are Gated Before Merge

Pull requests SHALL run lint, format check, tests, build, Lambda tests, `terraform fmt -check`,
`terraform validate` and, when `infrastructure/` changes, a `terraform plan` using the plan role.

#### Scenario: Failing gate

- **WHEN** any gate fails on a pull request
- **THEN** the check fails and the change is not releasable

### Requirement: A Release Is a Push to the release Branch Followed by Approval

A push to `release` SHALL run verify, then plan, then pause for approval in the `production` environment
with the owner as required reviewer, then apply the saved plan, deploy the site and run smoke checks. The
apply step SHALL use the plan that was approved, not a fresh one.

#### Scenario: Unapproved release does not deploy

- **WHEN** the approval is not given
- **THEN** no resource is changed and no object is uploaded

#### Scenario: Approved plan is the applied plan

- **WHEN** approval is given
- **THEN** the apply step consumes the saved plan from the plan step

### Requirement: The Pipeline Refuses Destructive Plans

The pipeline SHALL fail before approval if the plan destroys or replaces any resource. Intentional
destruction SHALL be performed by an operator outside the pipeline.

#### Scenario: Plan contains a replace

- **WHEN** the plan would replace the CloudFront distribution
- **THEN** the run fails at the plan step and does not reach approval

### Requirement: Deploy Order Prevents Broken Pages

The deploy SHALL upload hashed assets first, other files second and `index.html` last, set the
`Cache-Control` values from the hosting spec, and invalidate only `/index.html` and `/`.

#### Scenario: Visitor during a deploy

- **WHEN** a visitor loads the site while a deploy is in progress
- **THEN** every asset referenced by the `index.html` they receive already exists in the bucket

### Requirement: Post-Deploy Smoke Checks Prove the Live Site Without Sending Email

After deploy, the pipeline SHALL verify that `GET /` returns 200 containing `<div id="root">`, that a
hashed asset returns the immutable cache header, and that `POST /api/contact` with an intentionally
invalid body returns 400 JSON. It SHALL NOT send a real email.

#### Scenario: Healthy release

- **WHEN** all three checks pass
- **THEN** the run succeeds

#### Scenario: API route broken

- **WHEN** the contact route returns HTML or 5xx
- **THEN** the run fails and reports which check failed

### Requirement: Production Deploys Only Come From CI

The repository SHALL contain no script that deploys to AWS from a developer machine using a local build,
and the Turnstile site key SHALL come from a GitHub environment variable at CI build time.

#### Scenario: Local build cannot reach prod

- **WHEN** a developer builds locally
- **THEN** no repository script uploads that build to the production bucket

### Requirement: State Is Remote, Versioned and Locked

Terraform state SHALL live in a versioned, encrypted, public-access-blocked S3 bucket with S3-native
locking. A one-time bootstrap root, applied by an operator, SHALL create the state bucket, the OIDC
provider and both roles. The pipeline SHALL NOT apply the bootstrap root.

#### Scenario: Concurrent runs

- **WHEN** two applies start at once
- **THEN** the second fails to acquire the lock

#### Scenario: Pipeline cannot alter its own trust

- **WHEN** the release role attempts to modify the OIDC provider or either CI role
- **THEN** the call is denied

### Requirement: Rollback Is a Re-release

Rolling back SHALL be done by pushing the previous known-good commit to `release` and approving. The
bucket's object versions SHALL allow manual restore if the pipeline is unavailable.

#### Scenario: Rollback

- **WHEN** the previous commit is pushed to `release` and approved
- **THEN** the site serves that commit's build

### Requirement: Main Reflects Released Production

Changes SHALL be merged to `main` only after the release is live and verified. Pipeline steps SHALL live
in repository scripts invoked by the workflow so an operator can run them locally if Actions is unavailable.

#### Scenario: Merge timing

- **WHEN** a release has been pushed but not verified live
- **THEN** its branch is not merged to `main`
