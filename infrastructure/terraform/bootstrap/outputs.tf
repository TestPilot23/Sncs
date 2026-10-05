output "state_bucket" {
  value       = aws_s3_bucket.state.id
  description = "Terraform state bucket for the main root (backend bucket)."
}

output "plan_role_arn" {
  value       = aws_iam_role.plan.arn
  description = "Role GitHub Actions assumes for read-only plans."
}

output "release_role_arn" {
  value       = aws_iam_role.release.arn
  description = "Role GitHub Actions assumes, from the production environment only, to apply and deploy."
}
