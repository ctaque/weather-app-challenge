# DigitalOcean Outputs

output "droplet_ip" {
  description = "Droplet public IP address (Reserved IP)"
  value       = digitalocean_reserved_ip.app.ip_address
}

output "reserved_ip_id" {
  description = "Reserved IP resource ID"
  value       = digitalocean_reserved_ip.app.id
}

output "reserved_ip_urn" {
  description = "Reserved IP URN"
  value       = digitalocean_reserved_ip.app.urn
}

output "droplet_id" {
  description = "Droplet ID"
  value       = digitalocean_droplet.app.id
}

output "droplet_name" {
  description = "Droplet name"
  value       = digitalocean_droplet.app.name
}

output "droplet_region" {
  description = "Droplet region"
  value       = digitalocean_droplet.app.region
}

output "ssh_command" {
  description = "SSH command to connect to droplet"
  value       = "ssh root@${digitalocean_reserved_ip.app.ip_address}"
}

output "app_url" {
  description = "Application URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${digitalocean_reserved_ip.app.ip_address}"
}

output "deployment_script" {
  description = "Command to trigger deployment on droplet"
  value       = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'sudo -u weatherapp /home/weatherapp/deploy.sh'"
}

output "database_info" {
  description = "Database connection information (local PostgreSQL)"
  value = {
    host     = "localhost"
    port     = 5432
    database = var.db_name
    username = var.db_username
    note     = "PostgreSQL is installed locally on the droplet"
  }
}

# Quick reference commands
output "useful_commands" {
  description = "Useful commands for managing the infrastructure"
  value = {
    ssh              = "ssh root@${digitalocean_reserved_ip.app.ip_address}"
    ssh_weatherapp   = "ssh root@${digitalocean_reserved_ip.app.ip_address} -t 'sudo -u weatherapp bash'"
    deploy           = "ssh root@${digitalocean_reserved_ip.app.ip_address} '/home/weatherapp/deploy.sh'"
    app_status       = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'systemctl status weather-app'"
    app_restart      = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'systemctl restart weather-app'"
    app_logs         = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'journalctl -u weather-app -f'"
    nginx_status     = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'systemctl status nginx'"
    redis_status     = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'systemctl status redis'"
    postgres_status  = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'systemctl status postgresql'"
    postgres_connect = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'sudo -u postgres psql ${var.db_name}'"
    backup_database  = "ssh root@${digitalocean_reserved_ip.app.ip_address} '/home/weatherapp/backup-db.sh'"
    check_cloud_init = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'tail -f /var/log/cloud-init-output.log'"
    ssl_certificates = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'certbot certificates'"
    ssl_renew       = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'certbot renew'"
  }
}

output "ssl_info" {
  description = "SSL certificate information"
  value = var.domain_name != "" ? {
    domain            = var.domain_name
    certificate_path  = "/etc/letsencrypt/live/${var.domain_name}/fullchain.pem"
    private_key_path  = "/etc/letsencrypt/live/${var.domain_name}/privkey.pem"
    auto_renewal      = "Enabled via systemd timer (certbot-renew.timer)"
    check_status      = "ssh root@${digitalocean_reserved_ip.app.ip_address} 'certbot certificates'"
  } : {
    status = "No domain configured - SSL not enabled"
  }
}

output "dns_configuration" {
  description = "DNS configuration for the domain"
  value = var.domain_name != "" ? {
    domain       = var.domain_name
    record_type  = "A"
    record_value = digitalocean_reserved_ip.app.ip_address
    ttl          = "300"
    note         = "Point your domain's A record to this IP address"
  } : {
    note = "No domain configured"
  }
}
