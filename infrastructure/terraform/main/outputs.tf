output "site_bucket" {
  value       = aws_s3_bucket.site.id
  description = "Bucket the deploy step syncs dist/ into."
}

output "distribution_id" {
  value       = aws_cloudfront_distribution.site.id
  description = "Distribution to invalidate after a deploy."
}

output "distribution_domain" {
  value       = aws_cloudfront_distribution.site.domain_name
  description = "CloudFront domain, used to verify the site before DNS cutover."
}
