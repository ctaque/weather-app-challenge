# DigitalOcean Variables

variable "do_region" {
  description = "DigitalOcean region"
  type        = string
  default     = "fra1" # Frankfurt - proche de la France
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

# Droplet
variable "droplet_size" {
  description = "Droplet size/plan"
  type        = string
  default     = "s-1vcpu-2gb" # 2GB RAM, 1 vCPU - $12/mois
}

variable "droplet_image" {
  description = "Droplet OS image"
  type        = string
  default     = "ubuntu-22-04-x64"
}

variable "ssh_key_name" {
  description = "Name of the SSH key in DigitalOcean (must already exist in your DO account)"
  type        = string
  default     = "weather-app-key"
}

variable "ssh_allowed_ips" {
  description = "IPs allowed to SSH to droplet (use ['0.0.0.0/0', '::/0'] for all)"
  type        = list(string)
  default     = ["0.0.0.0/0", "::/0"]
}

# Database PostgreSQL (Local sur le droplet)
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

# DigitalOcean API Token
variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}
