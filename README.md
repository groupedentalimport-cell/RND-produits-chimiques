# ⚗️ ChemStab Industrial v5.2 — StabilityLab

**Professional chemical stability assessment platform with QSPR/ML predictions trained on real experimental data, multi-tenant architecture, GxP audit trail, and ICH/FDA/EMA regulatory reports.**

---

## What's New in v5.2 (Advanced Scientific Prediction Engine)

| Feature | v5.1 (Previous) | v5.2 (Scientific Engine) |
|---|---|---|
| **Descriptors** | Basic RDKit | 200+ descriptors + 48 SMARTS patterns (instability + functional groups) |
| **Fingerprints** | Morgan 2048-bit | Morgan + MACCS + Topological Torsion + RDKit FP |
| **Instability Detection** | Rule-based | 28 SMARTS patterns (esters, thiols, peroxides, etc.) |
| **Thermodynamics** | Estimated | NIST reference + CoolProp + Joback group contribution |
| **QSPR Training** | Simulated | Real experimental: ESOL (1,128) + FreeSolv (642) + Lipophilicity (4,200) |
| **Validation** | None | 5-fold CV with R², RMSE, MAE, applicability domain |
| **DFT** | None | Psi4/ORCA/Gaussian integration (HOMO/LUMO, Ea, ΔG) |
| **Molecular Dynamics** | None | OpenMM/GROMACS (aggregation, solvation, RMSD) |
| **Cloud HPC** | None | AWS/GCP/Azure orchestration with cost estimation |
| **ChemBERTa** | None | Transformer embeddings + similarity |
| **Literature Mining** | None | LLM extraction (GPT-4o/Claude) of Ea, t½ from papers |
| **Property Prediction** | 16 hardcoded | 200+ computed + Ersilia Hub (200+ models) |
| **Rate Limiting** | Config only | In-memory sliding window per-IP |
| **API Endpoints** | 25+ | 75+ |

---

## Experimental Data Sources

### Free Sources (Integrated)

| Source | Compounds | Data Type | Integration |
|---|---|---|---|
| **NIST WebBook** | 15 reference compounds | Thermodynamic (ΔHf°, ΔGf°, S°, Cp), phase transitions | Curated reference DB |
| **ChEMBL** | 2.3M compounds | Stability assays, solubility, LogP, half-life | REST API |
| **PubChem** | 115M compounds | Physicochemical properties, safety/GHS | PUG-REST API |
| **ESOL (Delaney 2004)** | 1,128 compounds | Experimental aqueous solubility (log mol/L) | MoleculeNet benchmark |
| **FreeSolv (Mobley 2014)** | 642 compounds | Experimental hydration free energy (kcal/mol) | MoleculeNet benchmark |
| **Lipophilicity (Wu 2018)** | 4,200 compounds | Experimental LogD at pH 7.4 | MoleculeNet benchmark |

### Premium Sources (Manual Integration)

| Source | Data Type | Cost |
|---|---|---|
| **Reaxys (Elsevier)** | 700M reactions, thermodynamic data | ~$2K–10K/year |
| **SciFinder-n (ACS)** | 200M+ substances, real properties | ~$3K–8K/year |
| **CRC Handbook (digital)** | ΔG, ΔH, ΔS reference data | ~$500/year |
| **NIST REFPROP** | Thermophysical properties | License required |

---

## Architecture

```
chemstab-industrial/
├── backend/                     # Python FastAPI
│   ├── app/
│   │   ├── api/                 # REST endpoints
│   │   │   ├── auth.py          # JWT auth + GxP login tracking
│   │   │   ├── analysis.py      # Stability analysis + QSPR
│   │   │   ├── molecules.py     # Chemical database CRUD
│   │   │   ├── reports.py       # ICH/FDA report generation
│   │   │   ├── admin.py         # System admin + ML training
│   │   │   ├── experimental.py  # Experimental data endpoints
│   │   │   └── predictions.py   # Advanced prediction endpoints
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings + security validation
│   │   │   ├── database.py      # SQLAlchemy + PostgreSQL
│   │   │   └── security.py      # JWT, bcrypt, RBAC, e-signatures
│   │   ├── engines/
│   │   │   ├── risk_engine.py   # 9 risk types (rule-based)
│   │   │   ├── kinetics.py      # Arrhenius, Q10, Van't Hoff
│   │   │   ├── descriptors.py   # 200+ descriptors + SMARTS + fingerprints
│   │   │   ├── thermodynamics.py # NIST + CoolProp + Joback
│   │   │   ├── ersilia_hub.py   # 200+ open-source QSPR models
│   │   │   └── validation.py    # Cross-validation + R²/RMSE
│   │   ├── ml/
│   │   │   └── qspr_engine.py   # QSPR trained on real experimental data
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── services/
│   │   │   ├── chembl_loader.py # ChEMBL API integration
│   │   │   ├── gxp_audit.py     # GxP audit service
│   │   │   ├── regulatory_reports.py
│   │   │   └── experimental/    # Experimental data loaders
│   │   │       ├── chembl_experimental.py
│   │   │       ├── pubchem_experimental.py
│   │   │       ├── nist_webbook.py
│   │   │       ├── benchmark_loaders.py
│   │   │       └── data_registry.py
│   │   └── main.py              # FastAPI app + rate limiting
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                    # React + TypeScript + Tailwind
├── docker-compose.yml
├── scripts/init.sql
├── .gitignore
└── .env.example
```

---

## Quick Start

### Option A: Docker Compose (Recommended)

```bash
docker compose up -d

# Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/docs
# Default:  admin / Admin@ChemStab1!
```

### Option B: Local Development

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Train QSPR on Real Experimental Data

```bash
# Train on MoleculeNet benchmarks (recommended)
curl -X POST "http://localhost:8000/api/v1/admin/train-qspr?use_benchmarks=true"

# Check training results
curl "http://localhost:8000/api/v1/experimental/qspr/training-summary"
```

---

## New API Endpoints (v5.2)

### Experimental Data
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/experimental/enrich` | Enrich compound from all sources |
| GET | `/api/v1/experimental/nist/{name}` | NIST thermodynamic data |
| GET | `/api/v1/experimental/benchmarks/summary` | Benchmark dataset stats |
| GET | `/api/v1/experimental/benchmarks/{dataset}` | Load benchmark data |
| GET | `/api/v1/experimental/qspr/training-summary` | QSPR model provenance |
| POST | `/api/v1/experimental/chembl/search` | Search ChEMBL |
| GET | `/api/v1/experimental/pubchem/{cid}` | PubChem experimental data |

### Advanced Predictions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/predict/descriptors` | 200+ descriptors + SMARTS + fingerprints |
| POST | `/api/v1/predict/thermodynamics` | ΔG, ΔH, ΔS, Cp (NIST + CoolProp) |
| POST | `/api/v1/predict/shelf-life` | Arrhenius shelf life prediction |
| POST | `/api/v1/predict/functional-groups` | SMARTS instability detection |
| POST | `/api/v1/predict/similarity` | Tanimoto molecular similarity |
| GET | `/api/v1/predict/ersilia/models` | List 200+ Ersilia QSPR models |
| POST | `/api/v1/predict/ersilia/predict` | Multi-property Ersilia prediction |
| GET | `/api/v1/predict/validation/summary` | QSPR validation metrics |
| GET | `/api/v1/predict/capabilities` | All prediction capabilities |

### Level 3 — Advanced Computing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/advanced/dft/compute` | DFT single-point or optimization |
| POST | `/api/v1/advanced/dft/transition-state` | Activation energy from TS search |
| POST | `/api/v1/advanced/dft/reaction-energy` | ΔE, ΔH, ΔG from DFT |
| POST | `/api/v1/advanced/dft/homo-lumo` | HOMO/LUMO + reactivity descriptors |
| POST | `/api/v1/advanced/md/simulate` | Molecular dynamics simulation |
| POST | `/api/v1/advanced/md/solvation-energy` | Solvation free energy |
| POST | `/api/v1/advanced/hpc/estimate-cost` | Cloud HPC cost estimation |
| POST | `/api/v1/advanced/hpc/submit` | Submit cloud HPC job |
| GET | `/api/v1/advanced/hpc/jobs` | List HPC jobs |
| GET | `/api/v1/advanced/hpc/providers` | AWS/GCP/Azure instances |
| POST | `/api/v1/advanced/chemberta/embedding` | ChemBERTa molecular embedding |
| POST | `/api/v1/advanced/chemberta/similarity` | Transformer-based similarity |
| POST | `/api/v1/advanced/literature/extract` | LLM extraction from text |
| POST | `/api/v1/advanced/literature/extract-doi` | Extract from paper DOI |
| GET | `/api/v1/advanced/capabilities` | All Level 3 capabilities |

---

## QSPR Training Data Provenance

Each QSPR model now reports its training data source:

```json
{
  "solubility": {
    "model_type": "gradient_boosting",
    "r2": 0.82,
    "n_samples": 1128,
    "training_source": "benchmark_esol",
    "benchmark_dataset": "esol"
  },
  "logd": {
    "model_type": "random_forest",
    "r2": 0.78,
    "n_samples": 4200,
    "training_source": "benchmark_lipophilicity",
    "benchmark_dataset": "lipophilicity"
  }
}
```

---

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Celery
- **Database**: PostgreSQL 16, Redis 7
- **ML**: scikit-learn, RDKit, NumPy, SciPy
- **Data**: ChEMBL API, PubChem PUG-REST, NIST WebBook, MoleculeNet
- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Deployment**: Docker Compose, Nginx
- **Reports**: ReportLab (PDF), python-docx (DOCX), openpyxl (XLSX)

---

## License

Proprietary — All rights reserved.
