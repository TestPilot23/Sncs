# Bootstrap root: applied once by an operator with admin credentials, never by the pipeline.
# Creates the Terraform state bucket, the GitHub OIDC provider and the two CI roles. Everything
# else lives in ../main and is applied by the release pipeline.

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "sncs"
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id        = data.aws_caller_identity.current.account_id
  state_bucket_name = "sncs-tfstate-${local.account_id}"
  state_bucket_arn  = "arn:aws:s3:::${local.state_bucket_name}"

  # GitHub mints two `sub` formats: the classic one and, for newer repos, an immutable-ID one.
  # Trust both, or the first deploy from a new repo fails with "Not authorized".
  plan_trust_subs = [
    "repo:${var.github_org}/${var.github_repo}:*",
    "repo:${var.github_org}@*/${var.github_repo}@*:*",
  ]
  release_trust_subs = [
    "repo:${var.github_org}/${var.github_repo}:environment:production",
    "repo:${var.github_org}@*/${var.github_repo}@*:environment:production",
  ]
}

# --- Terraform state ---------------------------------------------------------------------------

resource "aws_s3_bucket" "state" {
  bucket = local.state_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

resource "aws_s3_bucket_policy" "state_tls_only" {
  bucket = aws_s3_bucket.state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = { AWS = "*" }
      Action    = "s3:*"
      Resource  = [local.state_bucket_arn, "${local.state_bucket_arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.state]
}

# --- GitHub OIDC ---------------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# --- CI roles ------------------------------------------------------------------------------------

resource "aws_iam_role" "plan" {
  name = "sncs-gha-plan"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = local.plan_trust_subs }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "plan" {
  for_each = toset(["arn:aws:iam::aws:policy/ReadOnlyAccess"])

  role       = aws_iam_role.plan.name
  policy_arn = each.value
}

# Read state, and write only the lock files S3-native locking creates next to it.
resource "aws_iam_role_policy" "plan" {
  name = "state-read-and-lock"
  role = aws_iam_role.plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [local.state_bucket_arn, "${local.state_bucket_arn}/main/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = ["${local.state_bucket_arn}/main/*.tflock"]
      },
    ]
  })
}

resource "aws_iam_role" "release" {
  name = "sncs-gha-release"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = local.release_trust_subs }
      }
    }]
  })
}

# No managed policies: permissions are the inline policy below, scoped to sncs-* resources.
resource "aws_iam_role_policy_attachment" "release" {
  for_each = toset([])

  role       = aws_iam_role.release.name
  policy_arn = each.value
}

resource "aws_iam_role_policy" "release" {
  name = "sncs-release"
  role = aws_iam_role.release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "StateMainKeyOnly"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [local.state_bucket_arn, "${local.state_bucket_arn}/main/*"]
      },
      {
        Sid      = "SiteBucket"
        Effect   = "Allow"
        Action   = ["s3:*"]
        Resource = ["arn:aws:s3:::sncs-site-*", "arn:aws:s3:::sncs-site-*/*"]
      },
      {
        Sid      = "Edge"
        Effect   = "Allow"
        Action   = ["cloudfront:*", "acm:*", "ses:*"]
        Resource = ["*"]
      },
      {
        Sid      = "Api"
        Effect   = "Allow"
        Action   = ["apigateway:*"]
        Resource = ["arn:aws:apigateway:${var.aws_region}::/*"]
      },
      {
        Sid      = "Functions"
        Effect   = "Allow"
        Action   = ["lambda:*"]
        Resource = ["arn:aws:lambda:${var.aws_region}:${local.account_id}:function:sncs-*"]
      },
      {
        Sid      = "Monitoring"
        Effect   = "Allow"
        Action   = ["sns:*"]
        Resource = ["arn:aws:sns:${var.aws_region}:${local.account_id}:sncs-*"]
      },
      {
        Sid      = "Alarms"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms", "cloudwatch:DescribeAlarms", "cloudwatch:ListTagsForResource", "cloudwatch:TagResource"]
        Resource = ["*"]
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = ["logs:*"]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/sncs-*",
          "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/sncs-*:*",
          "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/apigateway/sncs-*",
          "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/apigateway/sncs-*:*",
        ]
      },
      {
        Sid      = "LogsDescribe"
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups", "logs:ListTagsForResource"]
        Resource = ["*"]
      },
      {
        Sid      = "Parameters"
        Effect   = "Allow"
        Action   = ["ssm:*"]
        Resource = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/sncs/*"]
      },
      {
        Sid      = "ParametersDescribe"
        Effect   = "Allow"
        Action   = ["ssm:DescribeParameters"]
        Resource = ["*"]
      },
      {
        Sid    = "ServiceRolesAndPolicies"
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole", "iam:TagRole", "iam:UntagRole",
          "iam:ListRolePolicies", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole",
          "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:UpdateAssumeRolePolicy",
          "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy", "iam:GetPolicyVersion",
          "iam:ListPolicyVersions", "iam:CreatePolicyVersion", "iam:DeletePolicyVersion",
          "iam:PassRole",
        ]
        Resource = [
          "arn:aws:iam::${local.account_id}:role/sncs-*",
          "arn:aws:iam::${local.account_id}:policy/sncs-*",
        ]
      },
      {
        Sid    = "DenyChangingTheCiRoles"
        Effect = "Deny"
        Action = [
          "iam:UpdateAssumeRolePolicy", "iam:PutRolePolicy", "iam:DeleteRolePolicy",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:DeleteRole", "iam:UpdateRole",
          "iam:TagRole", "iam:UntagRole", "iam:PassRole",
        ]
        Resource = ["arn:aws:iam::${local.account_id}:role/sncs-gha-*"]
      },
      {
        Sid    = "DenyChangingTheOidcProvider"
        Effect = "Deny"
        Action = [
          "iam:DeleteOpenIDConnectProvider", "iam:UpdateOpenIDConnectProviderThumbprint",
          "iam:AddClientIDToOpenIDConnectProvider", "iam:RemoveClientIDFromOpenIDConnectProvider",
          "iam:TagOpenIDConnectProvider", "iam:UntagOpenIDConnectProvider",
        ]
        Resource = ["*"]
      },
      {
        Sid      = "DenyTouchingStateBucketSettings"
        Effect   = "Deny"
        Action   = ["s3:DeleteBucket", "s3:PutBucketPolicy", "s3:DeleteBucketPolicy", "s3:PutBucketVersioning", "s3:PutBucketPublicAccessBlock"]
        Resource = [local.state_bucket_arn]
      },
    ]
  })
}
