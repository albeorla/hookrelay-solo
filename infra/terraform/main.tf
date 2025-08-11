resource "aws_kms_key" "primary" {
  description             = "KMS key for ${var.project_name} data"
  enable_key_rotation     = true
  deletion_window_in_days = 7
}

resource "aws_kms_alias" "primary" {
  name          = "alias/${var.project_name}"
  target_key_id = aws_kms_key.primary.id
}

resource "aws_s3_bucket" "dlq_payloads" {
  bucket_prefix = "${var.project_name}-dlq-"
  force_destroy = false
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dlq" {
  bucket = aws_s3_bucket.dlq_payloads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.primary.arn
    }
  }
}

resource "aws_dynamodb_table" "deliveries" {
  name         = "${var.project_name}-deliveries"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "endpoint_id"
  range_key    = "delivery_id"

  attribute { name = "endpoint_id"  type = "S" }
  attribute { name = "delivery_id"  type = "S" }
  attribute { name = "tenant_id"    type = "S" }
  attribute { name = "status"       type = "S" }
  attribute { name = "created_at"   type = "N" }

  ttl { attribute_name = "expires_at" enabled = true }
}

resource "aws_dynamodb_table" "idempotency" {
  name         = "${var.project_name}-idempotency"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "idempotency_key"

  attribute { name = "idempotency_key" type = "S" }
  ttl { attribute_name = "expires_at" enabled = true }
}

resource "aws_dynamodb_table" "endpoints" {
  name         = "${var.project_name}-endpoints"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "endpoint_id"

  attribute { name = "endpoint_id" type = "S" }
  attribute { name = "tenant_id"   type = "S" }

  global_secondary_index {
    name            = "tenant_id-index"
    hash_key        = "tenant_id"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "replay_jobs" {
  name         = "${var.project_name}-replay-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "job_id"

  attribute { name = "job_id"    type = "S" }
  attribute { name = "tenant_id" type = "S" }
}

resource "aws_sqs_queue" "poison_dlq" {
  name                      = "${var.project_name}-poison-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = aws_kms_key.primary.arn
}

resource "aws_sqs_queue" "delivery_attempts" {
  name                      = "${var.project_name}-delivery-attempts"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600
  kms_master_key_id          = aws_kms_key.primary.arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.poison_dlq.arn
    maxReceiveCount     = 5
  })
}

