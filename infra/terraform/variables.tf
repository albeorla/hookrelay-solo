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

variable "ingest_container_port" {
  type        = number
  description = "Container port for ingest service"
  default     = 3000
}
