#!/bin/bash

set -euo pipefail

# Script de sauvegarde PostgreSQL vers S3
# Usage: ./backup-db.sh <DATABASE_URL> <S3_BUCKET> [RETENTION_DAYS]

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérification des arguments
if [ $# -lt 2 ]; then
    log_error "Usage: $0 <DATABASE_URL> <S3_BUCKET> [RETENTION_DAYS]"
    log_error "Example: $0 'postgresql://user:password@localhost:5432/mydb' 'my-backup-bucket' 30"
    exit 1
fi

DATABASE_URL="$1"
S3_BUCKET="$2"
RETENTION_DAYS="${3:-30}"

# Vérification des dépendances
command -v pg_dump >/dev/null 2>&1 || {
    log_error "pg_dump n'est pas installé. Installez postgresql-client."
    exit 1
}

command -v aws >/dev/null 2>&1 || {
    log_error "aws CLI n'est pas installé. Installez awscli."
    exit 1
}

# Création du nom de fichier avec timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="/tmp/${BACKUP_NAME}"

log_info "Démarrage de la sauvegarde de la base de données..."
log_info "Bucket S3: s3://${S3_BUCKET}"
log_info "Fichier: ${BACKUP_NAME}"

# Extraction des informations de connexion depuis l'URL
# Format: postgresql://user:password@host:port/database
if [[ ! $DATABASE_URL =~ ^postgresql:// ]]; then
    log_error "Format de DATABASE_URL invalide. Format attendu: postgresql://user:password@host:port/database"
    exit 1
fi

# Sauvegarde de la base de données
log_info "Création du dump PostgreSQL..."
if pg_dump "$DATABASE_URL" --format=plain --no-owner --no-acl | gzip > "$BACKUP_PATH"; then
    log_info "Dump créé avec succès: $BACKUP_PATH"
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    log_info "Taille du backup: $BACKUP_SIZE"
else
    log_error "Échec de la création du dump"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Upload vers S3
log_info "Upload vers S3..."
if aws s3 cp "$BACKUP_PATH" "s3://${S3_BUCKET}/backups/${BACKUP_NAME}" \
    --metadata "backup-date=${TIMESTAMP},retention-days=${RETENTION_DAYS}"; then
    log_info "Upload réussi vers s3://${S3_BUCKET}/backups/${BACKUP_NAME}"
else
    log_error "Échec de l'upload vers S3"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Nettoyage du fichier local
rm -f "$BACKUP_PATH"
log_info "Fichier temporaire supprimé"

# Nettoyage des anciens backups (optionnel)
if [ "$RETENTION_DAYS" -gt 0 ]; then
    log_info "Nettoyage des backups de plus de ${RETENTION_DAYS} jours..."
    CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d 2>/dev/null)

    aws s3 ls "s3://${S3_BUCKET}/backups/" | while read -r line; do
        BACKUP_FILE=$(echo "$line" | awk '{print $4}')
        if [[ $BACKUP_FILE =~ backup_([0-9]{8})_ ]]; then
            FILE_DATE="${BASH_REMATCH[1]}"
            if [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
                log_info "Suppression de l'ancien backup: $BACKUP_FILE"
                aws s3 rm "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" || log_warn "Échec de suppression de $BACKUP_FILE"
            fi
        fi
    done
fi

log_info "✓ Sauvegarde terminée avec succès!"
