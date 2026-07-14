-- ══════════════════════════════════════════════════════════════════════
-- ChemStab Industrial v5.3 — Stability Study Module
-- ICH Q1A-Q1F compliant stability study tables
-- Run: psql -U chemstab -d chemstab_industrial -f scripts/migrate_stability_study.sql
-- ══════════════════════════════════════════════════════════════════════

-- ── Enum types ────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE study_type AS ENUM ('long_term', 'accelerated', 'intermediate', 'stress', 'photostability', 'zone_custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE study_status AS ENUM ('draft', 'in_progress', 'completed', 'under_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE degradation_order AS ENUM ('zero', 'first', 'second');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE climate_zone AS ENUM ('I', 'II', 'III', 'IVa', 'IVb');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE container_type AS ENUM ('glass_clear', 'glass_amber', 'hdpe', 'pet', 'aluminium', 'blister_pvc_pvdc', 'bottle_polymer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Main study table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stability_studies (
    id SERIAL PRIMARY KEY,

    -- Ownership
    project_id INTEGER NOT NULL REFERENCES projects(id),
    molecule_id INTEGER REFERENCES molecules(id),
    created_by INTEGER NOT NULL REFERENCES users(id),

    -- Study identification
    study_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Substance
    substance_name VARCHAR(300) NOT NULL,
    cas_number VARCHAR(20),
    batch_number VARCHAR(100),
    initial_concentration FLOAT NOT NULL,
    concentration_unit VARCHAR(30) DEFAULT 'mg/mL',
    initial_purity FLOAT DEFAULT 100.0,

    -- Storage conditions
    study_type study_type NOT NULL,
    climate_zone climate_zone,
    temperature_c FLOAT NOT NULL,
    temperature_tolerance FLOAT DEFAULT 2.0,
    humidity_percent FLOAT,
    humidity_tolerance FLOAT DEFAULT 5.0,
    light_condition VARCHAR(100),
    container_type container_type,
    headspace_gas VARCHAR(50) DEFAULT 'air',

    -- Duration
    planned_duration_months INTEGER NOT NULL,
    study_start_date TIMESTAMPTZ,
    study_end_date TIMESTAMPTZ,

    -- Kinetic model
    degradation_order degradation_order DEFAULT 'first',
    activation_energy FLOAT,
    pre_exponential_factor FLOAT,
    rate_constant_at_storage FLOAT,

    -- Thresholds
    spec_lower FLOAT DEFAULT 90.0,
    spec_upper FLOAT DEFAULT 110.0,
    degradation_threshold FLOAT DEFAULT 5.0,

    -- Simulation results
    predicted_shelf_life_days FLOAT,
    predicted_shelf_life_months FLOAT,
    predicted_t90_days FLOAT,
    predicted_t95_days FLOAT,
    simulation_confidence FLOAT,
    simulation_data JSONB,

    -- Statistical evaluation (ICH Q1E)
    regression_slope FLOAT,
    regression_intercept FLOAT,
    regression_r_squared FLOAT,
    regression_p_value FLOAT,
    confidence_interval_lower FLOAT,
    confidence_interval_upper FLOAT,
    statistical_data JSONB,

    -- Regulatory
    ich_reference VARCHAR(200),
    zone_description VARCHAR(500),

    -- Status & approval
    status study_status DEFAULT 'draft',
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Electronic signature (21 CFR Part 11)
    signature_hash VARCHAR(64),
    signature_meaning VARCHAR(200),
    signature_timestamp TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_project ON stability_studies(project_id);
CREATE INDEX IF NOT EXISTS idx_study_molecule ON stability_studies(molecule_id);
CREATE INDEX IF NOT EXISTS idx_study_status ON stability_studies(status);
CREATE INDEX IF NOT EXISTS idx_study_type_zone ON stability_studies(study_type, climate_zone);
CREATE INDEX IF NOT EXISTS idx_study_code ON stability_studies(study_code);

-- ── Time points ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stability_time_points (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES stability_studies(id) ON DELETE CASCADE,

    -- Time
    time_days FLOAT NOT NULL,
    time_months FLOAT,
    planned_date TIMESTAMPTZ,
    actual_date TIMESTAMPTZ,

    -- Measurements
    assay_percent FLOAT,
    impurity_total FLOAT,
    impurity_largest FLOAT,
    dissolution_percent FLOAT,
    moisture_content FLOAT,
    ph_value FLOAT,
    color_clarity VARCHAR(100),
    appearance VARCHAR(200),
    weight_change FLOAT,

    -- Physical
    melting_point_measured FLOAT,
    particle_size_d50 FLOAT,
    hardness FLOAT,
    friability FLOAT,

    -- Custom
    custom_params JSONB,

    -- Quality flags
    is_oos BOOLEAN DEFAULT FALSE,
    is_oot BOOLEAN DEFAULT FALSE,
    oos_investigation TEXT,

    -- Notes
    analyst VARCHAR(200),
    method_reference VARCHAR(300),
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_study ON stability_time_points(study_id);
CREATE INDEX IF NOT EXISTS idx_tp_time ON stability_time_points(study_id, time_days);

-- ── Degradation results ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS degradation_results (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES stability_studies(id) ON DELETE CASCADE,

    product_name VARCHAR(300),
    product_smiles TEXT,
    product_cas VARCHAR(20),
    degradation_pathway VARCHAR(100),

    formation_rate FLOAT,
    max_observed FLOAT,
    threshold FLOAT,
    is_above_threshold BOOLEAN DEFAULT FALSE,

    identification_method VARCHAR(200),
    retention_time FLOAT,
    mass_spec_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deg_study ON degradation_results(study_id);

-- ── Simulation runs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS simulation_runs (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES stability_studies(id) ON DELETE CASCADE,

    scenario_name VARCHAR(200),
    simulation_type VARCHAR(50),
    input_params JSONB,

    time_series JSONB,
    shelf_life_days FLOAT,
    shelf_life_months FLOAT,
    t90_days FLOAT,
    t95_days FLOAT,
    t99_days FLOAT,

    confidence_level FLOAT DEFAULT 0.95,
    ci_lower_days FLOAT,
    ci_upper_days FLOAT,
    rmse FLOAT,

    accelerated_study_id INTEGER REFERENCES stability_studies(id),
    extrapolation_method VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_study ON simulation_runs(study_id);

-- ── Auto-update trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_stability_study_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_study_updated ON stability_studies;
CREATE TRIGGER trg_study_updated
    BEFORE UPDATE ON stability_studies
    FOR EACH ROW
    EXECUTE FUNCTION update_stability_study_timestamp();

-- ── Done ──────────────────────────────────────────────────────────────

COMMENT ON TABLE stability_studies IS 'ChemStab v5.3 — ICH Q1A-Q1F stability studies with simulation';
COMMENT ON TABLE stability_time_points IS 'ChemStab v5.3 — Measured time points within a stability study';
COMMENT ON TABLE degradation_results IS 'ChemStab v5.3 — Identified degradation products and kinetics';
COMMENT ON TABLE simulation_runs IS 'ChemStab v5.3 — Simulation run records for reproducibility';
