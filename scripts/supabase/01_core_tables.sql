-- ══════════════════════════════════════════════════════════════════════
-- ChemStab Industrial v5.3 — Supabase Migration
-- Execute in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- ⚠️ Execute scripts in ORDER: 1 → 2 → 3
-- Each script is independent and can be re-run safely (IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ SCRIPT 1/3 — Core tables (users, projects, organizations)          ║
-- ║ Run this FIRST if you don't have these tables yet                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for text search

-- ── Enum types ────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE user_role AS ENUM (
    'viewer', 'analyst', 'project_manager', 'org_admin', 'super_admin'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE project_status AS ENUM (
    'active', 'completed', 'archived', 'on_hold'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Organizations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(300) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users (linked to Supabase auth.users) ─────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(300) UNIQUE NOT NULL,
    full_name VARCHAR(300),
    role user_role DEFAULT 'viewer',
    organization_id UUID REFERENCES organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Projects ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Molecules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS molecules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identifiers
    name VARCHAR(500) NOT NULL,
    cas_number VARCHAR(20),
    iupac_name VARCHAR(1000),
    smiles TEXT,
    inchi TEXT,
    inchi_key VARCHAR(27) UNIQUE,
    canonical_smiles TEXT,

    -- External references
    chembl_id VARCHAR(20) UNIQUE,
    pubchem_cid INTEGER UNIQUE,
    drugbank_id VARCHAR(20),

    -- Basic properties
    formula VARCHAR(200),
    molar_mass DOUBLE PRECISION,
    exact_mass DOUBLE PRECISION,
    logp DOUBLE PRECISION,
    logd DOUBLE PRECISION,
    pka_acid DOUBLE PRECISION,
    pka_base DOUBLE PRECISION,
    psa DOUBLE PRECISION,
    hbd INTEGER,
    hba INTEGER,
    rotatable_bonds INTEGER,
    aromatic_rings INTEGER,
    heavy_atom_count INTEGER,
    formal_charge INTEGER,

    -- Solubility & physical
    solubility_water DOUBLE PRECISION,
    solubility_unit VARCHAR(20) DEFAULT 'mg/L',
    melting_point DOUBLE PRECISION,
    boiling_point DOUBLE PRECISION,
    density DOUBLE PRECISION,
    vapor_pressure DOUBLE PRECISION,
    henrys_law_constant DOUBLE PRECISION,

    -- Stability-related
    oxidation_sensitivity DOUBLE PRECISION DEFAULT 0,
    hydrolysis_sensitivity DOUBLE PRECISION DEFAULT 0,
    light_sensitivity DOUBLE PRECISION DEFAULT 0,
    thermal_sensitivity DOUBLE PRECISION DEFAULT 0,
    ph_optimal DOUBLE PRECISION DEFAULT 7.0,
    temp_optimal DOUBLE PRECISION DEFAULT 25.0,

    -- Flags
    is_reducing_sugar BOOLEAN DEFAULT FALSE,
    is_amino_acid BOOLEAN DEFAULT FALSE,
    is_chelator BOOLEAN DEFAULT FALSE,
    is_strong_oxidizer BOOLEAN DEFAULT FALSE,
    is_reductant BOOLEAN DEFAULT FALSE,
    is_acid BOOLEAN DEFAULT FALSE,
    is_base BOOLEAN DEFAULT FALSE,
    is_salt BOOLEAN DEFAULT FALSE,
    is_solvent BOOLEAN DEFAULT FALSE,
    is_polymer BOOLEAN DEFAULT FALSE,
    is_surfactant BOOLEAN DEFAULT FALSE,
    is_preservative BOOLEAN DEFAULT FALSE,
    is_antioxidant BOOLEAN DEFAULT FALSE,
    is_excipient BOOLEAN DEFAULT FALSE,
    is_active_ingredient BOOLEAN DEFAULT FALSE,

    -- Classification
    therapeutic_area VARCHAR(200),
    max_phase DOUBLE PRECISION,
    first_approval INTEGER,
    oral BOOLEAN,
    parenteral BOOLEAN,
    topical BOOLEAN,

    -- Descriptors & predictions
    descriptors JSONB,
    predicted_stability_score DOUBLE PRECISION,
    predicted_degradation_rate DOUBLE PRECISION,
    predicted_solubility_class VARCHAR(50),
    prediction_confidence DOUBLE PRECISION,
    prediction_model_version VARCHAR(50),
    prediction_date TIMESTAMPTZ,

    -- Provenance
    data_source VARCHAR(100),
    data_quality_score DOUBLE PRECISION,
    last_verified_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Molecule aliases ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS molecule_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    molecule_id UUID NOT NULL REFERENCES molecules(id) ON DELETE CASCADE,
    alias VARCHAR(500) NOT NULL,
    alias_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Substances (link molecules to projects) ───────────────────────────

CREATE TABLE IF NOT EXISTS substances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    molecule_id UUID REFERENCES molecules(id),
    name VARCHAR(300) NOT NULL,
    cas_number VARCHAR(20),
    formula VARCHAR(200),
    molar_mass DOUBLE PRECISION,
    concentration DOUBLE PRECISION,
    concentration_unit VARCHAR(30) DEFAULT 'g/L',
    purity DOUBLE PRECISION DEFAULT 100,
    grade VARCHAR(50),
    supplier VARCHAR(200),
    lot_number VARCHAR(100),
    expiry_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes for core tables ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_molecules_name ON molecules USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_molecules_smiles ON molecules USING gin(canonical_smiles gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_molecules_cas ON molecules(cas_number);
CREATE INDEX IF NOT EXISTS idx_molecules_chembl ON molecules(chembl_id);
CREATE INDEX IF NOT EXISTS idx_molecules_pubchem ON molecules(pubchem_cid);
CREATE INDEX IF NOT EXISTS idx_substances_project ON substances(project_id);
CREATE INDEX IF NOT EXISTS idx_substances_molecule ON substances(molecule_id);
CREATE INDEX IF NOT EXISTS idx_aliases_molecule ON molecule_aliases(molecule_id);
CREATE INDEX IF NOT EXISTS idx_aliases_alias ON molecule_aliases USING gin(alias gin_trgm_ops);

-- ── Auto-update triggers ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated ON organizations;
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_molecules_updated ON molecules;
CREATE TRIGGER trg_molecules_updated BEFORE UPDATE ON molecules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS (Row Level Security) for core tables ──────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE molecules ENABLE ROW LEVEL SECURITY;
ALTER TABLE substances ENABLE ROW LEVEL SECURITY;

-- Users can read their own org
CREATE POLICY "Users can view own organization" ON organizations
    FOR SELECT USING (
        id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

-- Users can view members of their org
CREATE POLICY "Users can view org members" ON users
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Projects: members of the org can view
CREATE POLICY "Org members can view projects" ON projects
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    );

-- Projects: analysts+ can create
CREATE POLICY "Analysts can create projects" ON projects
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('analyst', 'project_manager', 'org_admin', 'super_admin'))
    );

-- Molecules: readable by all authenticated users
CREATE POLICY "Authenticated users can view molecules" ON molecules
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Substances: same as projects
CREATE POLICY "Org members can view substances" ON substances
    FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        ))
    );

COMMENT ON TABLE users IS 'ChemStab users — linked to Supabase auth.users';
COMMENT ON TABLE organizations IS 'Multi-tenant organizations';
COMMENT ON TABLE projects IS 'R&D projects within organizations';
COMMENT ON TABLE molecules IS 'Chemical database with descriptors and QSPR predictions';
