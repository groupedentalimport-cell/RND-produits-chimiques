# ChemStab v5.3 — Guide de Déploiement Supabase

## 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **New Project**
2. Note le **Project URL** et l'**anon key** (Settings → API)
3. Note le **Database URL** (Settings → Database → Connection string → URI)

## 2. Exécuter les scripts SQL

Dans **Supabase Dashboard → SQL Editor**, exécute dans l'ordre :

```
Script 1/3 → scripts/supabase/01_core_tables.sql
Script 2/3 → scripts/supabase/02_stability_module.sql
Script 3/3 → scripts/supabase/03_audit_and_views.sql
```

**Vérification** : dans SQL Editor, exécute :
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Tu devrais voir :
```
audit_log
degradation_results
molecule_aliases
molecules
organizations
projects
simulation_runs
stability_studies
stability_time_points
substances
users
```

## 3. Configurer le Backend (FastAPI)

### `.env` à la racine du projet

```env
# ── Supabase Database ──────────────────────────────────────────────
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# ── Supabase Connection Pooler (recommandé pour les apps) ──────────
# Utilise le connection pooler de Supabase (port 6543) plutôt que direct (port 5432)
# Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# ── Redis (optionnel — peut utiliser Upstash ou Redis Cloud) ───────
REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379

# ── Security ───────────────────────────────────────────────────────
SECRET_KEY=[GÉNÉRER AVEC: openssl rand -hex 32]
DEBUG=true

# ── App ────────────────────────────────────────────────────────────
APP_NAME=ChemStab Industrial
APP_VERSION=5.3.0
APP_CODENAME=StabilityLab Supabase

# ── CORS ───────────────────────────────────────────────────────────
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173","https://[TON-DOMAINE].com"]
```

### Modifier `backend/requirements.txt`

Ajouter après les dépendances existantes :

```txt
# ── Supabase (optional — for Supabase Auth integration) ────────────
# supabase>=2.0.0
```

### Modifier `backend/app/core/database.py`

Remplacer la fonction `get_db` pour utiliser le pool Supabase :

```python
# Dans database.py, le DATABASE_URL de .env est déjà pris en charge.
# Supabase utilise PostgreSQL standard — pas de changement nécessaire.
# Le connection string Supabase fonctionne directement avec SQLAlchemy.

# Juste s'assurer que le pool est configuré pour Supabase :
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,           # Réduit pour Supabase (max 15 en free tier)
    max_overflow=5,
    pool_recycle=300,      # Plus court pour les connexions pooler
    pool_pre_ping=True,    # Vérifie les connexions mortes
    connect_args={
        "sslmode": "require",  # Supabase exige SSL
        "options": "-c search_path=public",
    }
)
```

## 4. Créer le premier utilisateur admin

Dans **Supabase Dashboard → Authentication → Users → Invite user**,
puis dans **SQL Editor** :

```sql
-- Remplacer l'email par celui de l'admin invité
UPDATE users
SET role = 'super_admin',
    full_name = 'Admin',
    is_active = TRUE
WHERE email = 'ton-email@example.com';
```

## 5. Déploiement Backend (FastAPI)

### Option A — Railway (recommandé, gratuit)

```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Se connecter
railway login

# 3. Créer le projet
railway init

# 4. Ajouter les variables d'environnement
railway variables set DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
railway variables set SECRET_KEY="$(openssl rand -hex 32)"
railway variables set DEBUG="false"

# 5. Déployer
railway up
```

### Option B — Render

1. Va sur [render.com](https://render.com) → **New Web Service**
2. Connecte ton repo GitHub
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Ajoute les variables d'environnement dans le dashboard

### Option C — Fly.io

```bash
# 1. Installer flyctl
curl -L https://fly.io/install.sh | sh

# 2. Init
fly launch

# 3. Secrets
fly secrets set DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
fly secrets set SECRET_KEY="$(openssl rand -hex 32)"

# 4. Deploy
fly deploy
```

## 6. Déploiement Frontend (React)

### Option A — Vercel (recommandé)

```bash
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Depuis le dossier frontend/
cd frontend
vercel

# 3. Configurer l'URL du backend
# Dans vercel.json ou les variables d'environnement :
VITE_API_URL=https://ton-backend.up.railway.app
```

### Option B — Netlify

1. Connecte le repo sur [netlify.com](https://netlify.com)
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Variable: `VITE_API_URL=https://ton-backend.up.railway.app`

## 7. Architecture Finale

```
┌─────────────────────────────────────────────────┐
│  Frontend (React + TypeScript)                  │
│  Vercel / Netlify                               │
│  https://ton-app.vercel.app                     │
└──────────────┬──────────────────────────────────┘
               │ API calls
               ▼
┌─────────────────────────────────────────────────┐
│  Backend (FastAPI + Python)                     │
│  Railway / Render / Fly.io                      │
│  https://ton-api.up.railway.app                 │
│                                                 │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Stability     │  │ QSPR/ML Engines          │ │
│  │ Simulator     │  │ (Arrhenius, RDKit, etc.) │ │
│  │ (ICH Q1A-F)  │  │                          │ │
│  └──────────────┘  └──────────────────────────┘ │
└──────────────┬──────────────────────────────────┘
               │ SQL (SSL)
               ▼
┌─────────────────────────────────────────────────┐
│  Database (Supabase PostgreSQL)                 │
│  https://[ref].supabase.co                      │
│                                                 │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Row Level     │  │ Audit Trail (GxP)        │ │
│  │ Security      │  │ 21 CFR Part 11           │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 8. Coûts Estimés

| Service | Free Tier | Payant |
|---------|-----------|--------|
| **Supabase** | 500 MB DB, 1 GB stockage, 50k users | $25/mois (Pro) |
| **Railway** | $5 crédits/mois | ~$5-20/mois |
| **Vercel** | 100 GB bandwidth | $20/mois (Pro) |
| **Total** | **Gratuit** pour dev/test | **~$50-65/mois** prod |

## 9. Vérification Post-Déploiement

```bash
# Tester l'API
curl https://ton-api.up.railway.app/health
# → {"status":"healthy","version":"5.3.0"}

curl https://ton-api.up.railway.app/version
# → {"version":"5.3.0","features":{"stability_simulation":true,...}}

# Tester la simulation
curl -X POST https://ton-api.up.railway.app/api/v1/stability/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "substance_name": "Aspirin",
    "initial_concentration": 100,
    "temperature_c": 25,
    "humidity_percent": 60,
    "activation_energy": 75000,
    "pre_exponential_factor": 1e10,
    "kinetic_order": 1,
    "duration_months": 36
  }'
```
