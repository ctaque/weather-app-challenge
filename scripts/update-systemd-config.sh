#!/bin/bash
#
# Script de mise à jour de la configuration systemd (appelé par le workflow GitHub)
# Ce script est exécuté lors de chaque déploiement pour s'assurer que
# la configuration systemd est à jour
#
# Usage: sudo ./update-systemd-config.sh
#

set -e

# Configuration
SERVICE_NAME="weather-app"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
APP_DIR="/home/weatherapp/app"
BINARY_NAME="actix_sqlx_template"
CONFIG_DIR="/etc/weather-app"

# Si le service n'existe pas, utiliser le script de configuration complet
if [ ! -f "$SERVICE_FILE" ]; then
    echo "Service systemd non trouvé, exécution du script de configuration complet..."
    /bin/bash "$(dirname "$0")/setup-systemd-service.sh"
    exit 0
fi

# Vérifier que le binaire existe et est exécutable
if [ -f "${APP_DIR}/${BINARY_NAME}" ] && [ ! -x "${APP_DIR}/${BINARY_NAME}" ]; then
    echo "Ajout des permissions d'exécution au binaire..."
    chmod +x "${APP_DIR}/${BINARY_NAME}"
fi

# Recharger systemd si la configuration a changé
echo "Rechargement de systemd..."
systemctl daemon-reload

# Redémarrer le service
echo "Redémarrage du service ${SERVICE_NAME}..."
systemctl restart ${SERVICE_NAME}

# Attendre que le service démarre
sleep 3

# Vérifier le statut
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "✅ Service ${SERVICE_NAME} démarré avec succès"
    systemctl status ${SERVICE_NAME} --no-pager
    exit 0
else
    echo "❌ Échec du démarrage du service ${SERVICE_NAME}"
    journalctl -u ${SERVICE_NAME} -n 50 --no-pager
    exit 1
fi
