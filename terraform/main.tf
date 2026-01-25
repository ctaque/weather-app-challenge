terraform {
  required_version = ">= 1.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# SSH Key - Use existing key from DigitalOcean account
data "digitalocean_ssh_key" "default" {
  name = var.ssh_key_name
}

# Reserved IP (Floating IP) - creates a static IP address
resource "digitalocean_reserved_ip" "app" {
  region = var.do_region
}

# Droplet (VM) with PostgreSQL, Redis, nginx
resource "digitalocean_droplet" "app" {
  name   = "${var.project_name}-droplet"
  size   = var.droplet_size
  image  = var.droplet_image
  region = var.do_region

  ssh_keys = [data.digitalocean_ssh_key.default.id]

  # Cloud-init configuration with all application setup
  user_data = templatefile("${path.module}/cloud-init.yml", {
    db_name               = var.db_name
    db_username           = var.db_username
    db_password           = var.db_password
    weatherapi_key        = var.weatherapi_key
    anthropic_api_key     = var.anthropic_api_key
    openrouteservice_token = var.openrouteservice_token
    domain_name           = var.domain_name
  })

  tags = [var.environment, var.project_name]
  # Ignore changes to user_data after initial creation
  # This prevents the droplet from being destroyed/recreated when cloud-init.yml changes
  lifecycle {
    ignore_changes = [user_data]
  }
}

# Wait for droplet to be fully ready before assigning IP
resource "time_sleep" "wait_for_droplet" {
  depends_on = [digitalocean_droplet.app]

  create_duration = "30s"
}

# Assign Reserved IP to droplet
resource "digitalocean_reserved_ip_assignment" "app" {
  depends_on = [time_sleep.wait_for_droplet]

  ip_address = digitalocean_reserved_ip.app.ip_address
  droplet_id = digitalocean_droplet.app.id
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

# DNS Configuration - Automated A record creation
resource "digitalocean_record" "app_dns" {
  count = var.domain_name != "" ? 1 : 0

  domain = var.domain_name
  type   = "A"
  name   = "@"
  value  = digitalocean_reserved_ip.app.ip_address
  ttl    = 300
}

# Data sources
data "digitalocean_sizes" "available" {
  filter {
    key    = "regions"
    values = [var.do_region]
  }
}
