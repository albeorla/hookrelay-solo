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

# Networking: use default VPC and subnets for MVP
data "aws_vpc" "default" { default = true }
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "ALB security group"
  vpc_id      = data.aws_vpc.default.id

  ingress { from_port = 80 to_port = 80 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  egress  { from_port = 0  to_port = 0  protocol = "-1"  cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "service" {
  name        = "${var.project_name}-svc-sg"
  description = "ECS service security group"
  vpc_id      = data.aws_vpc.default.id

  ingress { from_port = var.ingest_container_port to_port = var.ingest_container_port protocol = "tcp" security_groups = [aws_security_group.alb.id] }
  egress  { from_port = 0  to_port = 0  protocol = "-1"  cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_lb" "ingest" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "ingest" {
  name        = "${var.project_name}-tg"
  port        = var.ingest_container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id

  health_check {
    path                = "/healthz"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 5
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.ingest.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ingest.arn
  }
}

# ECR repositories
resource "aws_ecr_repository" "ingest" {
  name = "${var.project_name}-ingest"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" kms_key = aws_kms_key.primary.arn }
}

resource "aws_ecr_repository" "worker" {
  name = "${var.project_name}-worker"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" kms_key = aws_kms_key.primary.arn }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  ingest_image = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/${aws_ecr_repository.ingest.name}:latest"
  worker_image = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/${aws_ecr_repository.worker.name}:latest"
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 14
  kms_key_id        = aws_kms_key.primary.arn
}

# IAM roles
resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.project_name}-ecs-exec-role"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project_name}-ecs-task-role"
  assume_role_policy = aws_iam_role.ecs_task_execution.assume_role_policy
}

resource "aws_iam_policy" "task_access" {
  name   = "${var.project_name}-task-access"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:SendMessage"], Resource = [aws_sqs_queue.delivery_attempts.arn, aws_sqs_queue.poison_dlq.arn] },
      { Effect = "Allow", Action = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:Query"], Resource = [aws_dynamodb_table.deliveries.arn, aws_dynamodb_table.idempotency.arn, aws_dynamodb_table.endpoints.arn, aws_dynamodb_table.replay_jobs.arn] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject"], Resource = ["${aws_s3_bucket.dlq_payloads.arn}/*"] },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = ["${aws_cloudwatch_log_group.ecs.arn}:*"] }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "task_access" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.task_access.arn
}

resource "aws_ecs_cluster" "this" {
  name = "${var.project_name}-cluster"
}

resource "aws_ecs_task_definition" "ingest" {
  family                   = "${var.project_name}-ingest"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions    = jsonencode([
    {
      name      = "ingest"
      image     = local.ingest_image
      essential = true
      portMappings = [{ containerPort = var.ingest_container_port, hostPort = var.ingest_container_port }]
      environment = [
        { name = "PORT", value = tostring(var.ingest_container_port) },
        { name = "SQS_URL", value = aws_sqs_queue.delivery_attempts.id }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options   = { awslogs-group = aws_cloudwatch_log_group.ecs.name, awslogs-region = data.aws_region.current.name, awslogs-stream-prefix = "ingest" }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project_name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions    = jsonencode([
    {
      name      = "worker"
      image     = local.worker_image
      essential = true
      environment = [ { name = "SQS_URL", value = aws_sqs_queue.delivery_attempts.id } ]
      logConfiguration = {
        logDriver = "awslogs"
        options   = { awslogs-group = aws_cloudwatch_log_group.ecs.name, awslogs-region = data.aws_region.current.name, awslogs-stream-prefix = "worker" }
      }
    }
  ])
}

resource "aws_ecs_service" "ingest" {
  name            = "${var.project_name}-ingest"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.ingest.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  platform_version = "1.4.0"

  network_configuration {
    subnets         = data.aws_subnets.default.ids
    security_groups = [aws_security_group.service.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ingest.arn
    container_name   = "ingest"
    container_port   = var.ingest_container_port
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_ecs_service" "worker" {
  name            = "${var.project_name}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 0
  platform_version = "1.4.0"

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
    base              = 0
  }

  network_configuration {
    subnets         = data.aws_subnets.default.ids
    security_groups = [aws_security_group.service.id]
    assign_public_ip = true
  }
}

# Scale-to-zero worker based on SQS backlog
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = 2
  min_capacity       = 0
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_scale_up" {
  name               = "${var.project_name}-worker-scale-up"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  step_scaling_policy_configuration {
    adjustment_type         = "ChangeInCapacity"
    cooldown                = 30
    metric_aggregation_type = "Average"

    step_adjustment {
      scaling_adjustment          = 1
      metric_interval_lower_bound = 0
    }
  }
}

resource "aws_appautoscaling_policy" "worker_scale_down" {
  name               = "${var.project_name}-worker-scale-down"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  step_scaling_policy_configuration {
    adjustment_type         = "ChangeInCapacity"
    cooldown                = 60
    metric_aggregation_type = "Average"

    step_adjustment {
      scaling_adjustment           = -1
      metric_interval_upper_bound  = 1
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_backlog_high" {
  alarm_name          = "${var.project_name}-sqs-backlog-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Scale up worker when SQS has messages"
  dimensions = { QueueName = aws_sqs_queue.delivery_attempts.name }
  alarm_actions = [aws_appautoscaling_policy.worker_scale_up.arn]
}

resource "aws_cloudwatch_metric_alarm" "sqs_backlog_low" {
  alarm_name          = "${var.project_name}-sqs-backlog-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_description   = "Scale down worker when SQS empty"
  dimensions = { QueueName = aws_sqs_queue.delivery_attempts.name }
  alarm_actions = [aws_appautoscaling_policy.worker_scale_down.arn]
}
