#!/bin/bash
# Script pour mettre à jour les variables d'environnement sur le serveur existant
# Usage: ./update-env-vars.sh <DROPLET_IP> <OPENROUTESERVICE_TOKEN>

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <DROPLET_IP> <OPENROUTESERVICE_TOKEN>"
    echo ""
    echo "Example:"
    echo "  $0 159.89.123.45 eyJvcmciOiI1YjNjZTM1..."
    exit 1
fi

DROPLET_IP="$1"
TOKEN="$2"

echo "📝 Mise à jour de OPENROUTESERVICE_TOKEN sur $DROPLET_IP..."

# Ajouter la variable dans le fichier .env
ssh root@$DROPLET_IP << EOF
set -e

# Backup du fichier .env actuel
cp /home/weatherapp/app/.env /home/weatherapp/app/.env.backup-\$(date +%Y%m%d-%H%M%S)

# Ajouter ou mettre à jour OPENROUTESERVICE_TOKEN
if grep -q "^OPENROUTESERVICE_TOKEN=" /home/weatherapp/app/.env; then
    # La variable existe, la mettre à jour
    sed -i "s|^OPENROUTESERVICE_TOKEN=.*|OPENROUTESERVICE_TOKEN=$TOKEN|" /home/weatherapp/app/.env
    echo "✅ Variable OPENROUTESERVICE_TOKEN mise à jour"
else
    # La variable n'existe pas, l'ajouter après ANTHROPIC_API_KEY
    sed -i "/^ANTHROPIC_API_KEY=/a OPENROUTESERVICE_TOKEN=$TOKEN" /home/weatherapp/app/.env
    echo "✅ Variable OPENROUTESERVICE_TOKEN ajoutée"
fi

# Mettre à jour le service systemd
if grep -q "^Environment=OPENROUTESERVICE_TOKEN=" /etc/systemd/system/weather-app.service; then
    # La variable existe dans le service
    sed -i "s|^Environment=OPENROUTESERVICE_TOKEN=.*|Environment=OPENROUTESERVICE_TOKEN=$TOKEN|" /etc/systemd/system/weather-app.service
    echo "✅ Variable OPENROUTESERVICE_TOKEN mise à jour dans systemd"
else
    # Ajouter la variable après ANTHROPIC_API_KEY
    sed -i "/^Environment=ANTHROPIC_API_KEY=/a Environment=OPENROUTESERVICE_TOKEN=$TOKEN" /etc/systemd/system/weather-app.service
    echo "✅ Variable OPENROUTESERVICE_TOKEN ajoutée dans systemd"
fi

# Recharger systemd et redémarrer le service
systemctl daemon-reload
systemctl restart weather-app

echo ""
echo "♻️  Service redémarré"
sleep 3

# Vérifier le statut
systemctl status weather-app --no-pager

echo ""
echo "✅ Mise à jour terminée !"
EOF

echo ""
echo "🎉 La variable OPENROUTESERVICE_TOKEN a été configurée avec succès !"
echo ""
echo "Pour vérifier que tout fonctionne :"
echo "  ssh root@$DROPLET_IP 'journalctl -u weather-app -n 50'"
