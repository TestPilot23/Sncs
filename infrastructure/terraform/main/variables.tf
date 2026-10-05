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

variable "owner_emails" {
  type        = list(string)
  description = "Addresses that receive quote requests. Empty makes the form fail loudly (502) rather than lose leads silently."
  default     = []
}

variable "shop_phone" {
  type        = string
  description = "Shown in the customer auto-reply."
  default     = "(314) 921-7075"
}

variable "shop_hours" {
  type        = string
  description = "Shown in the customer auto-reply."
  default     = "Monday–Friday, 9 AM – 4 PM"
}

variable "contact_reserved_concurrency" {
  type        = number
  description = "Reserved concurrency for the contact function; -1 leaves it unreserved. This account's Lambda quota is 10 and AWS requires 10 to stay unreserved, so any positive value fails until the quota is raised."
  default     = -1
}

