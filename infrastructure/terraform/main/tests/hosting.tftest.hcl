# Property tests for the hosting stack: what must be true of the result, not how the HCL reads.
# Providers are mocked, so these run offline with no credentials.

mock_provider "aws" {}
mock_provider "cloudflare" {}

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

override_data {
  target = data.aws_caller_identity.current
  values = {
    account_id = "123456789012"
  }
}

run "site_bucket_is_private_versioned_and_expires_old_versions" {
  command = plan

  assert {
    condition = (
      aws_s3_bucket_public_access_block.site.block_public_acls &&
      aws_s3_bucket_public_access_block.site.block_public_policy &&
      aws_s3_bucket_public_access_block.site.ignore_public_acls &&
      aws_s3_bucket_public_access_block.site.restrict_public_buckets
    )
    error_message = "Site bucket must block all public access."
  }

  assert {
    condition     = aws_s3_bucket_versioning.site.versioning_configuration[0].status == "Enabled"
    error_message = "Site bucket must be versioned so a bad deploy can be restored."
  }

  assert {
    condition = anytrue([
      for r in aws_s3_bucket_lifecycle_configuration.site.rule :
      r.status == "Enabled" && one(r.noncurrent_version_expiration).noncurrent_days == 30
    ])
    error_message = "Noncurrent versions must expire after 30 days."
  }
}

run "only_this_distribution_can_read_the_bucket" {
  command = plan

  assert {
    condition = alltrue([
      for s in jsondecode(aws_s3_bucket_policy.site.policy).Statement :
      s.Effect == "Deny" || (
        s.Principal.Service == "cloudfront.amazonaws.com" &&
        s.Condition.StringEquals["AWS:SourceArn"] == "arn:aws:cloudfront::123456789012:distribution/EXAMPLE"
      )
    ])
    error_message = "Every Allow must be CloudFront, scoped to this distribution's ARN."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_s3_bucket_policy.site.policy).Statement :
      try(s.Principal, "") != "*" && try(s.Principal.AWS, "") != "*" || s.Effect == "Deny"
    ])
    error_message = "No Allow statement may use a wildcard principal."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_s3_bucket_policy.site.policy).Statement :
      s.Effect == "Deny" || !contains(try(tolist(s.Action), [s.Action]), "s3:PutObject")
    ])
    error_message = "CloudFront must only be able to read, never write, the bucket."
  }
}

run "distribution_uses_oac_https_and_no_waf" {
  command = plan

  assert {
    condition     = aws_cloudfront_origin_access_control.site.signing_behavior == "always" && aws_cloudfront_origin_access_control.site.signing_protocol == "sigv4"
    error_message = "Origin access control must always sign with SigV4."
  }

  assert {
    condition     = alltrue([for o in aws_cloudfront_distribution.site.origin : o.origin_access_control_id != null && length(o.s3_origin_config) == 0])
    error_message = "Origins must use OAC, not the legacy origin access identity."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "HTTP must be redirected to HTTPS."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.web_acl_id == null || aws_cloudfront_distribution.site.web_acl_id == ""
    error_message = "No AWS WAF web ACL may be attached."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_root_object == "index.html"
    error_message = "Root must serve index.html."
  }
}

run "client_route_fallback_does_not_mask_errors" {
  command = plan

  assert {
    condition     = length(aws_cloudfront_distribution.site.custom_error_response) == 0
    error_message = "Distribution-wide custom error responses would rewrite API errors into index.html."
  }

  assert {
    condition = anytrue([
      for f in aws_cloudfront_distribution.site.default_cache_behavior[0].function_association :
      f.event_type == "viewer-request"
    ])
    error_message = "The SPA fallback function must run on viewer-request for the site behavior."
  }
}

run "cache_policy_honours_origin_no_cache" {
  command = plan

  assert {
    condition     = aws_cloudfront_cache_policy.site.min_ttl == 0
    error_message = "A min TTL above 0 would cache index.html despite Cache-Control: no-cache."
  }

  assert {
    condition = (
      aws_cloudfront_cache_policy.site.parameters_in_cache_key_and_forwarded_to_origin[0].enable_accept_encoding_brotli &&
      aws_cloudfront_cache_policy.site.parameters_in_cache_key_and_forwarded_to_origin[0].enable_accept_encoding_gzip
    )
    error_message = "Compression must be enabled."
  }
}

run "security_headers_match_the_spec" {
  command = plan

  assert {
    condition = (
      aws_cloudfront_response_headers_policy.site.security_headers_config[0].strict_transport_security[0].access_control_max_age_sec >= 31536000 &&
      !aws_cloudfront_response_headers_policy.site.security_headers_config[0].strict_transport_security[0].include_subdomains &&
      !aws_cloudfront_response_headers_policy.site.security_headers_config[0].strict_transport_security[0].preload &&
      aws_cloudfront_response_headers_policy.site.security_headers_config[0].strict_transport_security[0].override
    )
    error_message = "HSTS: at least one year, no includeSubDomains, no preload, overriding the origin."
  }

  assert {
    condition = (
      aws_cloudfront_response_headers_policy.site.security_headers_config[0].content_type_options[0].override &&
      aws_cloudfront_response_headers_policy.site.security_headers_config[0].frame_options[0].frame_option == "SAMEORIGIN" &&
      aws_cloudfront_response_headers_policy.site.security_headers_config[0].referrer_policy[0].referrer_policy == "strict-origin-when-cross-origin"
    )
    error_message = "nosniff, X-Frame-Options SAMEORIGIN and the referrer policy must be set."
  }

  assert {
    condition     = length(aws_cloudfront_response_headers_policy.site.security_headers_config[0].content_security_policy) == 0
    error_message = "No Content-Security-Policy may be enforced until validated in report-only mode."
  }
}
