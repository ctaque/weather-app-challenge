#!/bin/bash
set -e

# Script pour créer un backup manuel de la base de données RDS

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Creating RDS PostgreSQL backup...${NC}"

# Récupérer l'ID de l'instance RDS
DB_INSTANCE=$(cd terraform && terraform output -raw rds_endpoint | cut -d: -f1)
SNAPSHOT_ID="weather-app-manual-$(date +%Y%m%d-%H%M%S)"

if [ -z "$DB_INSTANCE" ]; then
    echo -e "${RED}Error: Could not find RDS instance${NC}"
    exit 1
fi

echo -e "${YELLOW}Creating snapshot: $SNAPSHOT_ID${NC}"

aws rds create-db-snapshot \
    --db-instance-identifier weather-app-db \
    --db-snapshot-identifier "$SNAPSHOT_ID" \
    --tags Key=Type,Value=Manual Key=Date,Value=$(date +%Y-%m-%d)

echo -e "${GREEN}Snapshot creation started!${NC}"
echo "Snapshot ID: $SNAPSHOT_ID"
echo ""
echo "Check status with:"
echo "aws rds describe-db-snapshots --db-snapshot-identifier $SNAPSHOT_ID"
