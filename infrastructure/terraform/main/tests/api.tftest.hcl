# Property tests for the contact API stack. Providers are mocked; no credentials needed.

mock_provider "aws" {}
mock_provider "cloudflare" {}
mock_provider "archive" {}

override_resource {
  target          = aws_cloudfront_distribution.site
  override_during = plan
  values = {
    arn = "arn:aws:cloudfront::123456789012:distribution/EXAMPLE"
  }
}

override_resource {
  target          = aws_cloudfront_origin_access_control.site
  override_during = plan
  values = {
    id = "E1EXAMPLEOAC"
  }
}

override_resource {
  target          = aws_cloudfront_response_headers_policy.site
  override_during = plan
  values = {
    id = "headers-policy-id"
  }
}

override_resource {
  target          = aws_apigatewayv2_api.contact
  override_during = plan
  values = {
    id            = "abc123"
    api_endpoint  = "https://abc123.execute-api.us-east-1.amazonaws.com"
    execution_arn = "arn:aws:execute-api:us-east-1:123456789012:abc123"
  }
}

override_data {
  target = data.aws_caller_identity.current
  values = {
    account_id = "123456789012"
  }
}

variables {
  owner_emails = ["owner@example.com", "shop@example.com"]
}

run "lambda_is_small_current_and_holds_no_secret" {
  command = plan

  assert {
    condition     = startswith(aws_lambda_function.contact.runtime, "nodejs") && jsonencode(tolist(aws_lambda_function.contact.architectures)) == jsonencode(["arm64"])
    error_message = "Lambda must use a Node.js runtime on arm64."
  }

  assert {
    condition     = aws_lambda_function.contact.timeout <= 15
    error_message = "A form handler must not run long; keep the timeout at 15s or less."
  }

  assert {
    condition = alltrue([
      for k, v in aws_lambda_function.contact.environment[0].variables :
      !can(regex("(?i)secret.*value|token", k)) && v != aws_ssm_parameter.turnstile_secret.value
    ])
    error_message = "The Turnstile secret value must never be placed in the function environment."
  }

  assert {
    condition     = aws_lambda_function.contact.environment[0].variables["OWNER_EMAILS"] == "owner@example.com,shop@example.com"
    error_message = "Owner recipients must be passed to the handler."
  }

  assert {
    condition     = aws_lambda_function.contact.environment[0].variables["FROM_ADDRESS"] == "quotes@stitchesncolorstudio.com"
    error_message = "Mail must be sent from the shop's own domain."
  }

  assert {
    condition     = aws_lambda_function.contact.environment[0].variables["TURNSTILE_SECRET_PARAM"] == "/sncs/turnstile-secret"
    error_message = "Handler must be told only the parameter name."
  }
}

run "turnstile_secret_is_an_encrypted_placeholder_set_out_of_band" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.turnstile_secret.type == "SecureString"
    error_message = "The Turnstile secret must be a SecureString."
  }

  assert {
    condition     = nonsensitive(aws_ssm_parameter.turnstile_secret.value) == "set-me-out-of-band"
    error_message = "Terraform must hold only a placeholder; the real value is set with aws ssm put-parameter."
  }
}

run "lambda_role_is_least_privilege" {
  command = plan

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.contact.policy).Statement :
      !contains(try(tolist(s.Action), [s.Action]), "*") &&
      alltrue([for a in try(tolist(s.Action), [s.Action]) : !endswith(a, ":*")])
    ])
    error_message = "No wildcard actions."
  }

  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_role_policy.contact.policy).Statement :
      contains(try(tolist(s.Action), [s.Action]), "ses:SendEmail") &&
      contains(tolist(s.Resource), "arn:aws:ses:us-east-1:123456789012:identity/stitchesncolorstudio.com") &&
      contains(tolist(s.Resource), "arn:aws:ses:us-east-1:123456789012:configuration-set/sncs")
    ])
    error_message = "ses:SendEmail needs both the identity and the configuration set as resources."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.contact.policy).Statement :
      !contains(try(tolist(s.Action), [s.Action]), "ses:SendEmail") ||
      alltrue([for r in tolist(s.Resource) : r != "*"])
    ])
    error_message = "ses:SendEmail must not be allowed on every resource."
  }

  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_role_policy.contact.policy).Statement :
      contains(try(tolist(s.Action), [s.Action]), "ssm:GetParameter") &&
      jsonencode(s.Resource) == jsonencode(["arn:aws:ssm:us-east-1:123456789012:parameter/sncs/turnstile-secret"])
    ])
    error_message = "The function may read exactly its own Turnstile parameter."
  }
}

run "api_exposes_exactly_one_throttled_route" {
  command = plan

  assert {
    condition     = aws_apigatewayv2_route.contact.route_key == "POST /api/contact"
    error_message = "The only route is POST /api/contact."
  }

  assert {
    condition     = aws_apigatewayv2_stage.default.default_route_settings[0].throttling_rate_limit > 0 && aws_apigatewayv2_stage.default.default_route_settings[0].throttling_burst_limit <= 20
    error_message = "Stage throttling must be set, with a small burst."
  }

  assert {
    condition     = aws_apigatewayv2_integration.contact.payload_format_version == "2.0"
    error_message = "The handler expects the HTTP API 2.0 payload."
  }

  assert {
    condition     = aws_lambda_permission.api.principal == "apigateway.amazonaws.com" && aws_lambda_permission.api.source_arn == "arn:aws:execute-api:us-east-1:123456789012:abc123/*/*"
    error_message = "Only this API may invoke the function."
  }
}

run "cloudfront_routes_api_without_caching_or_masking" {
  command = plan

  assert {
    condition     = length(aws_cloudfront_distribution.site.ordered_cache_behavior) == 1 && aws_cloudfront_distribution.site.ordered_cache_behavior[0].path_pattern == "/api/*"
    error_message = "Exactly one extra behavior, for /api/*."
  }

  assert {
    condition     = contains(aws_cloudfront_distribution.site.ordered_cache_behavior[0].allowed_methods, "POST")
    error_message = "POST must reach the API."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.ordered_cache_behavior[0].cache_policy_id == "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    error_message = "API responses must never be cached."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.ordered_cache_behavior[0].origin_request_policy_id == "b689b0a8-53d0-40ab-baf2-68738e2966ac"
    error_message = "Forward viewer headers but not Host, which would break API Gateway routing."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.ordered_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "API must be HTTPS only."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.site.ordered_cache_behavior[0].function_association) == 0
    error_message = "The SPA fallback must never run on API paths."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.ordered_cache_behavior[0].response_headers_policy_id == aws_cloudfront_response_headers_policy.site.id
    error_message = "The API must carry the same security headers as the site."
  }

  assert {
    condition = anytrue([
      for o in aws_cloudfront_distribution.site.origin :
      o.domain_name == "abc123.execute-api.us-east-1.amazonaws.com" &&
      o.custom_origin_config[0].origin_protocol_policy == "https-only" &&
      contains(o.custom_origin_config[0].origin_ssl_protocols, "TLSv1.2")
    ])
    error_message = "The API origin must be reached over HTTPS only, TLS 1.2+."
  }
}
