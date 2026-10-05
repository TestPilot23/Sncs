# Domain, certificate and DNS. Cloudflare holds the zone; nothing here touches the apex MX or TXT
# (Google Workspace owns those), and the apex A record is replaced by an operator at cutover.

locals {
  dns_ttl = 1 # Cloudflare "auto"
  zone_id = data.cloudflare_zone.site.id
}

data "cloudflare_zone" "site" {
  filter = { name = var.domain }
}

# --- Certificate (CloudFront requires us-east-1, which is this stack's region)

resource "aws_acm_certificate" "site" {
  domain_name       = var.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Keyed on the static domain name so the instance keys are known at plan time; only the record
# values come from the certificate.
locals {
  cert_validation_options = { for o in aws_acm_certificate.site.domain_validation_options : o.domain_name => o }
}

resource "cloudflare_dns_record" "cert_validation" {
  for_each = toset([var.domain])

  zone_id = local.zone_id
  name    = trimsuffix(local.cert_validation_options[each.key].resource_record_name, ".")
  type    = local.cert_validation_options[each.key].resource_record_type
  content = trimsuffix(local.cert_validation_options[each.key].resource_record_value, ".")
  ttl     = local.dns_ttl
  proxied = false
}

# The distribution alias depends on this, so the alias is only attached once the certificate has
# actually been issued.
resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in cloudflare_dns_record.cert_validation : r.name]
}

# --- SES sender verification (Easy DKIM: three CNAMEs; count is fixed because the token values are
# only known after the identity exists)

resource "cloudflare_dns_record" "ses_dkim" {
  count = 3

  zone_id = local.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  content = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"
  ttl     = local.dns_ttl
  proxied = false
}

# Custom MAIL FROM on bounce.<domain>. It lives on a subdomain so SES gets SPF alignment without
# touching the apex SPF record that Google Workspace owns. (mail.<domain> is already a Google CNAME.)
resource "cloudflare_dns_record" "mail_from_mx" {
  zone_id  = local.zone_id
  name     = "bounce.${var.domain}"
  type     = "MX"
  content  = "feedback-smtp.${var.aws_region}.amazonses.com"
  priority = 10
  ttl      = local.dns_ttl
  proxied  = false
}

resource "cloudflare_dns_record" "mail_from_spf" {
  zone_id = local.zone_id
  name    = "bounce.${var.domain}"
  type    = "TXT"
  content = "\"v=spf1 include:amazonses.com ~all\""
  ttl     = local.dns_ttl
  proxied = false
}
