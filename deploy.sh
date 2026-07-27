#!/usr/bin/env bash
# ============================================================
# ChemStab — Deployment Script
# ============================================================
#
# Usage:
#   ./deploy.sh deploy    — Build & start all services, seed DB
#   ./deploy.sh stop      — Stop and remove all containers
#   ./deploy.sh status    — Show running services and health
#
# Prerequisites:
#   - Docker (>= 20.10) and docker-compose (>= 2.0) installed
#   - .env.production configured (or template will be copied)
#
# ============================================================

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

# ── Helper Functions ───────────────────────────────────────────

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

step()  { echo -e "${CYAN}──────────────────────────────────────────────────${NC}"; echo -e "${CYAN}  $*${NC}"; echo -e "${CYAN}──────────────────────────────────────────────────${NC}"; }

# ── Paths ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PRODUCTION="${SCRIPT_DIR}/.env.production"
ENV_TEMPLATE="${SCRIPT_DIR}/.env.production"  # The template IS .env.production
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# ── Commands ──────────────────────────────────────────────────

cmd_deploy() {
  step "Checking prerequisites"

  # ── 1. Check Docker is installed ──────────────────────────────
  if ! command -v docker &>/dev/null; then
    fail "Docker is not installed. Please install Docker (>= 20.10) first."
  fi
  ok "Docker found: $(docker --version)"

  if ! docker compose version &>/dev/null; then
    if ! command -v docker-compose &>/dev/null; then
      fail "docker-compose is not installed. Please install docker-compose (>= 2.0)."
    fi
    COMPOSE_CMD="docker-compose"
  else
    COMPOSE_CMD="docker compose"
  fi
  ok "Compose found: $($COMPOSE_CMD version --short 2>/dev/null || docker-compose version --short)"

  # ── 2. Create .env.production from template if not exists ─────
  step "Setting up environment"
  if [ ! -f "${ENV_PRODUCTION}" ]; then
    warn ".env.production does not exist — creating from template"
    # If there's a separate template file, copy it; otherwise warn the user
    if [ -f "${SCRIPT_DIR}/.env.example" ]; then
      cp "${SCRIPT_DIR}/.env.example" "${ENV_PRODUCTION}"
      warn "Copied .env.example → .env.production. Please review and update values:"
      warn "  - DATABASE_URL   (set to PostgreSQL connection string)"
      warn "  - NEXTAUTH_URL   (set to your public domain)"
      warn "  - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)"
      warn "  - POSTGRES_USER / POSTGRES_PASSWORD (for the DB container)"
    else
      fail "No .env.example template found. Cannot create .env.production automatically."
    fi
  else
    ok ".env.production exists"
  fi

  # Quick sanity check on required env values
  if grep -q 'CHANGE_ME' "${ENV_PRODUCTION}" 2>/dev/null; then
    warn ".env.production contains placeholder values (CHANGE_ME)."
    warn "For a real deployment, update these before proceeding."
    warn "Continuing anyway for demo/testing purposes..."
  fi

  # ── 3. Run docker-compose up ──────────────────────────────────
  step "Building and starting services"
  info "Running: $COMPOSE_CMD up -d --build"
  $COMPOSE_CMD -f "${COMPOSE_FILE}" up -d --build 2>&1 || {
    fail "docker-compose up failed. Check logs with: $COMPOSE_CMD logs"
  }
  ok "Containers built and started"

  # ── 4. Wait for services to be healthy ─────────────────────────
  step "Waiting for services to become healthy"

  MAX_WAIT=120  # seconds
  ELAPSED=0
  INTERVAL=5

  declare -A SERVICES=( [postgres]="PostgreSQL" [app]="Next.js App" [notifications]="Notifications" [caddy]="Caddy Gateway" )

  ALL_HEALTHY=false

  while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    ALL_HEALTHY=true

    for service in postgres app notifications; do
      STATUS=$(docker inspect --format='{{.State.Health.Status}}' "chemstab-${service}" 2>/dev/null || echo "not-found")

      if [ "$STATUS" = "healthy" ]; then
        ok "${SERVICES[$service]} — healthy"
      elif [ "$STATUS" = "starting" ] || [ "$STATUS" = "not-found" ]; then
        info "${SERVICES[$service]} — waiting (${ELAPSED}s elapsed)"
        ALL_HEALTHY=false
      else
        warn "${SERVICES[$service]} — ${STATUS}"
        ALL_HEALTHY=false
      fi
    done

    # Caddy depends on others, check separately
    CADDY_STATUS=$(docker inspect --format='{{.State.Status}}' "chemstab-caddy" 2>/dev/null || echo "not-found")
    if [ "$CADDY_STATUS" = "running" ]; then
      ok "Caddy Gateway — running"
    else
      info "Caddy Gateway — waiting (${ELAPSED}s elapsed)"
      ALL_HEALTHY=false
    fi

    if [ "$ALL_HEALTHY" = true ]; then
      break
    fi

    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
  done

  if [ "$ALL_HEALTHY" = false ]; then
    warn "Some services did not become healthy within ${MAX_WAIT}s."
    warn "Check logs: $COMPOSE_CMD logs"
    warn "Proceeding anyway — services may still be starting up."
  else
    ok "All services are healthy!"
  fi

  # ── 5. Run database seed if needed ────────────────────────────
  step "Database seeding"
  info "Checking if database needs seeding..."

  # Attempt to seed via the Next.js API endpoint
  SEED_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/seed 2>/dev/null || echo "000")

  if [ "$SEED_RESPONSE" = "200" ] || [ "$SEED_RESPONSE" = "201" ]; then
    ok "Database seeded successfully (HTTP ${SEED_RESPONSE})"
  elif [ "$SEED_RESPONSE" = "000" ]; then
    warn "Cannot reach seed endpoint — app may still be starting. You can seed manually later:"
    warn "  curl -X POST http://localhost:3000/api/seed"
  else
    info "Seed endpoint returned HTTP ${SEED_RESPONSE} (may already be seeded)"
  fi

  # ── 6. Show final status ──────────────────────────────────────
  step "Deployment complete — service status"
  cmd_status

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ChemStab is running!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  App:             http://localhost:3000${NC}"
  echo -e "${CYAN}  Notifications:   http://localhost:3003${NC}"
  echo -e "${CYAN}  Gateway (Caddy): http://localhost:81${NC}"
  echo -e "${CYAN}  PostgreSQL:      localhost:5432${NC}"
  echo ""
  echo -e "${YELLOW}  To stop:    ./deploy.sh stop${NC}"
  echo -e "${YELLOW}  To check:   ./deploy.sh status${NC}"
  echo ""
}

cmd_stop() {
  step "Stopping all services"

  if ! command -v docker &>/dev/null; then
    fail "Docker is not installed."
  fi

  # Determine compose command
  if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    fail "docker-compose is not installed."
  fi

  info "Running: $COMPOSE_CMD down"
  $COMPOSE_CMD -f "${COMPOSE_FILE}" down 2>&1 || {
    fail "docker-compose down failed."
  }

  ok "All services stopped and containers removed"
  echo ""
}

cmd_status() {
  step "Service status"

  if ! command -v docker &>/dev/null; then
    fail "Docker is not installed."
  fi

  # Determine compose command
  if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    fail "docker-compose is not installed."
  fi

  # ── docker-compose ps ──────────────────────────────────────────
  info "docker-compose ps:"
  $COMPOSE_CMD -f "${COMPOSE_FILE}" ps 2>&1 || {
    warn "No containers are running"
    return
  }

  echo ""

  # ── Detailed health status ────────────────────────────────────
  info "Detailed health check:"
  echo ""

  for container in chemstab-postgres chemstab-app chemstab-notifications chemstab-caddy; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$" 2>/dev/null; then
      HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "no-healthcheck")
      STATE=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "unknown")
      PORTS=$(docker port "${container}" 2>/dev/null || echo "none")

      if [ "$HEALTH" = "healthy" ]; then
        ok "${container}: state=${STATE}, health=${HEALTH}, ports=${PORTS}"
      elif [ "$HEALTH" = "no-healthcheck" ]; then
        info "${container}: state=${STATE} (no healthcheck defined), ports=${PORTS}"
      elif [ "$HEALTH" = "starting" ]; then
        warn "${container}: state=${STATE}, health=${HEALTH} (still starting), ports=${PORTS}"
      else
        fail "${container}: state=${STATE}, health=${HEALTH}, ports=${PORTS}"
      fi
    else
      warn "${container}: NOT RUNNING"
    fi
  done

  echo ""
}

# ── Main ──────────────────────────────────────────────────────

case "${1:-}" in
  deploy)
    cmd_deploy
    ;;
  stop)
    cmd_stop
    ;;
  status)
    cmd_status
    ;;
  *)
    echo "ChemStab Deployment Script"
    echo ""
    echo "Usage:"
    echo "  ./deploy.sh deploy   — Build & start all services, seed database"
    echo "  ./deploy.sh stop     — Stop and remove all containers"
    echo "  ./deploy.sh status   — Show running services and health status"
    echo ""
    exit 1
    ;;
esac
