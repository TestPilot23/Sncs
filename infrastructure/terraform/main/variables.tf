variable "aws_region" {
  type        = string
  description = "Single region for everything: CloudFront ACM and SES both work from us-east-1."
  default     = "us-east-1"
}

variable "domain" {
  type        = string
  description = "Canonical apex domain, also the Cloudflare zone name."
  default     = "stitchesncolorstudio.com"
}
