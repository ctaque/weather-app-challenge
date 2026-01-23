#!/bin/bash
# Script pour charger les variables d'environnement Terraform

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=================================================="
echo "  Terraform Environment Variables Loader"
echo "=================================================="
echo ""

# Chercher le fichier .env
ENV_FILE="../.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Fichier .env non trouvé${NC}"
    echo ""
    echo "Créez le fichier .env depuis l'exemple:"
    echo "  cp .env.example .env"
    echo "  nano .env  # Éditez avec vos valeurs"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Fichier .env trouvé${NC}"
echo ""

# Charger les variables
echo -e "${YELLOW}📥 Chargement des variables d'environnement...${NC}"
echo ""

# Export des variables (ignore les lignes vides et commentaires)
set -a
source "$ENV_FILE"
set +a

# Vérifier les variables critiques
REQUIRED_VARS=(
    "TF_VAR_do_token"
    "TF_VAR_weatherapi_key"
    "TF_VAR_anthropic_api_key"
    "TF_VAR_db_password"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Variables manquantes:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Éditez le fichier .env et définissez ces variables"
    exit 1
fi

echo -e "${GREEN}✅ Toutes les variables requises sont définies${NC}"
echo ""

# Afficher les variables chargées (masquer les secrets)
echo "Variables chargées:"
echo "  • TF_VAR_do_token: ${TF_VAR_do_token:0:10}..."
echo "  • TF_VAR_do_region: $TF_VAR_do_region"
echo "  • TF_VAR_environment: $TF_VAR_environment"
echo "  • TF_VAR_project_name: $TF_VAR_project_name"
echo "  • TF_VAR_droplet_size: $TF_VAR_droplet_size"
echo "  • TF_VAR_ssh_key_name: $TF_VAR_ssh_key_name"
echo "  • TF_VAR_db_name: $TF_VAR_db_name"
echo "  • TF_VAR_db_username: $TF_VAR_db_username"
echo "  • TF_VAR_db_password: ********"
echo "  • TF_VAR_weatherapi_key: ${TF_VAR_weatherapi_key:0:8}..."
echo "  • TF_VAR_anthropic_api_key: ${TF_VAR_anthropic_api_key:0:10}..."
echo "  • TF_VAR_domain_name: ${TF_VAR_domain_name:-"(empty)"}"
echo ""

echo "=================================================="
echo -e "${GREEN}✅ Variables chargées avec succès!${NC}"
echo "=================================================="
echo ""
echo "Les variables sont maintenant disponibles dans votre shell."
echo ""
echo "Commandes Terraform disponibles:"
echo "  terraform plan"
echo "  terraform apply"
echo "  terraform destroy"
echo ""
echo -e "${YELLOW}Note:${NC} Ces variables ne sont valables que dans cette session shell."
echo "Pour les charger dans une nouvelle session, relancez:"
echo "  source scripts/load-env.sh"
echo ""
