-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ SCRIPT 2/3 — Stability Study Module (ICH Q1A-Q1F)                  ║
-- ║ Run AFTER Script 1                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Enum types ────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE study_type AS ENUM (
    'long_term', 'accelerated', 'intermediate', 'stress', 'photostability', 'zone_custom'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE study_status AS ENUM (
    'draft', 'in_progress', 'completed', 'under_review', 'approved', 'rejected'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE degradation_order AS ENUM (
    'zero', 'first', 'second'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE climate_zone AS ENUM (
    'I', 'II', 'III', 'IVa', 'IVb'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE container_type AS ENUM (
    'glass_clear', 'glass_amber', 'hdpe', 'pet', 'aluminium', 'blister_pvc_pvdc', 'bottle_polymer'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Stability Studies (main table) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS stability_studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Ownership
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    molecule_id UUID REFERENCES molecules(id),
    created_by UUID NOT NULL REFERENCES users(id),

    -- Study identification
    study_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Substance
    substance_name VARCHAR(300) NOT NULL,
    cas_number VARCHAR(20),
    batch_number VARCHAR(100),
    initial_concentration DOUBLE PRECISION NOT NULL,
    concentration_unit VARCHAR(30) DEFAULT 'mg/mL',
    initial_purity DOUBLE PRECISION DEFAULT 100,

    -- Storage conditions
    study_type study_type NOT NULL,
    climate_zone climate_zone,
    temperature_c DOUBLE PRECISION NOT NULL,
    temperature_tolerance DOUBLE PRECISION DEFAULT 2.0,
    humidity_percent DOUBLE PRECISION,
    humidity_tolerance DOUBLE PRECISION DEFAULT 5.0,
    light_condition VARCHAR(100),
    container_type container_type,
    headspace_gas VARCHAR(50) DEFAULT 'air',

    -- Duration
    planned_duration_months INTEGER NOT NULL,
    study_start_date TIMESTAMPTZ,
    study_end_date TIMESTAMPTZ,

    -- Kinetic model
    degradation_order degradation_order DEFAULT 'first',
    activation_energy DOUBLE PRECISION,
    pre_exponential_factor DOUBLE PRECISION,
    rate_constant_at_storage DOUBLE PRECISION,

    -- Thresholds
    spec_lower DOUBLE PRECISION DEFAULT 90,
    spec_upper DOUBLE PRECISION DEFAULT 110,
    degradation_threshold DOUBLE PRECISION DEFAULT 5,

    -- Simulation results
    predicted_shelf_life_days DOUBLE PRECISION,
    predicted_shelf_life_months DOUBLE PRECISION,
    predicted_t90_days DOUBLE PRECISION,
    predicted_t95_days DOUBLE PRECISION,
    simulation_confidence DOUBLE PRECISION,
    simulation_data JSONB,

    -- Statistical evaluation (ICH Q1E)
    regression_slope DOUBLE PRECISION,
    regression_intercept DOUBLE PRECISION,
    regression_r_squared DOUBLE PRECISION,
    regression_p_value DOUBLE PRECISION,
    confidence_interval_lower DOUBLE PRECISION,
    confidence_interval_upper DOUBLE PRECISION,
    statistical_data JSONB,

    -- Regulatory
    ich_reference VARCHAR(200),
    zone_description VARCHAR(500),

    -- Status & approval
    status study_status DEFAULT 'draft',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
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

-- ── Time Points ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stability_time_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES stability_studies(id) ON DELETE CASCADE,

    -- Time
    time_days DOUBLE PRECISION NOT NULL,
    time_months DOUBLE PRECISION,
    planned_date TIMESTAMPTZ,
    actual_date TIMESTAMPTZ,

    -- Measurements
    assay_percent DOUBLE PRECISION,
    impurity_total DOUBLE PRECISION,
    impurity_largest DOUBLE PRECISION,
    dissolution_percent DOUBLE PRECISION,
    moisture_content DOUBLE PRECISION,
    ph_value DOUBLE PRECISION,
    color_clarity VARCHAR(100),
    appearance VARCHAR(200),
    weight_change DOUBLE PRECISION,

    -- Physical
    melting_point_measured DOUBLE PRECISION,
    particle_size_d50 DOUBLE PRECISION,
    hardness DOUBLE PRECISION,
    friability DOUBLE PRECISION,

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

-- ── Degradation Results ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS degradation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES stability_studies(id) ON DELETE CASCADE,

    product_name VARCHAR(300),
    product_smiles TEXT,
    product_cas VARCHAR(20),
    degradation_pathway VARCHAR(100),

    formation_rate DOUBLE PRECISION,
    max_observed DOUBLE PRECISION,
    threshold DOUBLE PRECISION,
    is_above_threshold BOOLEAN DEFAULT FALSE,

    identification_method VARCHAR(200),
    retention_time DOUBLE PRECISION,
    mass_spec_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Simulation Runs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS simulation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES stability_studies(id) ON DELETE CASCADE,

    scenario_name VARCHAR(200),
    simulation_type VARCHAR(50),
    input_params JSONB,

    time_series JSONB,
    shelf_life_days DOUBLE PRECISION,
    shelf_life_months DOUBLE PRECISION,
    t90_days DOUBLE PRECISION,
    t95_days DOUBLE PRECISION,
    t99_days DOUBLE PRECISION,

    confidence_level DOUBLE PRECISION DEFAULT 0.95,
    ci_lower_days DOUBLE PRECISION,
    ci_upper_days DOUBLE PRECISION,
    rmse DOUBLE PRECISION,

    accelerated_study_id UUID REFERENCES stability_studies(id),
    extrapolation_method VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_study_project ON stability_studies(project_id);
CREATE INDEX IF NOT EXISTS idx_study_molecule ON stability_studies(molecule_id);
CREATE INDEX IF NOT EXISTS idx_study_status ON stability_studies(status);
CREATE INDEX IF NOT EXISTS idx_study_type_zone ON stability_studies(study_type, climate_zone);
CREATE INDEX IF NOT EXISTS idx_study_code ON stability_studies(study_code);
CREATE INDEX IF NOT EXISTS idx_study_created_by ON stability_studies(created_by);

CREATE INDEX IF NOT EXISTS idx_tp_study ON stability_time_points(study_id);
CREATE INDEX IF NOT EXISTS idx_tp_time ON stability_time_points(study_id, time_days);
CREATE INDEX IF NOT EXISTS idx_tp_oos ON stability_time_points(study_id) WHERE is_oos = TRUE;

CREATE INDEX IF NOT EXISTS idx_deg_study ON degradation_results(study_id);
CREATE INDEX IF NOT EXISTS idx_deg_pathway ON degradation_results(study_id, degradation_pathway);

CREATE INDEX IF NOT EXISTS idx_sim_study ON simulation_runs(study_id);

-- ── Auto-update trigger ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_study_updated ON stability_studies;
CREATE TRIGGER trg_study_updated BEFORE UPDATE ON stability_studies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS (Row Level Security) ──────────────────────────────────────────

ALTER TABLE stability_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE stability_time_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE degradation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;

-- Org members can view studies of their projects
CREATE POLICY "Org members can view stability studies" ON stability_studies
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE organization_id IN (
                SELECT organization_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- Analysts+ can create studies
CREATE POLICY "Analysts can create stability studies" ON stability_studies
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
                AND role IN ('analyst', 'project_manager', 'org_admin', 'super_admin'))
        AND created_by = auth.uid()
    );

-- Study creator can update their own studies
CREATE POLICY "Creator can update own studies" ON stability_studies
    FOR UPDATE USING (created_by = auth.uid());

-- Org admins can update any study in their org
CREATE POLICY "Org admins can update org studies" ON stability_studies
    FOR UPDATE USING (
        project_id IN (
            SELECT id FROM projects WHERE organization_id IN (
                SELECT organization_id FROM users WHERE id = auth.uid() AND role IN ('org_admin', 'super_admin')
            )
        )
    );

-- Time points: same access as parent study
CREATE POLICY "Access time points via study" ON stability_time_points
    FOR SELECT USING (
        study_id IN (SELECT id FROM stability_studies)
    );

CREATE POLICY "Insert time points for own studies" ON stability_time_points
    FOR INSERT WITH CHECK (
        study_id IN (SELECT id FROM stability_studies WHERE created_by = auth.uid())
    );

-- Degradation results: same pattern
CREATE POLICY "Access degradation via study" ON degradation_results
    FOR SELECT USING (
        study_id IN (SELECT id FROM stability_studies)
    );

CREATE POLICY "Insert degradation for own studies" ON degradation_results
    FOR INSERT WITH CHECK (
        study_id IN (SELECT id FROM stability_studies WHERE created_by = auth.uid())
    );

-- Simulation runs: same pattern
CREATE POLICY "Access simulation runs via study" ON simulation_runs
    FOR SELECT USING (
        study_id IN (SELECT id FROM stability_studies)
    );

CREATE POLICY "Insert simulation runs for own studies" ON simulation_runs
    FOR INSERT WITH CHECK (
        study_id IN (SELECT id FROM stability_studies WHERE created_by = auth.uid())
    );

-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE stability_studies IS 'ChemStab v5.3 — ICH Q1A-Q1F stability studies with time-dependent simulation';
COMMENT ON TABLE stability_time_points IS 'Measured time points within a stability study (assay, impurities, physical tests)';
COMMENT ON TABLE degradation_results IS 'Identified degradation products and their formation kinetics';
COMMENT ON TABLE simulation_runs IS 'Simulation run records for reproducibility and what-if analysis';
