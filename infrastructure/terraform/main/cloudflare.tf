# Free-tier edge protection, same pattern as CouncilAnchor but managed here so it cannot drift.

resource "cloudflare_zone_setting" "ssl" {
  zone_id    = local.zone_id
  setting_id = "ssl"
  value      = "strict" # Cloudflare validates CloudFront's ACM certificate
}

# Adopted from the zone, not created: the zone already had the US-only rule (since 2023) in this
# phase, and a ruleset resource replaces everything in its phase. It was imported into state first
# (terraform import cloudflare_ruleset.custom_firewall zones/<zone_id>/<ruleset_id>).
resource "cloudflare_ruleset" "custom_firewall" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules = [
    {
      description = "Block all traffic from outside the US"
      enabled     = true
      action      = "block"
      expression  = "(ip.geoip.country ne \"US\")"
    },
    {
      description = "Block common scanner and exploit paths"
      enabled     = true
      action      = "block"
      expression  = "(http.request.uri.path contains \"/.env\") or (http.request.uri.path contains \"/.git\") or (starts_with(http.request.uri.path, \"/wp-\")) or (http.request.uri.path eq \"/xmlrpc.php\") or (http.request.uri.path contains \"phpmyadmin\") or (http.request.uri.path contains \"/cgi-bin/\") or (http.request.uri.path contains \"/vendor/phpunit\") or (ends_with(http.request.uri.path, \".php\"))"
    },
  ]
}

resource "cloudflare_ruleset" "managed" {
  zone_id = local.zone_id
  name    = "managed"
  kind    = "zone"
  phase   = "http_request_firewall_managed"

  rules = [{
    description       = "Cloudflare Free Managed Ruleset"
    enabled           = true
    action            = "execute"
    expression        = "true"
    action_parameters = { id = "77454fe2d30c4220b5701f6fdfb893ba" }
  }]
}

# The free plan allows one rate-limit rule with a 10 second window, so it is zone-wide; the contact
# form's own limits are Turnstile, API Gateway throttling and the function's validation.
resource "cloudflare_ruleset" "rate_limit" {
  zone_id = local.zone_id
  name    = "rate-limit"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules = [{
    description = "Block a client sending over 100 requests per 10 seconds (static assets excluded)"
    enabled     = true
    action      = "block"
    expression  = "(not starts_with(http.request.uri.path, \"/assets/\"))"
    ratelimit = {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 10
      requests_per_period = 100
      mitigation_timeout  = 10
    }
  }]
}

# www has no record of its own: the proxied wildcard catches it, and this rule answers at the edge
# before any origin is contacted.
resource "cloudflare_ruleset" "www_redirect" {
  zone_id = local.zone_id
  name    = "www-to-apex"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules = [{
    description = "301 www to the apex, keeping path and query"
    enabled     = true
    action      = "redirect"
    expression  = "(http.host eq \"www.${var.domain}\")"
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://${var.domain}\", http.request.uri.path)"
        }
      }
    }
  }]
}
