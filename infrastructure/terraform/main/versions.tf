terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    # Reads CLOUDFLARE_API_TOKEN from the environment: no credentials in HCL, tfvars or state.
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # Partial config: bucket and region come from backend.hcl (see ../../README.md). The key is fixed
  # here so the pipeline roles' `main/*` state permissions always match it.
  backend "s3" {
    key          = "main/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "sncs"
      ManagedBy = "terraform"
      Stack     = "main"
    }
  }
}

provider "cloudflare" {}
