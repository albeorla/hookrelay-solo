# HookRelay Production Deployment Guide

This guide covers deploying HookRelay to production with proper AWS configuration and security best practices.

## AWS Infrastructure Requirements

### Required AWS Services

1. **DynamoDB** - For storing webhook endpoints and delivery records
2. **SQS** - For queuing webhook delivery attempts with retry logic
3. **S3** - For dead letter queue storage of permanently failed webhooks

### AWS Permissions

Create an IAM role or user with the following minimum permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/prod-hookrelay-endpoints",
        "arn:aws:dynamodb:*:*:table/prod-hookrelay-deliveries"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:GetQueueAttributes",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage"
      ],
      "Resource": "arn:aws:sqs:*:*:prod-hookrelay-delivery-attempts"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::prod-hookrelay-dlq",
        "arn:aws:s3:::prod-hookrelay-dlq/*"
      ]
    }
  ]
}
```

## Environment Configuration

### 1. Copy Production Environment Template

```bash
cp .env.production.example .env.production
```

### 2. Configure Environment Variables

Edit `.env.production` with your production values:

```bash
# Database
DATABASE_URL="postgresql://prod_user:secure_password@prod-db.amazonaws.com:5432/hookrelay_prod"

# NextAuth.js
AUTH_SECRET="super-secure-production-secret-at-least-32-characters"
AUTH_DISCORD_ID="your-production-discord-client-id"
AUTH_DISCORD_SECRET="your-production-discord-client-secret"

# AWS Configuration
NODE_ENV="production"
AWS_REGION="us-east-1"

# AWS Resource Names (customize for your environment)
AWS_DDB_ENDPOINTS_TABLE="prod-hookrelay-endpoints"
AWS_DDB_DELIVERIES_TABLE="prod-hookrelay-deliveries"
AWS_SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/prod-hookrelay-delivery-attempts"
AWS_S3_DLQ_BUCKET="prod-hookrelay-dlq"
```

### 3. AWS Credentials

**Option A: IAM Roles (Recommended)**
- Deploy to EC2, ECS, or Lambda with IAM roles
- No need to set AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY
- Most secure approach

**Option B: Environment Variables**
```bash
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
```

## AWS Resource Setup

### 1. Create DynamoDB Tables

```bash
# Endpoints Table
aws dynamodb create-table \
  --table-name prod-hookrelay-endpoints \
  --attribute-definitions AttributeName=endpoint_id,AttributeType=S \
  --key-schema AttributeName=endpoint_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Deliveries Table
aws dynamodb create-table \
  --table-name prod-hookrelay-deliveries \
  --attribute-definitions \
    AttributeName=endpoint_id,AttributeType=S \
    AttributeName=delivery_id,AttributeType=S \
  --key-schema \
    AttributeName=endpoint_id,KeyType=HASH \
    AttributeName=delivery_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 2. Create SQS Queue

```bash
# Main delivery queue with dead letter queue
aws sqs create-queue \
  --queue-name prod-hookrelay-delivery-attempts \
  --attributes '{
    "VisibilityTimeoutSeconds": "300",
    "MaxReceiveCount": "3",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:YOUR_ACCOUNT_ID:prod-hookrelay-dlq\",\"maxReceiveCount\":3}"
  }' \
  --region us-east-1

# Dead letter queue (for permanently failed messages)
aws sqs create-queue \
  --queue-name prod-hookrelay-dlq \
  --region us-east-1
```

### 3. Create S3 Bucket

```bash
# Create S3 bucket for dead letter queue storage
aws s3 mb s3://prod-hookrelay-dlq --region us-east-1

# Enable versioning and configure lifecycle
aws s3api put-bucket-versioning \
  --bucket prod-hookrelay-dlq \
  --versioning-configuration Status=Enabled

# Configure lifecycle policy to delete old objects after 90 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket prod-hookrelay-dlq \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "DeleteOldDLQItems",
      "Status": "Enabled",
      "Filter": {},
      "Expiration": {
        "Days": 90
      }
    }]
  }'
```

## Deployment Options

### Option 1: Docker Deployment

1. **Build Production Image**
```bash
docker build -t hookrelay-prod .
```

2. **Run with Environment Variables**
```bash
docker run -d \
  --name hookrelay-prod \
  --env-file .env.production \
  -p 3000:3000 \
  hookrelay-prod
```

### Option 2: AWS ECS Deployment

1. **Create Task Definition** (`ecs-task-definition.json`)
```json
{
  "family": "hookrelay-prod",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/hookrelay-task-role",
  "containerDefinitions": [
    {
      "name": "hookrelay",
      "image": "YOUR_ECR_REPO:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "AWS_REGION", "value": "us-east-1"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:us-east-1:YOUR_ACCOUNT_ID:parameter/hookrelay/database-url"},
        {"name": "AUTH_SECRET", "valueFrom": "arn:aws:ssm:us-east-1:YOUR_ACCOUNT_ID:parameter/hookrelay/auth-secret"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/hookrelay-prod",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

2. **Deploy to ECS**
```bash
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
aws ecs create-service \
  --cluster prod-cluster \
  --service-name hookrelay-prod \
  --task-definition hookrelay-prod:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-12345", "subnet-67890"],
      "securityGroups": ["sg-security-group-id"],
      "assignPublicIp": "ENABLED"
    }
  }'
```

### Option 3: AWS Lambda Deployment (Serverless)

1. **Install Serverless Framework**
```bash
npm install -g serverless
```

2. **Create `serverless.yml`**
```yaml
service: hookrelay-prod

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: prod
  environment:
    NODE_ENV: production
    AWS_REGION: us-east-1
  iamRoleStatements:
    - Effect: Allow
      Action:
        - dynamodb:*
      Resource:
        - "arn:aws:dynamodb:*:*:table/prod-hookrelay-*"
    - Effect: Allow
      Action:
        - sqs:*
      Resource:
        - "arn:aws:sqs:*:*:prod-hookrelay-*"
    - Effect: Allow
      Action:
        - s3:*
      Resource:
        - "arn:aws:s3:::prod-hookrelay-dlq"
        - "arn:aws:s3:::prod-hookrelay-dlq/*"

functions:
  app:
    handler: lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
      - http:
          path: /
          method: ANY

plugins:
  - serverless-nextjs-plugin
```

## Monitoring and Observability

### 1. CloudWatch Metrics

Key metrics to monitor:
- DynamoDB read/write capacity and throttling
- SQS queue depth and message age
- Lambda duration and error rate (if using serverless)
- Application error rate and response time

### 2. Alarms

```bash
# High SQS queue depth
aws cloudwatch put-metric-alarm \
  --alarm-name "HookRelay-HighQueueDepth" \
  --alarm-description "SQS queue depth is high" \
  --metric-name ApproximateNumberOfMessages \
  --namespace AWS/SQS \
  --statistic Average \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=QueueName,Value=prod-hookrelay-delivery-attempts

# High error rate
aws cloudwatch put-metric-alarm \
  --alarm-name "HookRelay-HighErrorRate" \
  --alarm-description "Application error rate is high" \
  --metric-name 4XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

## Security Best Practices

### 1. Network Security
- Use VPC for all resources
- Configure security groups to allow only necessary traffic
- Use WAF for web application protection
- Enable VPC Flow Logs

### 2. Data Security
- Enable encryption at rest for DynamoDB, S3, and SQS
- Use SSL/TLS for all data in transit
- Rotate secrets regularly
- Implement proper HMAC verification for webhook security

### 3. Access Control
- Use IAM roles instead of hardcoded credentials
- Implement least-privilege access
- Enable CloudTrail for audit logging
- Use AWS Secrets Manager for sensitive configuration

### 4. Application Security
- Keep dependencies updated
- Run security scans in CI/CD
- Implement proper input validation
- Use HTTPS only in production

## Backup and Disaster Recovery

### 1. Database Backups
- Enable DynamoDB point-in-time recovery
- Configure automatic backups for PostgreSQL
- Test backup restoration procedures

### 2. Cross-Region Replication
- Set up DynamoDB Global Tables for high availability
- Configure S3 cross-region replication
- Use Route 53 for DNS failover

## Performance Optimization

### 1. Scaling Configuration
- Use DynamoDB auto-scaling
- Configure SQS visibility timeout appropriately
- Set up application auto-scaling based on metrics

### 2. Caching
- Implement Redis/ElastiCache for frequent queries
- Use CloudFront for static asset caching
- Cache endpoint configurations in memory

### 3. Database Optimization
- Use DynamoDB indexes for efficient queries
- Configure connection pooling for PostgreSQL
- Monitor slow queries and optimize

## Troubleshooting

### Common Issues

1. **AWS Credentials Not Found**
   - Verify IAM role is attached (for EC2/ECS/Lambda)
   - Check environment variables are set correctly
   - Ensure AWS CLI is configured if running locally

2. **DynamoDB Access Denied**
   - Verify IAM permissions include required DynamoDB actions
   - Check table names match configuration
   - Ensure region is correct

3. **SQS Messages Not Processing**
   - Check queue URL is correct
   - Verify SQS permissions
   - Monitor dead letter queue for failed messages

### Debugging Commands

```bash
# Check AWS configuration
aws sts get-caller-identity

# Test DynamoDB access
aws dynamodb list-tables --region us-east-1

# Check SQS queue status
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/prod-hookrelay-delivery-attempts \
  --attribute-names All

# List S3 bucket contents
aws s3 ls s3://prod-hookrelay-dlq --recursive
```

## Cost Optimization

### 1. DynamoDB
- Use on-demand billing for unpredictable workloads
- Use provisioned capacity for predictable workloads
- Enable auto-scaling for provisioned capacity

### 2. SQS
- SQS charges per request - optimize batch sizes
- Use long polling to reduce empty receive costs

### 3. S3
- Use appropriate storage classes (Standard-IA for DLQ)
- Configure lifecycle policies to delete old data
- Enable compression for large payloads

This completes the production deployment guide. Make sure to test thoroughly in a staging environment before deploying to production.