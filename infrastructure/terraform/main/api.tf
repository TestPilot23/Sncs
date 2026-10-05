locals {
  contact_name       = "sncs-contact"
  turnstile_param    = "/sncs/turnstile-secret"
  account_id         = data.aws_caller_identity.current.account_id
  ses_identity_arn   = "arn:aws:ses:${var.aws_region}:${local.account_id}:identity/${var.domain}"
  ses_config_set     = "sncs"
  ses_config_set_arn = "arn:aws:ses:${var.aws_region}:${local.account_id}:configuration-set/${local.ses_config_set}"
  turnstile_arn      = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter${local.turnstile_param}"
  contact_log_arn    = "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/${local.contact_name}:*"
}

# Terraform holds only a placeholder. The real Turnstile secret is set once with
# `aws ssm put-parameter --overwrite`, so it never enters state and a later apply cannot revert it.
resource "aws_ssm_parameter" "turnstile_secret" {
  name  = local.turnstile_param
  type  = "SecureString"
  value = "set-me-out-of-band"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_cloudwatch_log_group" "contact" {
  name              = "/aws/lambda/${local.contact_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "contact" {
  name = "sncs-contact-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "contact" {
  name = "contact"
  role = aws_iam_role.contact.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WriteOwnLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = [local.contact_log_arn]
      },
      {
        # ses:SendEmail is evaluated against the identity AND the configuration set; omitting the
        # configuration set breaks sending with an authorization error.
        Sid      = "SendFromTheShopDomain"
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = [local.ses_identity_arn, local.ses_config_set_arn]
      },
      {
        Sid      = "ReadTurnstileSecret"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = [local.turnstile_arn]
      },
    ]
  })
}

# Built by `npm run build:lambda` (CI builds before planning).
data "archive_file" "contact" {
  type        = "zip"
  source_file = "${path.module}/../../../lambda/contact/dist/index.cjs"
  output_path = "${path.module}/.build/contact.zip"
}

resource "aws_lambda_function" "contact" {
  function_name = local.contact_name
  role          = aws_iam_role.contact.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 10

  filename         = data.archive_file.contact.output_path
  source_code_hash = data.archive_file.contact.output_base64sha256

  # -1 means unreserved. See var.contact_reserved_concurrency for why that is the default.
  reserved_concurrent_executions = var.contact_reserved_concurrency

  environment {
    variables = {
      OWNER_EMAILS           = join(",", var.owner_emails)
      FROM_ADDRESS           = "quotes@${var.domain}"
      FROM_NAME              = "Stitches-n-Color Studio"
      SHOP_PHONE             = var.shop_phone
      SHOP_HOURS             = var.shop_hours
      CONFIG_SET             = local.ses_config_set
      TURNSTILE_SECRET_PARAM = local.turnstile_param
    }
  }

  depends_on = [aws_cloudwatch_log_group.contact, aws_iam_role_policy.contact]
}

resource "aws_apigatewayv2_api" "contact" {
  name          = local.contact_name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "contact" {
  api_id                 = aws_apigatewayv2_api.contact.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.contact.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "contact" {
  api_id    = aws_apigatewayv2_api.contact.id
  route_key = "POST /api/contact"
  target    = "integrations/${aws_apigatewayv2_integration.contact.id}"
}

# A small ceiling: a flood is answered 429 by API Gateway before it can reach the function or SES.
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.contact.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 5
    throttling_burst_limit = 10
  }
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.contact.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.contact.execution_arn}/*/*"
}
