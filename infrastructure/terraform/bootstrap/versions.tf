terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Bucket and region are passed at init (-backend-config). The key is outside the `main/*` prefix
  # that the CI roles can read or lock, so the pipeline cannot see or alter the bootstrap state.
  backend "s3" {
    key          = "bootstrap/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}
