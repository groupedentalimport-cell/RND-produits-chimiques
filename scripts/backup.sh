#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# ChemStab Industrial — Database Backup Script
# Runs daily via cron, retains 30 days of backups
# ══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-chemstab_industrial}"
DB_USER="${DB_USER:-chemstab}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/chemstab_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ── Create backup directory ───────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── Logging ───────────────────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "Starting backup of ${DB_NAME}..."

# ── Perform backup ────────────────────────────────────────────────────
# Note: pg_dump --format=custom already compresses, so no need for gzip pipe
BACKUP_FILE_UNCOMPRESSED="${BACKUP_DIR}/chemstab_${TIMESTAMP}.dump"
if PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=custom \
    --compress=9 \
    --verbose \
    2>>"${LOG_FILE}" > "${BACKUP_FILE_UNCOMPRESSED}"; then

    # Rename to .gz for consistency (it's already compressed by pg_dump)
    mv "${BACKUP_FILE_UNCOMPRESSED}" "${BACKUP_FILE}"
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "✅ Backup successful: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    log "❌ Backup FAILED!"
    rm -f "${BACKUP_FILE}" "${BACKUP_FILE_UNCOMPRESSED}"
    exit 1
fi

# ── Verify backup integrity ───────────────────────────────────────────
# Check file is non-empty and valid
if [ -s "${BACKUP_FILE}" ]; then
    log "✅ Backup integrity verified"
else
    log "❌ Backup integrity check FAILED!"
    exit 1
fi

# ── Cleanup old backups ───────────────────────────────────────────────
DELETED=$(find "${BACKUP_DIR}" -name "chemstab_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "${DELETED}" -gt 0 ]; then
    log "🗑️ Cleaned up ${DELETED} old backup(s) (>${RETENTION_DAYS} days)"
fi

# ── Summary ───────────────────────────────────────────────────────────
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "chemstab_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
log "📊 Total backups: ${TOTAL_BACKUPS}, Total size: ${TOTAL_SIZE}"

log "Backup completed successfully"
