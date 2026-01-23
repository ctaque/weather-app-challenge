# CloudWatch Configuration pour EC2 Logs

# IAM Role pour l'instance EC2
resource "aws_iam_role" "ec2_cloudwatch" {
  name = "${var.project_name}-ec2-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-ec2-cloudwatch-role"
    Environment = var.environment
  }
}

# IAM Policy pour CloudWatch Logs
resource "aws_iam_role_policy" "ec2_cloudwatch_logs" {
  name = "${var.project_name}-cloudwatch-logs-policy"
  role = aws_iam_role.ec2_cloudwatch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/ec2/${var.project_name}*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      }
    ]
  })
}

# Instance Profile pour attacher le role à l'EC2
resource "aws_iam_instance_profile" "ec2_cloudwatch" {
  name = "${var.project_name}-ec2-cloudwatch-profile"
  role = aws_iam_role.ec2_cloudwatch.name

  tags = {
    Name        = "${var.project_name}-ec2-cloudwatch-profile"
    Environment = var.environment
  }
}

# Log Group principal (déjà existant dans main.tf, mais on le garde ici pour cohérence)
resource "aws_cloudwatch_log_group" "ec2_main" {
  name              = "/aws/ec2/${var.project_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name        = "${var.project_name}-ec2-logs"
    Environment = var.environment
  }
}

# Log Streams pour différents types de logs
resource "aws_cloudwatch_log_stream" "application" {
  name           = "application"
  log_group_name = aws_cloudwatch_log_group.ec2_main.name
}

resource "aws_cloudwatch_log_stream" "application_errors" {
  name           = "application-errors"
  log_group_name = aws_cloudwatch_log_group.ec2_main.name
}

resource "aws_cloudwatch_log_stream" "user_data" {
  name           = "user-data"
  log_group_name = aws_cloudwatch_log_group.ec2_main.name
}

resource "aws_cloudwatch_log_stream" "nginx_access" {
  name           = "nginx-access"
  log_group_name = aws_cloudwatch_log_group.ec2_main.name
}

resource "aws_cloudwatch_log_stream" "nginx_error" {
  name           = "nginx-error"
  log_group_name = aws_cloudwatch_log_group.ec2_main.name
}

resource "aws_cloudwatch_log_stream" "redis" {
  name           = "redis"
  log_group_name = aws_cloudwatch_log_group.ec2_main.name
}

resource "aws_cloudwatch_log_stream" "system" {
  name           = "system"
  log_group_name = aws_cloudwatch_log_group.ec2_main.name
}

# CloudWatch Alarm pour surveiller les erreurs
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.project_name}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "IncomingLogEvents"
  namespace           = "AWS/Logs"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "This metric monitors application error logs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LogGroupName = aws_cloudwatch_log_group.ec2_main.name
  }

  tags = {
    Name        = "${var.project_name}-error-alarm"
    Environment = var.environment
  }
}

# CloudWatch Dashboard pour visualiser les métriques
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "log"
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.ec2_main.name}' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region  = var.aws_region
          title   = "Recent Application Logs"
          stacked = false
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "EC2 CPU Utilization"
        }
      }
    ]
  })
}
