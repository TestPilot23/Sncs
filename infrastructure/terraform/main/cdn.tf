resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "sncs-site"
  description                       = "Signs CloudFront requests to the private site bucket."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Honour the origin's Cache-Control. min_ttl must stay 0 or index.html (no-cache) would be cached.
resource "aws_cloudfront_cache_policy" "site" {
  name        = "sncs-site"
  comment     = "Respect origin Cache-Control; key on path only."
  min_ttl     = 0
  default_ttl = 86400
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "site" {
  name    = "sncs-site-security-headers"
  comment = "Baseline browser security headers. No CSP until validated in report-only mode."

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
}

resource "aws_cloudfront_function" "spa_fallback" {
  name    = "sncs-spa-fallback"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for extensionless client-side paths; never touches /api."
  publish = true
  code    = file("${path.module}/../../cloudfront/spa-fallback.js")
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  default_root_object = "index.html"
  comment             = "Sncs marketing site"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "site-bucket"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id           = "site-bucket"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.site.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_fallback.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # The custom domain and ACM certificate arrive with the Cloudflare/domain work (Phase 4).
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
