variable "aws_region" {
  type        = string
  description = "Single region for everything: CloudFront ACM and SES both work from us-east-1."
  default     = "us-east-1"
}

variable "github_org" {
  type        = string
  description = "GitHub organization or user that owns the repository."
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name."
}
