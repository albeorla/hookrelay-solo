#!/usr/bin/env bash
set -euo pipefail

LS=${LOCALSTACK_ENDPOINT:-http://localhost:4566}
AWS=${AWS_CLI:-aws}
REGION=${AWS_REGION:-us-east-1}

export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=$REGION

echo "Creating SQS queue..."
$AWS --endpoint-url "$LS" sqs create-queue --queue-name hookrelay-delivery-attempts >/dev/null

echo "Creating S3 bucket..."
$AWS --endpoint-url "$LS" s3api create-bucket --bucket hookrelay-dlq >/dev/null || true

echo "Creating DynamoDB tables..."
$AWS --endpoint-url "$LS" dynamodb create-table --table-name hookrelay-endpoints \
  --attribute-definitions AttributeName=endpoint_id,AttributeType=S \
  --key-schema AttributeName=endpoint_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST >/dev/null || true

$AWS --endpoint-url "$LS" dynamodb create-table --table-name hookrelay-idempotency \
  --attribute-definitions AttributeName=idempotency_key,AttributeType=S \
  --key-schema AttributeName=idempotency_key,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST >/dev/null || true

$AWS --endpoint-url "$LS" dynamodb create-table --table-name hookrelay-deliveries \
  --attribute-definitions AttributeName=endpoint_id,AttributeType=S AttributeName=delivery_id,AttributeType=S \
  --key-schema AttributeName=endpoint_id,KeyType=HASH AttributeName=delivery_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST >/dev/null || true

echo "Seeding example endpoint..."
$AWS --endpoint-url "$LS" dynamodb put-item --table-name hookrelay-endpoints \
  --item '{"endpoint_id":{"S":"ep_demo"},"dest_url":{"S":"https://httpbin.org/post"},"hmac_mode":{"S":"generic"},"secret":{"S":"dev-secret"}}' >/dev/null

echo "Done. Ingest URL: http://localhost:3000/ingest/ep_demo"

