#!/bin/bash
set -e

# Logs
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting user data script..."

# Update system
dnf update -y

# Install Node.js 20.x
dnf install -y nodejs npm git redis6 nginx

# Enable pnpm
npm install -g pnpm pm2

# Install Redis and enable service
systemctl enable redis6
systemctl start redis6

# Configure Redis for production
cat > /etc/redis6/redis6.conf <<EOF
bind 127.0.0.1
protected-mode yes
port 6379
timeout 0
tcp-keepalive 300
daemonize no
supervised systemd
pidfile /var/run/redis6/redis6.pid
loglevel notice
logfile /var/log/redis6/redis6.log
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis6
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

systemctl restart redis6

# Create application user
useradd -m -s /bin/bash weatherapp || true

# Clone repository from GitHub
cd /home/weatherapp
sudo -u weatherapp git clone https://github.com/ctaque/weather-app-challenge.git app
chown -R weatherapp:weatherapp /home/weatherapp

# Create .env file
cat > /home/weatherapp/app/.env <<EOF
NODE_ENV=production
PORT=3000

# API Keys
WEATHERAPI_KEY=${weatherapi_key}
ANTHROPIC_API_KEY=${anthropic_api_key}

# Database
DATABASE_URL=postgresql://${db_username}:${db_password}@${db_host}:5432/${db_name}

# Redis
REDIS_URL=redis://${redis_host}:${redis_port}

# Backend URL (sera l'IP publique ou le domain)
BACKEND_URL=http://${domain_name != "" ? domain_name : aws_eip}
EOF

chown weatherapp:weatherapp /home/weatherapp/app/.env
chmod 600 /home/weatherapp/app/.env

# Configure Nginx as reverse proxy
cat > /etc/nginx/conf.d/weatherapp.conf <<'NGINX'
upstream backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    # Serve static files from S3 or local dist
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache pour les assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx

# Create PM2 ecosystem file
cat > /home/weatherapp/app/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'weather-app',
    script: './server.js',
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '300M',
    node_args: '--max-old-space-size=16000',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/home/weatherapp/logs/err.log',
    out_file: '/home/weatherapp/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

chown weatherapp:weatherapp /home/weatherapp/app/ecosystem.config.js

# Create logs directory
mkdir -p /home/weatherapp/logs
chown -R weatherapp:weatherapp /home/weatherapp/logs

# Create deployment script
cat > /home/weatherapp/deploy.sh <<'DEPLOY'
#!/bin/bash
set -e

echo "Starting deployment..."

cd /home/weatherapp/app

# Pull latest code (si git repo configuré)
# git pull origin main

# Install dependencies
echo "Installing dependencies..."
pnpm install --prod

# Build frontend
echo "Building frontend..."
pnpm run build

# Restart app with PM2
echo "Restarting application..."
pm2 restart ecosystem.config.js --update-env

echo "Deployment complete!"
DEPLOY

chmod +x /home/weatherapp/deploy.sh
chown weatherapp:weatherapp /home/weatherapp/deploy.sh

# Configure PM2 to start on boot
env PATH=$PATH:/usr/bin pm2 startup systemd -u weatherapp --hp /home/weatherapp

echo "User data script completed!"

# Déploiement initial de l'application
echo "Starting initial deployment..."
cd /home/weatherapp/app

# Install dependencies and build as weatherapp user
sudo -u weatherapp bash << 'EOF'
cd /home/weatherapp/app
pnpm install --prod
pnpm run build
pm2 start ecosystem.config.js
pm2 save
EOF

# Configure PM2 to start on boot
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u weatherapp --hp /home/weatherapp

echo "Deployment completed!"
