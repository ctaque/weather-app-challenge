#!/bin/bash
#
# Script de déploiement de la configuration systemd sur le serveur
# Exécute depuis le poste local pour configurer le service sur le serveur distant
#
# Usage: ./deploy-systemd-to-server.sh
#

set -e

# Configuration
SERVER_IP="159.89.213.194"
SERVER_USER="root"
APP_DIR="/home/weatherapp/app"
SERVICE_NAME="weather-app"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Déploiement de la configuration systemd sur ${SERVER_IP}${NC}"
echo ""

# Vérifier la connexion SSH
echo -e "${YELLOW}🔑 Test de connexion SSH...${NC}"
if ! ssh -o ConnectTimeout=5 ${SERVER_USER}@${SERVER_IP} "echo 'Connexion OK'" >/dev/null 2>&1; then
    echo "❌ Impossible de se connecter au serveur ${SERVER_IP}"
    echo "Vérifiez:"
    echo "  - Que votre clé SSH est configurée"
    echo "  - Que le serveur est accessible"
    echo "  - L'adresse IP est correcte"
    exit 1
fi
echo -e "${GREEN}✅ Connexion SSH établie${NC}"
echo ""

# Créer et exécuter le script de configuration sur le serveur
echo -e "${YELLOW}📝 Configuration du service systemd sur le serveur...${NC}"

ssh ${SERVER_USER}@${SERVER_IP} bash << 'ENDSSH'
set -e

# Configuration
APP_USER="weatherapp"
APP_DIR="/home/weatherapp/app"
BINARY_NAME="actix_sqlx_template"
SERVICE_NAME="weather-app"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "🔍 Vérification du binaire..."
if [ ! -f "${APP_DIR}/${BINARY_NAME}" ]; then
    echo "❌ Binaire non trouvé: ${APP_DIR}/${BINARY_NAME}"
    echo "Le déploiement GitHub Actions doit être effectué en premier."
    exit 1
fi

# Rendre le binaire exécutable
chmod +x "${APP_DIR}/${BINARY_NAME}"

# Vérifier/créer le fichier .env
ENV_FILE="${APP_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  Création du fichier .env template..."
    cat > "$ENV_FILE" << 'EOF'
# Configuration de l'application weather-app
DATABASE_URL=postgresql://weatherapp:password@localhost/weatherapp
RUST_LOG=info
WEATHERAPI_KEY=your_weatherapi_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENROUTESERVICE_TOKEN=your_openrouteservice_token_here
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
REDIS_URL=redis://localhost:6379
EOF
    chown ${APP_USER}:${APP_USER} "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "⚠️  Fichier .env créé - vous devrez le configurer avec les bonnes valeurs"
else
    echo "✅ Fichier .env existant trouvé"
fi

# Créer le fichier service systemd
echo "📝 Création du fichier service systemd..."
cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=Weather App - Rust Backend Service
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=weatherapp
Group=weatherapp
WorkingDirectory=/home/weatherapp/app

# Charger les variables d'environnement depuis le fichier .env
EnvironmentFile=/home/weatherapp/app/.env

# Commande pour exécuter le binaire Rust
ExecStart=/home/weatherapp/app/actix_sqlx_template

# Redémarrage automatique en cas d'échec
Restart=always
RestartSec=10

# Logs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=weather-app

# Sécurité
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/weatherapp/app

# Limites de ressources
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Fichier service créé: ${SERVICE_FILE}"

# Recharger systemd
echo "🔄 Rechargement de systemd..."
systemctl daemon-reload

# Activer le service au démarrage
echo "⚙️  Activation du service au démarrage..."
systemctl enable ${SERVICE_NAME}

# Redémarrer le service
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "♻️  Redémarrage du service..."
    systemctl restart ${SERVICE_NAME}
else
    echo "▶️  Démarrage du service..."
    systemctl start ${SERVICE_NAME}
fi

# Attendre un peu
sleep 3

# Vérifier le statut
echo ""
echo "📊 Statut du service:"
systemctl status ${SERVICE_NAME} --no-pager || true

echo ""
echo "✅ Configuration terminée!"
echo ""
echo "Commandes utiles:"
echo "  - Voir les logs:   journalctl -u ${SERVICE_NAME} -f"
echo "  - Redémarrer:      systemctl restart ${SERVICE_NAME}"
echo "  - Voir le statut:  systemctl status ${SERVICE_NAME}"

ENDSSH

echo ""
echo -e "${GREEN}✅ Déploiement terminé!${NC}"
echo ""
echo "Le service systemd 'weather-app' est maintenant configuré et actif."
echo "Pour voir les logs depuis votre poste:"
echo "  ssh ${SERVER_USER}@${SERVER_IP} 'journalctl -u ${SERVICE_NAME} -f'"
