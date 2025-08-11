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
- Add API Gateway, Lambda roles, and EventBridge Scheduler resources per dev plan.
- Wire Lambda handlers in `aws/handlers/*` to IAM + triggers.

