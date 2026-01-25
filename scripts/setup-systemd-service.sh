#!/bin/bash
#
# Script de configuration du service systemd weather-app
# Configure le service pour utiliser le binaire Rust compilé
#
# Usage: sudo ./setup-systemd-service.sh
#

set -e

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_USER="weatherapp"
APP_DIR="/home/weatherapp/app"
BINARY_NAME="actix_sqlx_template"
SERVICE_NAME="weather-app"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
CONFIG_DIR="/etc/weather-app"

echo -e "${GREEN}🚀 Configuration du service systemd ${SERVICE_NAME}${NC}"
echo ""

# Vérification des permissions root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Ce script doit être exécuté en tant que root${NC}"
    echo "Usage: sudo $0"
    exit 1
fi

# Vérification de l'existence du binaire
if [ ! -f "${APP_DIR}/${BINARY_NAME}" ]; then
    echo -e "${RED}❌ Binaire non trouvé: ${APP_DIR}/${BINARY_NAME}${NC}"
    echo "Assurez-vous que le déploiement GitHub Actions a été effectué."
    exit 1
fi

# Vérifier que le binaire est exécutable
if [ ! -x "${APP_DIR}/${BINARY_NAME}" ]; then
    echo -e "${YELLOW}⚠️  Le binaire n'est pas exécutable, ajout des permissions...${NC}"
    chmod +x "${APP_DIR}/${BINARY_NAME}"
fi

# Créer le répertoire de configuration s'il n'existe pas
if [ ! -d "$CONFIG_DIR" ]; then
    echo -e "${GREEN}📁 Création du répertoire de configuration ${CONFIG_DIR}...${NC}"
    mkdir -p "$CONFIG_DIR"
fi

# Charger les variables d'environnement depuis le fichier .env si il existe
ENV_FILE="${CONFIG_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Fichier .env non trouvé, création d'un fichier template...${NC}"
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
    echo -e "${YELLOW}⚠️  Veuillez configurer les variables dans ${ENV_FILE}${NC}"
fi

# Créer le fichier service systemd
echo -e "${GREEN}📝 Création du fichier service systemd...${NC}"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Weather App - Rust Backend Service
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}

# Charger les variables d'environnement depuis le fichier .env
EnvironmentFile=${ENV_FILE}

# Commande pour exécuter le binaire Rust
ExecStart=${APP_DIR}/${BINARY_NAME}

# Redémarrage automatique en cas d'échec
Restart=always
RestartSec=10

# Logs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Sécurité
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}

# Limites de ressources
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✅ Fichier service créé: ${SERVICE_FILE}${NC}"

# Recharger systemd
echo -e "${GREEN}🔄 Rechargement de systemd...${NC}"
systemctl daemon-reload

# Activer le service au démarrage
echo -e "${GREEN}⚙️  Activation du service au démarrage...${NC}"
systemctl enable ${SERVICE_NAME}

# Arrêter le service s'il est en cours d'exécution
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${YELLOW}♻️  Redémarrage du service...${NC}"
    systemctl restart ${SERVICE_NAME}
else
    echo -e "${GREEN}▶️  Démarrage du service...${NC}"
    systemctl start ${SERVICE_NAME}
fi

# Attendre un peu pour que le service démarre
sleep 2

# Vérifier le statut
echo ""
echo -e "${GREEN}📊 Statut du service:${NC}"
systemctl status ${SERVICE_NAME} --no-pager || true

echo ""
echo -e "${GREEN}✅ Configuration terminée!${NC}"
echo ""
echo "Commandes utiles:"
echo "  - Voir les logs:        journalctl -u ${SERVICE_NAME} -f"
echo "  - Redémarrer:          systemctl restart ${SERVICE_NAME}"
echo "  - Arrêter:             systemctl stop ${SERVICE_NAME}"
echo "  - Démarrer:            systemctl start ${SERVICE_NAME}"
echo "  - Voir le statut:      systemctl status ${SERVICE_NAME}"
echo "  - Désactiver:          systemctl disable ${SERVICE_NAME}"
echo ""
echo -e "${YELLOW}⚠️  N'oubliez pas de configurer les variables dans ${ENV_FILE}${NC}"
