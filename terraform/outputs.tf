# DigitalOcean Outputs

output "droplet_ip" {
  description = "Droplet public IP address"
  value       = digitalocean_droplet.app.ipv4_address
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
  value       = "ssh root@${digitalocean_droplet.app.ipv4_address}"
}

output "app_url" {
  description = "Application URL"
  value       = var.domain_name != "" ? "http://${var.domain_name}" : "http://${digitalocean_droplet.app.ipv4_address}"
}

output "deployment_script" {
  description = "Command to trigger deployment on droplet"
  value       = "ssh root@${digitalocean_droplet.app.ipv4_address} 'sudo -u weatherapp /home/weatherapp/deploy.sh'"
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
    ssh              = "ssh root@${digitalocean_droplet.app.ipv4_address}"
    ssh_weatherapp   = "ssh root@${digitalocean_droplet.app.ipv4_address} -t 'sudo -u weatherapp bash'"
    deploy           = "ssh root@${digitalocean_droplet.app.ipv4_address} 'sudo -u weatherapp /home/weatherapp/deploy.sh'"
    logs             = "ssh root@${digitalocean_droplet.app.ipv4_address} 'tail -f /home/weatherapp/logs/*.log'"
    pm2_status       = "ssh root@${digitalocean_droplet.app.ipv4_address} 'sudo -u weatherapp pm2 status'"
    pm2_restart      = "ssh root@${digitalocean_droplet.app.ipv4_address} 'sudo -u weatherapp pm2 restart all'"
    nginx_status     = "ssh root@${digitalocean_droplet.app.ipv4_address} 'systemctl status nginx'"
    redis_status     = "ssh root@${digitalocean_droplet.app.ipv4_address} 'systemctl status redis-server'"
    postgres_status  = "ssh root@${digitalocean_droplet.app.ipv4_address} 'systemctl status postgresql'"
    postgres_connect = "ssh root@${digitalocean_droplet.app.ipv4_address} 'sudo -u postgres psql ${var.db_name}'"
    backup_database  = "ssh root@${digitalocean_droplet.app.ipv4_address} 'sudo -u weatherapp /home/weatherapp/backup-db.sh'"
    check_cloud_init = "ssh root@${digitalocean_droplet.app.ipv4_address} 'tail -f /var/log/cloud-init-output.log'"
  }
}
