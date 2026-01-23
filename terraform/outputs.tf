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

output "db_host" {
  description = "PostgreSQL database host (private)"
  value       = digitalocean_database_cluster.postgres.private_host
}

output "db_port" {
  description = "PostgreSQL database port"
  value       = digitalocean_database_cluster.postgres.port
}

output "db_connection_uri" {
  description = "PostgreSQL connection URI (private network)"
  value       = digitalocean_database_cluster.postgres.private_uri
  sensitive   = true
}

output "db_public_host" {
  description = "PostgreSQL database host (public)"
  value       = digitalocean_database_cluster.postgres.host
}

output "db_database" {
  description = "Database name"
  value       = digitalocean_database_db.app_db.name
}

output "db_username" {
  description = "Database username"
  value       = digitalocean_database_user.app_user.name
}

output "db_password" {
  description = "Database password"
  value       = digitalocean_database_user.app_user.password
  sensitive   = true
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
    check_cloud_init = "ssh root@${digitalocean_droplet.app.ipv4_address} 'tail -f /var/log/cloud-init-output.log'"
  }
}
