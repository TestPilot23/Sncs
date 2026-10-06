# Security-property tests for the bootstrap root. They assert what must be true of the result
# (who can assume what, what is denied, what is public), not how the HCL is written.
# The AWS provider is mocked, so they run offline with no credentials.

mock_provider "aws" {}

# The provider ARN is only known after apply; give the plan a fixed one so trust policies are evaluable.
override_resource {
  target          = aws_iam_openid_connect_provider.github
  override_during = plan
  values = {
    arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  }
}

override_data {
  target = data.aws_caller_identity.current
  values = {
    account_id = "123456789012"
  }
}

variables {
  github_org  = "TestPilot23"
  github_repo = "Sncs"
}

run "state_bucket_is_private_versioned_and_encrypted" {
  command = plan

  assert {
    condition = (
      aws_s3_bucket_public_access_block.state.block_public_acls &&
      aws_s3_bucket_public_access_block.state.block_public_policy &&
      aws_s3_bucket_public_access_block.state.ignore_public_acls &&
      aws_s3_bucket_public_access_block.state.restrict_public_buckets
    )
    error_message = "State bucket must block all public access."
  }

  assert {
    condition     = aws_s3_bucket_versioning.state.versioning_configuration[0].status == "Enabled"
    error_message = "State bucket must be versioned."
  }

  assert {
    condition     = length(aws_s3_bucket_server_side_encryption_configuration.state.rule) == 1
    error_message = "State bucket must have default encryption."
  }
}

run "oidc_provider_is_github_only" {
  command = plan

  assert {
    condition     = aws_iam_openid_connect_provider.github.url == "https://token.actions.githubusercontent.com"
    error_message = "OIDC provider must be GitHub Actions."
  }

  assert {
    condition     = contains(aws_iam_openid_connect_provider.github.client_id_list, "sts.amazonaws.com")
    error_message = "OIDC audience must be sts.amazonaws.com."
  }
}

run "plan_role_trusts_this_repo_in_both_sub_formats" {
  command = plan

  assert {
    condition = (
      contains(local.plan_trust_subs, "repo:TestPilot23/Sncs:*") &&
      contains(local.plan_trust_subs, "repo:TestPilot23@*/Sncs@*:*")
    )
    error_message = "Plan role must accept the classic and immutable-ID subject formats."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role.plan.assume_role_policy).Statement :
      s.Principal != "*" && try(s.Principal.AWS, "") != "*"
    ])
    error_message = "Plan role trust must not allow a wildcard principal."
  }
}

run "release_role_only_trusts_the_production_environment" {
  command = plan

  assert {
    condition = alltrue([
      for s in local.release_trust_subs : can(regex(":environment:production$", s))
    ])
    error_message = "Every release-role subject must be the production environment."
  }

  assert {
    condition = (
      contains(local.release_trust_subs, "repo:TestPilot23/Sncs:environment:production") &&
      contains(local.release_trust_subs, "repo:TestPilot23@*/Sncs@*:environment:production")
    )
    error_message = "Release role must accept the production environment in both subject formats."
  }

  assert {
    condition     = !contains(local.release_trust_subs, "repo:TestPilot23/Sncs:*")
    error_message = "Release role must not trust arbitrary refs."
  }
}

run "no_ci_role_has_administrator_access" {
  command = plan

  assert {
    condition = alltrue([
      for arn in concat(
        [for a in aws_iam_role_policy_attachment.plan : a.policy_arn],
        [for a in aws_iam_role_policy_attachment.release : a.policy_arn],
      ) : !endswith(arn, "/AdministratorAccess")
    ])
    error_message = "CI roles must not carry AdministratorAccess."
  }
}

run "release_role_cannot_modify_ci_trust" {
  command = plan

  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_role_policy.release.policy).Statement :
      s.Effect == "Deny" &&
      contains(try(tolist(s.Action), [s.Action]), "iam:UpdateAssumeRolePolicy") &&
      anytrue([for r in tolist(s.Resource) : can(regex("sncs-gha-", r))])
    ])
    error_message = "Release role must be denied from changing the CI roles' trust policy."
  }

  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_role_policy.release.policy).Statement :
      s.Effect == "Deny" &&
      contains(try(tolist(s.Action), [s.Action]), "iam:DeleteOpenIDConnectProvider")
    ])
    error_message = "Release role must be denied from deleting or altering the OIDC provider."
  }
}

run "plan_role_cannot_write_anything_but_state_locks_and_saved_plans" {
  command = plan

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.plan.policy).Statement :
      s.Effect == "Deny" || alltrue([
        for a in try(tolist(s.Action), [s.Action]) :
        can(regex("^s3:(GetObject|ListBucket|PutObject|DeleteObject)$", a))
      ])
    ])
    error_message = "Plan role inline policy may only grant state-bucket read and lock-file actions."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.plan.policy).Statement :
      !contains(try(tolist(s.Action), [s.Action]), "s3:PutObject") ||
      alltrue([for r in tolist(s.Resource) : endswith(r, ".tflock") || endswith(r, "/plans/*")])
    ])
    error_message = "Plan role may write only .tflock objects and saved plans in the state bucket."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.plan.policy).Statement :
      !contains(try(tolist(s.Action), [s.Action]), "s3:DeleteObject") ||
      alltrue([for r in tolist(s.Resource) : endswith(r, ".tflock")])
    ])
    error_message = "Plan role may delete only lock files, never a saved plan or state."
  }
}

# The saved plan is what the approver reviewed. It lives in the private state bucket (a public
# repo's artifacts are world-readable) and the release role may only read it.
run "saved_plans_are_readable_by_release_but_not_writable" {
  command = plan

  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_role_policy.release.policy).Statement :
      s.Effect == "Allow" &&
      contains(try(tolist(s.Action), [s.Action]), "s3:GetObject") &&
      anytrue([for r in tolist(s.Resource) : endswith(r, "/plans/*")])
    ])
    error_message = "Release role must be able to read saved plans."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.release.policy).Statement :
      s.Effect == "Deny" || !anytrue([for r in tolist(s.Resource) : endswith(r, "/plans/*")]) ||
      !contains(try(tolist(s.Action), [s.Action]), "s3:PutObject")
    ])
    error_message = "Release role must not be able to overwrite a saved plan."
  }
}

run "saved_plans_expire" {
  command = plan

  assert {
    condition = anytrue([
      for r in aws_s3_bucket_lifecycle_configuration.state.rule :
      r.status == "Enabled" && one(r.filter).prefix == "plans/" && one(r.expiration).days <= 14
    ])
    error_message = "Saved plans must expire within 14 days."
  }
}
