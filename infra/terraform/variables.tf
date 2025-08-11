variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Project tag/name prefix"
  default     = "hookrelay"
}

// Ingest is handled by API Gateway -> SQS; no container port needed
