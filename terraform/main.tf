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

# Droplet (VM) with PostgreSQL, Redis, nginx
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
    db_name           = var.db_name
    db_username       = var.db_username
    db_password       = var.db_password
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

# Data sources
data "digitalocean_sizes" "available" {
  filter {
    key    = "regions"
    values = [var.do_region]
  }
}
