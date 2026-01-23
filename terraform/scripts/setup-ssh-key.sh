#!/bin/bash
# Script pour uploader votre clé SSH publique sur DigitalOcean

set -e

echo "=================================================="
echo "  DigitalOcean SSH Key Setup"
echo "=================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier que DO_TOKEN est défini
if [ -z "$DO_TOKEN" ]; then
    echo -e "${RED}❌ Erreur: Variable DO_TOKEN non définie${NC}"
    echo ""
    echo "Définissez votre token DigitalOcean:"
    echo "  export DO_TOKEN='dop_v1_xxxxxxxxxxxxx'"
    echo ""
    echo "Récupérez votre token sur:"
    echo "  https://cloud.digitalocean.com/account/api/tokens"
    exit 1
fi

# Détecter la clé SSH publique
SSH_KEY_PATH=""
if [ -f ~/.ssh/id_ed25519.pub ]; then
    SSH_KEY_PATH="$HOME/.ssh/id_ed25519.pub"
elif [ -f ~/.ssh/id_rsa.pub ]; then
    SSH_KEY_PATH="$HOME/.ssh/id_rsa.pub"
else
    echo -e "${RED}❌ Aucune clé SSH publique trouvée${NC}"
    echo ""
    echo "Générez une clé SSH:"
    echo "  ssh-keygen -t ed25519 -C 'your_email@example.com'"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Clé SSH trouvée:${NC} $SSH_KEY_PATH"
echo ""

# Lire la clé publique
SSH_KEY_CONTENT=$(cat "$SSH_KEY_PATH")
echo -e "${GREEN}Contenu de la clé:${NC}"
echo "$SSH_KEY_CONTENT"
echo ""

# Demander le nom de la clé
read -p "Nom de la clé sur DigitalOcean (défaut: weather-app-key): " KEY_NAME
KEY_NAME=${KEY_NAME:-weather-app-key}

echo ""
echo -e "${YELLOW}📤 Upload de la clé SSH vers DigitalOcean...${NC}"
echo ""

# Upload via API DigitalOcean
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DO_TOKEN" \
  -d "{\"name\":\"$KEY_NAME\",\"public_key\":\"$SSH_KEY_CONTENT\"}" \
  "https://api.digitalocean.com/v2/account/keys")

# Vérifier si l'upload a réussi
if echo "$RESPONSE" | grep -q '"ssh_key"'; then
    echo -e "${GREEN}✅ Clé SSH uploadée avec succès!${NC}"
    echo ""

    # Extraire l'ID et le fingerprint
    KEY_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    KEY_FINGERPRINT=$(echo "$RESPONSE" | grep -o '"fingerprint":"[^"]*"' | cut -d'"' -f4)

    echo "ID: $KEY_ID"
    echo "Fingerprint: $KEY_FINGERPRINT"
    echo "Nom: $KEY_NAME"
    echo ""

    echo -e "${GREEN}📝 Configuration Terraform${NC}"
    echo ""
    echo "Ajoutez cette ligne dans terraform.tfvars:"
    echo -e "${YELLOW}ssh_key_name = \"$KEY_NAME\"${NC}"
    echo ""

elif echo "$RESPONSE" | grep -q "SSH Key is already in use"; then
    echo -e "${YELLOW}⚠️  Cette clé SSH existe déjà sur DigitalOcean${NC}"
    echo ""
    echo "Listez vos clés existantes:"
    echo "  curl -X GET -H 'Authorization: Bearer \$DO_TOKEN' 'https://api.digitalocean.com/v2/account/keys'"
    echo ""

    # Lister les clés existantes
    echo -e "${YELLOW}📋 Clés SSH existantes sur votre compte:${NC}"
    KEYS=$(curl -s -X GET \
      -H "Authorization: Bearer $DO_TOKEN" \
      "https://api.digitalocean.com/v2/account/keys")

    echo "$KEYS" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read -r name; do
        echo "  - $name"
    done
    echo ""

    echo -e "${GREEN}✅ Utilisez l'une de ces clés dans terraform.tfvars${NC}"

else
    echo -e "${RED}❌ Erreur lors de l'upload${NC}"
    echo ""
    echo "Réponse de l'API:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    echo "Vérifiez:"
    echo "  1. Que votre token DO_TOKEN est valide"
    echo "  2. Que la clé n'existe pas déjà"
    echo "  3. Que le format de la clé est correct"
    exit 1
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Setup terminé!${NC}"
echo "=================================================="
echo ""
echo "Prochaines étapes:"
echo "  1. Vérifiez terraform.tfvars (ssh_key_name)"
echo "  2. Lancez: terraform plan"
echo "  3. Lancez: terraform apply"
echo ""
