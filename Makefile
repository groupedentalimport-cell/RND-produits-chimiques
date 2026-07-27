# ══════════════════════════════════════════════════════════════════════
# ChemStab Industrial — Makefile
# Developer experience & production operations
# ══════════════════════════════════════════════════════════════════════

.PHONY: help install dev test lint build up down logs clean

# ── Default ──────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────────────
install: ## Install Python dependencies
	cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt

dev: ## Start development servers
	docker compose up -d db redis
	cd backend && uvicorn app.main:app --reload --port 8000

dev-full: ## Start full stack (backend + frontend + db + redis)
	docker compose up -d

# ── Testing ──────────────────────────────────────────────────────────
test: ## Run backend tests
	cd backend && python -m pytest app/tests/ -v --tb=short

test-cov: ## Run tests with coverage
	cd backend && python -m pytest app/tests/ -v --cov=app --cov-report=term-missing --cov-report=html

test-api: ## Test API endpoints
	curl -s http://localhost:8000/health | python -m json.tool
	curl -s http://localhost:8000/version | python -m json.tool

# ── Code Quality ─────────────────────────────────────────────────────
lint: ## Run linter
	cd backend && ruff check app/
	cd backend && ruff format --check app/

format: ## Auto-format code
	cd backend && ruff format app/
	cd backend && ruff check --fix app/

security: ## Security scan
	cd backend && bandit -r app/ -f text
	safety check -r backend/requirements.txt

# ── Docker ───────────────────────────────────────────────────────────
build: ## Build production Docker images
	docker compose -f docker-compose.prod.yml build

up: ## Start production stack
	docker compose -f docker-compose.prod.yml up -d

down: ## Stop production stack
	docker compose -f docker-compose.prod.yml down

restart: ## Restart production stack
	docker compose -f docker-compose.prod.yml restart

logs: ## Show production logs
	docker compose -f docker-compose.prod.yml logs -f --tail=100

logs-backend: ## Show backend logs only
	docker compose -f docker-compose.prod.yml logs -f backend --tail=100

# ── Database ─────────────────────────────────────────────────────────
db-shell: ## Open PostgreSQL shell
	docker compose exec db psql -U chemstab -d chemstab_industrial

db-backup: ## Backup database
	docker compose exec db pg_dump -U chemstab chemstab_industrial > backup_$$(date +%Y%m%d_%H%M%S).sql

db-restore: ## Restore database (usage: make db-restore FILE=backup.sql)
	docker compose exec -T db psql -U chemstab chemstab_industrial < $(FILE)

db-migrate: ## Run Alembic migrations
	cd backend && alembic upgrade head

db-revision: ## Create new Alembic migration
	cd backend && alembic revision --autogenerate -m "$(MSG)"

# ── ML Models ────────────────────────────────────────────────────────
train-qspr: ## Train QSPR models on benchmark data
	curl -X POST "http://localhost:8000/api/v1/admin/train-qspr?use_benchmarks=true"

train-status: ## Check QSPR training status
	curl -s "http://localhost:8000/api/v1/experimental/qspr/training-summary" | python -m json.tool

# ── Monitoring ───────────────────────────────────────────────────────
prometheus: ## Open Prometheus UI
	@echo "http://localhost:9090"

grafana: ## Open Grafana UI
	@echo "http://localhost:3001 (admin/admin)"

status: ## Show service status
	docker compose -f docker-compose.prod.yml ps

# ── Cleanup ──────────────────────────────────────────────────────────
clean: ## Clean build artifacts
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

clean-docker: ## Remove all Docker containers and volumes
	docker compose -f docker-compose.prod.yml down -v --remove-orphans

clean-all: clean clean-docker ## Clean everything

# ── Documentation ────────────────────────────────────────────────────
docs: ## Open API documentation
	@echo "http://localhost:8000/docs (Swagger UI)"
	@echo "http://localhost:8000/redoc (ReDoc)"

# ── Environment ──────────────────────────────────────────────────────
env-example: ## Create .env from example
	cp .env.example .env
	@echo "Edit .env with your configuration"

check-env: ## Check environment configuration
	@test -f .env && echo ".env exists" || echo ".env missing — run 'make env-example'"
	@echo "--- Required variables ---"
	@grep -E "^[A-Z_]+=" .env.example 2>/dev/null | head -20 || true
