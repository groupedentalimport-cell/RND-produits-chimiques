#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# ChemStab Industrial — Database Restore Script
# Restores from a backup file created by backup.sh
# ══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-chemstab_industrial}"
DB_USER="${DB_USER:-chemstab}"

# ── Parse arguments ───────────────────────────────────────────────────
if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"/chemstab_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# ── Confirmation ──────────────────────────────────────────────────────
echo "⚠️  WARNING: This will REPLACE the current database '${DB_NAME}'"
echo "   Backup file: ${BACKUP_FILE}"
echo "   Database:    ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# ── Restore ───────────────────────────────────────────────────────────
echo "🔄 Restoring database..."

# Terminate existing connections
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" \
    2>/dev/null || true

# Drop and recreate database
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
    -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" \
    2>&1

# Restore from backup
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD}" pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --verbose \
    --no-owner \
    --no-privileges \
    2>&1

echo "✅ Database restored successfully from: ${BACKUP_FILE}"
