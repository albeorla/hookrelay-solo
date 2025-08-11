output "kms_key_arn" { value = aws_kms_key.primary.arn }
output "dlq_bucket"  { value = aws_s3_bucket.dlq_payloads.bucket }
output "sqs_delivery_attempts_arn" { value = aws_sqs_queue.delivery_attempts.arn }
output "ddb_deliveries" { value = aws_dynamodb_table.deliveries.name }
output "ddb_idempotency" { value = aws_dynamodb_table.idempotency.name }
output "ddb_endpoints" { value = aws_dynamodb_table.endpoints.name }
output "ddb_replay_jobs" { value = aws_dynamodb_table.replay_jobs.name }

