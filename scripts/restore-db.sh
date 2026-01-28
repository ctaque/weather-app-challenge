#!/bin/bash

set -euo pipefail

# Script de restauration PostgreSQL depuis S3
# Usage: ./restore-db.sh <DATABASE_URL> <S3_BUCKET> <BACKUP_FILE>

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Vérification des arguments
if [ $# -eq 2 ]; then
    # Mode: lister les backups disponibles
    DATABASE_URL="$1"
    S3_BUCKET="$2"
    LIST_MODE=true
elif [ $# -eq 3 ]; then
    DATABASE_URL="$1"
    S3_BUCKET="$2"
    BACKUP_FILE="$3"
    LIST_MODE=false
else
    log_error "Usage: $0 <DATABASE_URL> <S3_BUCKET> [BACKUP_FILE]"
    log_error ""
    log_error "Exemples:"
    log_error "  # Lister les backups disponibles:"
    log_error "  $0 'postgresql://user:password@localhost:5432/mydb' 'my-backup-bucket'"
    log_error ""
    log_error "  # Restaurer un backup spécifique:"
    log_error "  $0 'postgresql://user:password@localhost:5432/mydb' 'my-backup-bucket' 'backup_20260128_120000.sql.gz'"
    log_error ""
    log_error "  # Restaurer le dernier backup:"
    log_error "  $0 'postgresql://user:password@localhost:5432/mydb' 'my-backup-bucket' 'latest'"
    exit 1
fi

# Vérification des dépendances
command -v psql >/dev/null 2>&1 || {
    log_error "psql n'est pas installé. Installez postgresql-client."
    exit 1
}

command -v aws >/dev/null 2>&1 || {
    log_error "aws CLI n'est pas installé. Installez awscli."
    exit 1
}

# Mode listing
if [ "$LIST_MODE" = true ]; then
    log_info "Backups disponibles dans s3://${S3_BUCKET}/backups/:"
    echo ""
    aws s3 ls "s3://${S3_BUCKET}/backups/" | grep "backup_" | sort -r | while read -r line; do
        echo "  $line"
    done
    echo ""
    log_info "Pour restaurer un backup, utilisez:"
    log_info "$0 '$DATABASE_URL' '$S3_BUCKET' <nom_du_fichier>"
    exit 0
fi

# Validation du format de DATABASE_URL
if [[ ! $DATABASE_URL =~ ^postgresql:// ]]; then
    log_error "Format de DATABASE_URL invalide. Format attendu: postgresql://user:password@host:port/database"
    exit 1
fi

# Détermination du fichier de backup à restaurer
if [ "$BACKUP_FILE" = "latest" ]; then
    log_info "Recherche du dernier backup..."
    BACKUP_FILE=$(aws s3 ls "s3://${S3_BUCKET}/backups/" | grep "backup_" | sort -r | head -n1 | awk '{print $4}')
    if [ -z "$BACKUP_FILE" ]; then
        log_error "Aucun backup trouvé dans s3://${S3_BUCKET}/backups/"
        exit 1
    fi
    log_info "Dernier backup trouvé: $BACKUP_FILE"
fi

S3_PATH="s3://${S3_BUCKET}/backups/${BACKUP_FILE}"
LOCAL_PATH="/tmp/${BACKUP_FILE}"

# Vérification de l'existence du backup sur S3
log_info "Vérification de l'existence du backup..."
if ! aws s3 ls "$S3_PATH" >/dev/null 2>&1; then
    log_error "Le backup $BACKUP_FILE n'existe pas sur S3"
    log_info "Utilisez '$0 $DATABASE_URL $S3_BUCKET' pour lister les backups disponibles"
    exit 1
fi

# Avertissement
log_warn "⚠️  ATTENTION: Cette opération va ÉCRASER la base de données actuelle!"
log_warn "Base de données: ${DATABASE_URL}"
log_warn "Backup: ${BACKUP_FILE}"
echo ""
read -p "Êtes-vous sûr de vouloir continuer? (tapez 'yes' pour confirmer): " CONFIRMATION

if [ "$CONFIRMATION" != "yes" ]; then
    log_info "Restauration annulée"
    exit 0
fi

# Téléchargement du backup depuis S3
log_info "Téléchargement du backup depuis S3..."
if aws s3 cp "$S3_PATH" "$LOCAL_PATH"; then
    BACKUP_SIZE=$(du -h "$LOCAL_PATH" | cut -f1)
    log_info "Backup téléchargé: $LOCAL_PATH ($BACKUP_SIZE)"
else
    log_error "Échec du téléchargement du backup"
    exit 1
fi

# Extraction du nom de la base de données
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*\/\([^?]*\).*|\1|p')
log_info "Base de données cible: $DB_NAME"

# Arrêt des connexions actives (optionnel, décommenter si nécessaire)
# log_warn "Arrêt des connexions actives à la base de données..."
# psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" || true

# Suppression de la base de données existante (optionnel)
log_warn "Nettoyage de la base de données..."
# Décommenter les lignes suivantes pour supprimer et recréer la base
# BASE_URL=$(echo "$DATABASE_URL" | sed 's|/[^/]*$|/postgres|')
# psql "$BASE_URL" -c "DROP DATABASE IF EXISTS $DB_NAME;"
# psql "$BASE_URL" -c "CREATE DATABASE $DB_NAME;"

# Nettoyage
log_info "✓ Restauration complète!"

log_info "Restauration de la base de données..."

set +e
gunzip -c "$LOCAL_PATH" | psql "$DATABASE_URL" 2> /tmp/restore_error.log
RESTORE_STATUS=$?
set -e

if [ $RESTORE_STATUS -eq 0 ]; then
    log_info "✓ Restauration terminée avec succès!"
else
    log_error "Échec de la restauration"
    log_error "Détails de l'erreur :"
    cat /tmp/restore_error.log
    rm -f "$LOCAL_PATH"
    exit 1
fi
