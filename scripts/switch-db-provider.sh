#!/usr/bin/env bash
# ============================================================
# ChemStab — Switch Database Provider
# ============================================================
# Usage:
#   ./scripts/switch-db-provider.sh sqlite       # Use SQLite (dev)
#   ./scripts/switch-db-provider.sh postgresql   # Use PostgreSQL (prod)
#
# This script copies the appropriate Prisma schema to
# prisma/schema.prisma, then runs prisma generate + db push.
# ============================================================

set -euo pipefail

# ── Validate argument ──────────────────────────────────────────
PROVIDER="${1:-}"

if [[ "$PROVIDER" != "sqlite" && "$PROVIDER" != "postgresql" ]]; then
  echo "❌ Invalid provider: '$PROVIDER'"
  echo "Usage: $0 <sqlite|postgresql>"
  exit 1
fi

# ── Determine project root ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SCHEMA_DIR="$PROJECT_ROOT/prisma"
SCHEMA_FILE="$SCHEMA_DIR/schema.prisma"

if [[ "$PROVIDER" == "sqlite" ]]; then
  SOURCE="$SCHEMA_DIR/schema.sqlite.prisma"
  # If no dedicated sqlite variant exists, the current schema.prisma IS sqlite
  # We keep a backup of the current sqlite schema on first switch
  if [[ ! -f "$SOURCE" ]]; then
    # Check if current schema is already sqlite
    if grep -q 'provider = "sqlite"' "$SCHEMA_FILE" 2>/dev/null; then
      # Save current as the sqlite baseline
      cp "$SCHEMA_FILE" "$SOURCE"
      echo "📋 Saved current SQLite schema as baseline → prisma/schema.sqlite.prisma"
    else
      echo "❌ No SQLite schema found. Current schema.prisma is not SQLite."
      echo "   Please ensure prisma/schema.sqlite.prisma exists or the current schema.prisma uses SQLite."
      exit 1
    fi
  fi
else
  SOURCE="$SCHEMA_DIR/schema.prod.prisma"
  if [[ ! -f "$SOURCE" ]]; then
    echo "❌ PostgreSQL schema not found: $SOURCE"
    exit 1
  fi
fi

# ── Backup current schema ──────────────────────────────────────
if [[ -f "$SCHEMA_FILE" ]]; then
  BACKUP="$SCHEMA_DIR/schema.prisma.bak"
  cp "$SCHEMA_FILE" "$BACKUP"
  echo "📋 Backed up current schema → prisma/schema.prisma.bak"
fi

# ── Copy the chosen schema ─────────────────────────────────────
cp "$SOURCE" "$SCHEMA_FILE"
echo "✅ Switched prisma/schema.prisma → provider = \"$PROVIDER\""

# ── Regenerate Prisma client ───────────────────────────────────
echo "🔄 Running prisma generate..."
cd "$PROJECT_ROOT"
npx prisma generate

# ── Push schema to database ────────────────────────────────────
echo "🔄 Running prisma db push..."
npx prisma db push --accept-data-loss

echo ""
echo "🎉 Database provider switched to '$PROVIDER' successfully!"
echo "   Prisma client regenerated and schema pushed."
