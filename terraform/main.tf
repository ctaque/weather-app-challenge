terraform {
  required_version = ">= 1.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# SSH Key
resource "digitalocean_ssh_key" "default" {
  name       = "${var.project_name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# PostgreSQL Managed Database
resource "digitalocean_database_cluster" "postgres" {
  name       = "${var.project_name}-db"
  engine     = "pg"
  version    = "16"
  size       = var.db_cluster_size
  region     = var.do_region
  node_count = 1

  tags = [var.environment, var.project_name]
}

# Create database
resource "digitalocean_database_db" "app_db" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = var.db_name
}

# Create database user
resource "digitalocean_database_user" "app_user" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = var.db_username
}

# Droplet (VM)
resource "digitalocean_droplet" "app" {
  name   = "${var.project_name}-droplet"
  size   = var.droplet_size
  image  = var.droplet_image
  region = var.do_region

  ssh_keys = [digitalocean_ssh_key.default.id]

  user_data = templatefile("${path.module}/cloud-init.yml", {
    project_name      = var.project_name
    weatherapi_key    = var.weatherapi_key
    anthropic_api_key = var.anthropic_api_key
    db_host           = digitalocean_database_cluster.postgres.private_host
    db_port           = digitalocean_database_cluster.postgres.port
    db_name           = var.db_name
    db_username       = digitalocean_database_user.app_user.name
    db_password       = digitalocean_database_user.app_user.password
    db_uri            = digitalocean_database_cluster.postgres.private_uri
    droplet_ip        = "DROPLET_IP_PLACEHOLDER" # Sera remplacé par l'IP réelle après création
    domain_name       = var.domain_name
  })

  tags = [var.environment, var.project_name]

  # Prevent droplet recreation on user_data changes
  lifecycle {
    ignore_changes = [user_data]
  }
}

# Firewall
resource "digitalocean_firewall" "app" {
  name = "${var.project_name}-firewall"

  droplet_ids = [digitalocean_droplet.app.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.ssh_allowed_ips
  }

  # HTTP
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Allow all outbound
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Firewall rule to allow droplet to access database
resource "digitalocean_database_firewall" "app_db_firewall" {
  cluster_id = digitalocean_database_cluster.postgres.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.app.id
  }
}

# Data sources
data "digitalocean_sizes" "available" {
  filter {
    key    = "regions"
    values = [var.do_region]
  }
}
