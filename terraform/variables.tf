variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3" # Paris - le moins cher en Europe
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "weather-app"
}

# EC2
variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro" # Free tier eligible
}

variable "ec2_key_name" {
  description = "EC2 SSH key pair name"
  type        = string
}

variable "ssh_allowed_ips" {
  description = "IPs allowed to SSH to EC2"
  type        = list(string)
  default     = ["0.0.0.0/0"] # À restreindre en production!
}

# RDS
variable "rds_instance_type" {
  description = "RDS instance type"
  type        = string
  default     = "db.t4g.micro" # Le moins cher
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "weatherapp"
}

variable "db_username" {
  description = "PostgreSQL username"
  type        = string
  default     = "weatherapp_user"
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

# Application secrets
variable "weatherapi_key" {
  description = "WeatherAPI key"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
}

# Domain
variable "domain_name" {
  description = "Domain name (optional)"
  type        = string
  default     = ""
}
