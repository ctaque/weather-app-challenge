#!/bin/bash
set -e

# Script pour déployer les assets statiques sur S3

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying frontend to S3...${NC}"

# Récupérer le nom du bucket depuis Terraform
BUCKET_NAME=$(cd terraform && terraform output -raw s3_bucket_name)

if [ -z "$BUCKET_NAME" ]; then
    echo -e "${YELLOW}Error: Could not find S3 bucket name${NC}"
    echo "Make sure you've run 'terraform apply' first"
    exit 1
fi

echo -e "${GREEN}Building frontend...${NC}"
pnpm run build

echo -e "${GREEN}Uploading to S3 bucket: $BUCKET_NAME${NC}"
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "index.html"

# index.html sans cache (pour les mises à jour)
aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
    --cache-control "no-cache, no-store, must-revalidate"

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "Website URL: http://$BUCKET_NAME.s3-website-eu-west-3.amazonaws.com"
