#!/bin/bash
# Script pour suivre les logs CloudWatch en temps réel

LOG_GROUP=$(cd .. && terraform output -raw cloudwatch_log_group 2>/dev/null) || LOG_GROUP="/aws/ec2/weather-app"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}📊 Suivi des logs CloudWatch${NC}"
echo -e "${BLUE}Log Group:${NC} $LOG_GROUP"
echo ""

# Menu de sélection
echo "Choisissez le stream à suivre:"
echo ""
echo "  1) application (logs de l'app)"
echo "  2) application-errors (erreurs de l'app)"
echo "  3) nginx-access (logs HTTP)"
echo "  4) nginx-error (erreurs nginx)"
echo "  5) redis (logs Redis)"
echo "  6) system (logs système)"
echo "  7) user-data (logs d'initialisation)"
echo "  8) tous les streams"
echo ""

read -p "Votre choix (1-8): " choice

case $choice in
  1)
    STREAM="application"
    ;;
  2)
    STREAM="application-errors"
    ;;
  3)
    STREAM="nginx-access"
    ;;
  4)
    STREAM="nginx-error"
    ;;
  5)
    STREAM="redis"
    ;;
  6)
    STREAM="system"
    ;;
  7)
    STREAM="user-data"
    ;;
  8)
    STREAM=""
    ;;
  *)
    echo -e "${YELLOW}Choix invalide. Affichage de tous les streams.${NC}"
    STREAM=""
    ;;
esac

echo ""
if [ -z "$STREAM" ]; then
  echo -e "${GREEN}🔄 Suivi de tous les logs...${NC}"
  echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter${NC}"
  echo ""
  aws logs tail "$LOG_GROUP" --follow --format short
else
  echo -e "${GREEN}🔄 Suivi du stream: $STREAM${NC}"
  echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter${NC}"
  echo ""
  aws logs tail "$LOG_GROUP" --follow --log-stream-names "$STREAM" --format short
fi
