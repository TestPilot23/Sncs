resource "aws_sesv2_configuration_set" "sncs" {
  configuration_set_name = local.ses_config_set

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity         = var.domain
  configuration_set_name = aws_sesv2_configuration_set.sncs.configuration_set_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity = aws_sesv2_email_identity.domain.email_identity

  mail_from_domain       = "bounce.${var.domain}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"

  # SES verifies the MX and SPF records; create them first.
  depends_on = [cloudflare_dns_record.mail_from_mx, cloudflare_dns_record.mail_from_spf]
}
