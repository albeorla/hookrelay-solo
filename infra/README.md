# Infra Setup (Terraform)

- Directory: `infra/terraform`
- Requires: Terraform >= 1.5 and AWS credentials with permissions for KMS, S3, DynamoDB, SQS.

Quick start
- cd infra/terraform
- terraform init
- terraform plan -var="project_name=hookrelay" -var="aws_region=us-east-1"
- terraform apply

Outputs
- KMS key ARN, DLQ bucket, SQS delivery attempts queue, DynamoDB table names.

Next
- Prefer containers: ECS Fargate services for `ingest` (behind ALB) and `worker` (SQS poller).
- Build/push container images to ECR via GitHub Actions, then `terraform apply` to deploy.
