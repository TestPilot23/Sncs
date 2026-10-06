# Property tests for email identity, certificate, alarms and Cloudflare rules.
# Providers are mocked; no credentials needed.

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
  target = data.cloudflare_zone.site
  values = {
    id = "0123456789abcdef0123456789abcdef"
  }
}

override_data {
  target = data.aws_caller_identity.current
  values = {
    account_id = "123456789012"
  }
}

run "ses_identity_signs_with_dkim_and_uses_its_own_bounce_domain" {
  command = plan

  assert {
    condition     = aws_sesv2_email_identity.domain.email_identity == "stitchesncolorstudio.com"
    error_message = "The verified identity is the shop's domain."
  }

  assert {
    condition     = aws_sesv2_email_identity.domain.dkim_signing_attributes[0].next_signing_key_length == "RSA_2048_BIT"
    error_message = "Easy DKIM must use 2048-bit keys."
  }

  assert {
    condition     = aws_sesv2_email_identity.domain.configuration_set_name == "sncs"
    error_message = "Mail from this identity must go through the sncs configuration set."
  }

  assert {
    condition     = aws_sesv2_email_identity_mail_from_attributes.domain.mail_from_domain == "bounce.stitchesncolorstudio.com"
    error_message = "MAIL FROM must be bounce.<domain>; mail.<domain> is already a Google CNAME."
  }

  assert {
    condition     = aws_sesv2_email_identity_mail_from_attributes.domain.behavior_on_mx_failure == "USE_DEFAULT_VALUE"
    error_message = "If the MAIL FROM records are missing, SES must fall back rather than refuse to send."
  }

  assert {
    condition     = aws_sesv2_configuration_set.sncs.configuration_set_name == "sncs" && aws_sesv2_configuration_set.sncs.reputation_options[0].reputation_metrics_enabled
    error_message = "The configuration set must record bounce and complaint metrics."
  }
}

run "mail_dns_never_touches_the_apex_or_google_records" {
  command = plan

  assert {
    condition = alltrue([
      for r in [cloudflare_dns_record.mail_from_mx, cloudflare_dns_record.mail_from_spf] :
      r.name == "bounce.stitchesncolorstudio.com"
    ])
    error_message = "The only MX/TXT records we add live on bounce.<domain>, never the apex."
  }

  assert {
    condition     = cloudflare_dns_record.mail_from_mx.type == "MX" && cloudflare_dns_record.mail_from_mx.content == "feedback-smtp.us-east-1.amazonses.com" && cloudflare_dns_record.mail_from_mx.priority == 10
    error_message = "MAIL FROM MX must point at SES feedback in this region."
  }

  assert {
    condition     = cloudflare_dns_record.mail_from_spf.type == "TXT" && can(regex("include:amazonses\\.com", cloudflare_dns_record.mail_from_spf.content))
    error_message = "MAIL FROM SPF must authorise SES."
  }

  assert {
    condition     = length(cloudflare_dns_record.ses_dkim) == 3 && alltrue([for r in cloudflare_dns_record.ses_dkim : r.type == "CNAME" && !r.proxied])
    error_message = "Easy DKIM is three DNS-only CNAMEs."
  }

  assert {
    condition     = alltrue([for r in cloudflare_dns_record.cert_validation : !r.proxied])
    error_message = "ACM validation records must be DNS-only or validation never completes."
  }
}

run "certificate_covers_only_the_apex_and_the_alias_uses_it" {
  command = plan

  assert {
    condition     = aws_acm_certificate.site.domain_name == "stitchesncolorstudio.com" && aws_acm_certificate.site.validation_method == "DNS"
    error_message = "One DNS-validated certificate for the apex."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.aliases == toset(["stitchesncolorstudio.com"])
    error_message = "The distribution must serve the apex."
  }

  assert {
    condition = (
      aws_cloudfront_distribution.site.viewer_certificate[0].ssl_support_method == "sni-only" &&
      aws_cloudfront_distribution.site.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021" &&
      coalesce(aws_cloudfront_distribution.site.viewer_certificate[0].cloudfront_default_certificate, false) == false
    )
    error_message = "SNI with a TLS 1.2+ policy and no default certificate."
  }
}

run "failures_reach_the_owner" {
  command = plan

  assert {
    condition     = aws_sns_topic_subscription.alerts.protocol == "email" && aws_sns_topic_subscription.alerts.endpoint == "quotes@stitchesncolorstudio.com"
    error_message = "Alarms must email the owner address."
  }

  assert {
    condition = (
      aws_cloudwatch_metric_alarm.lambda_errors.namespace == "AWS/Lambda" &&
      aws_cloudwatch_metric_alarm.lambda_errors.metric_name == "Errors" &&
      aws_cloudwatch_metric_alarm.lambda_errors.dimensions["FunctionName"] == "sncs-contact"
    )
    error_message = "Alarm on contact function errors."
  }

  assert {
    condition = (
      aws_cloudwatch_metric_alarm.api_5xx.namespace == "AWS/ApiGateway" &&
      aws_cloudwatch_metric_alarm.api_5xx.metric_name == "5xx" &&
      aws_cloudwatch_metric_alarm.api_5xx.dimensions["ApiId"] == "abc123"
    )
    error_message = "Alarm on API Gateway 5xx for this API."
  }

  assert {
    condition = (
      aws_cloudwatch_metric_alarm.ses_bounce_rate.namespace == "AWS/SES" &&
      aws_cloudwatch_metric_alarm.ses_bounce_rate.metric_name == "Reputation.BounceRate" &&
      aws_cloudwatch_metric_alarm.ses_bounce_rate.threshold == 0.05
    )
    error_message = "Alarm when the SES bounce rate reaches 5%."
  }

  assert {
    condition = alltrue([
      for a in [aws_cloudwatch_metric_alarm.lambda_errors, aws_cloudwatch_metric_alarm.api_5xx, aws_cloudwatch_metric_alarm.ses_bounce_rate] :
      a.treat_missing_data == "notBreaching" && length(a.alarm_actions) == 1
    ])
    error_message = "Quiet periods are not failures, and every alarm must notify."
  }
}

run "cloudflare_zone_is_hardened_without_losing_existing_rules" {
  command = plan

  assert {
    condition     = cloudflare_zone_setting.ssl.setting_id == "ssl" && cloudflare_zone_setting.ssl.value == "strict"
    error_message = "SSL must be Full (strict) so Cloudflare validates CloudFront's certificate."
  }

  assert {
    condition = anytrue([
      for r in cloudflare_ruleset.custom_firewall.rules :
      r.action == "block" && r.expression == "(ip.geoip.country ne \"US\")" && r.enabled
    ])
    error_message = "The existing US-only block must be preserved."
  }

  assert {
    condition = anytrue([
      for r in cloudflare_ruleset.custom_firewall.rules :
      r.action == "block" && alltrue([
        for p in ["/.env", "/.git", "/wp-", "/xmlrpc.php", "phpmyadmin", "/cgi-bin/", "/vendor/phpunit", ".php"] :
        strcontains(r.expression, p)
      ])
    ])
    error_message = "One block rule must cover every scanner path."
  }

  assert {
    condition     = cloudflare_ruleset.custom_firewall.phase == "http_request_firewall_custom" && cloudflare_ruleset.custom_firewall.kind == "zone"
    error_message = "Custom rules live in the zone's custom firewall phase."
  }

  assert {
    condition = (
      cloudflare_ruleset.managed.phase == "http_request_firewall_managed" &&
      anytrue([for r in cloudflare_ruleset.managed.rules : r.action == "execute" && r.action_parameters.id == "77454fe2d30c4220b5701f6fdfb893ba" && r.enabled])
    )
    error_message = "The Cloudflare Free Managed Ruleset must be executed."
  }

  assert {
    condition = (
      cloudflare_ruleset.rate_limit.phase == "http_ratelimit" &&
      anytrue([
        for r in cloudflare_ruleset.rate_limit.rules :
        r.action == "block" &&
        r.ratelimit.requests_per_period == 100 && r.ratelimit.period == 10 && r.ratelimit.mitigation_timeout == 10 &&
        contains(r.ratelimit.characteristics, "ip.src") &&
        strcontains(r.expression, "/assets/")
      ])
    )
    error_message = "Rate limit: 100 requests per 10s per IP, static assets excluded."
  }
}

run "www_redirects_to_the_apex_permanently" {
  command = plan

  assert {
    condition     = cloudflare_ruleset.www_redirect.phase == "http_request_dynamic_redirect"
    error_message = "Redirects live in the dynamic redirect phase."
  }

  assert {
    condition = anytrue([
      for r in cloudflare_ruleset.www_redirect.rules :
      r.action == "redirect" &&
      strcontains(r.expression, "www.stitchesncolorstudio.com") &&
      r.action_parameters.from_value.status_code == 301 &&
      r.action_parameters.from_value.preserve_query_string &&
      strcontains(r.action_parameters.from_value.target_url.expression, "https://stitchesncolorstudio.com") &&
      strcontains(r.action_parameters.from_value.target_url.expression, "http.request.uri.path")
    ])
    error_message = "www must 301 to https://<apex> keeping path and query."
  }
}
