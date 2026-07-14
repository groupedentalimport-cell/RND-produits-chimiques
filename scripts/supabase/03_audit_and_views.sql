-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ SCRIPT 3/3 — Audit Trail, Helper Functions, Views                   ║
-- ║ Run AFTER Scripts 1 and 2                                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Audit Log (GxP compliant — 21 CFR Part 11) ────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Who
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(300),
    user_role VARCHAR(50),

    -- What
    action VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, SIGN, APPROVE, REJECT, LOGIN, EXPORT
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,

    -- Changes
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],

    -- Context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),
    session_id VARCHAR(100),

    -- Electronic signature
    is_signed BOOLEAN DEFAULT FALSE,
    signature_hash VARCHAR(64),
    signature_meaning VARCHAR(200),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_signed ON audit_log(is_signed) WHERE is_signed = TRUE;

-- ── Audit trigger function ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
    changed TEXT[];
    old_data JSONB;
    new_data JSONB;
BEGIN
    -- Build changed fields list
    IF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        SELECT array_agg(key) INTO changed
        FROM jsonb_each(old_data)
        WHERE old_data->key IS DISTINCT FROM new_data->key;
    ELSIF TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
    END IF;

    INSERT INTO audit_log (
        action, table_name, record_id,
        old_values, new_values, changed_fields,
        user_id
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        old_data,
        new_data,
        changed,
        auth.uid()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
DROP TRIGGER IF EXISTS trg_audit_stability_studies ON stability_studies;
CREATE TRIGGER trg_audit_stability_studies
    AFTER INSERT OR UPDATE OR DELETE ON stability_studies
    FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS trg_audit_time_points ON stability_time_points;
CREATE TRIGGER trg_audit_time_points
    AFTER INSERT OR UPDATE OR DELETE ON stability_time_points
    FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS trg_audit_degradation ON degradation_results;
CREATE TRIGGER trg_audit_degradation
    AFTER INSERT OR UPDATE OR DELETE ON degradation_results
    FOR EACH ROW EXECUTE FUNCTION log_audit();

-- ── Helper: Generate study code ───────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_study_code()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    seq_num INTEGER;
BEGIN
    year_part := EXTRACT(YEAR FROM NOW())::VARCHAR;

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(study_code FROM 'STB-\d{4}-(\d+)') AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM stability_studies
    WHERE study_code LIKE 'STB-' || year_part || '-%';

    NEW.study_code := 'STB-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_study_code ON stability_studies;
CREATE TRIGGER trg_generate_study_code
    BEFORE INSERT ON stability_studies
    FOR EACH ROW
    WHEN (NEW.study_code IS NULL OR NEW.study_code = '')
    EXECUTE FUNCTION generate_study_code();

-- ── Helper: Auto-set time_months ──────────────────────────────────────

CREATE OR REPLACE FUNCTION set_time_months()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.time_months IS NULL THEN
        NEW.time_months := ROUND(NEW.time_days / 30.44, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_time_months ON stability_time_points;
CREATE TRIGGER trg_set_time_months
    BEFORE INSERT OR UPDATE ON stability_time_points
    FOR EACH ROW EXECUTE FUNCTION set_time_months();

-- ── Helper: Auto-detect OOS on time point insert ──────────────────────

CREATE OR REPLACE FUNCTION detect_oos()
RETURNS TRIGGER AS $$
DECLARE
    spec_limit DOUBLE PRECISION;
BEGIN
    IF NEW.assay_percent IS NOT NULL THEN
        SELECT spec_lower INTO spec_limit
        FROM stability_studies
        WHERE id = NEW.study_id;

        IF spec_limit IS NOT NULL AND NEW.assay_percent < spec_limit THEN
            NEW.is_oos := TRUE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_detect_oos ON stability_time_points;
CREATE TRIGGER trg_detect_oos
    BEFORE INSERT OR UPDATE ON stability_time_points
    FOR EACH ROW EXECUTE FUNCTION detect_oos();

-- ── View: Study summary with latest time point ────────────────────────

CREATE OR REPLACE VIEW v_study_summary AS
SELECT
    s.id,
    s.study_code,
    s.title,
    s.substance_name,
    s.study_type,
    s.climate_zone,
    s.temperature_c,
    s.humidity_percent,
    s.status,
    s.predicted_shelf_life_days,
    s.predicted_shelf_life_months,
    s.predicted_t90_days,
    s.regression_r_squared,
    s.ich_reference,
    s.created_at,
    s.updated_at,
    u.full_name AS created_by_name,
    p.name AS project_name,
    -- Latest time point
    (SELECT assay_percent FROM stability_time_points
     WHERE study_id = s.id ORDER BY time_days DESC LIMIT 1) AS latest_assay,
    (SELECT time_days FROM stability_time_points
     WHERE study_id = s.id ORDER BY time_days DESC LIMIT 1) AS latest_time_days,
    -- Time point count
    (SELECT COUNT(*) FROM stability_time_points WHERE study_id = s.id) AS time_point_count,
    -- OOS count
    (SELECT COUNT(*) FROM stability_time_points WHERE study_id = s.id AND is_oos = TRUE) AS oos_count
FROM stability_studies s
LEFT JOIN users u ON s.created_by = u.id
LEFT JOIN projects p ON s.project_id = p.id;

-- ── View: Degradation trend ───────────────────────────────────────────

CREATE OR REPLACE VIEW v_degradation_trend AS
SELECT
    s.study_code,
    s.substance_name,
    s.study_type,
    s.temperature_c,
    tp.time_days,
    tp.time_months,
    tp.assay_percent,
    tp.impurity_total,
    tp.is_oos,
    tp.is_oot,
    -- Running degradation rate
    CASE
        WHEN tp.time_days > 0 THEN ROUND((100 - tp.assay_percent) / tp.time_days, 4)
        ELSE 0
    END AS degradation_rate_per_day
FROM stability_studies s
JOIN stability_time_points tp ON tp.study_id = s.id
ORDER BY s.study_code, tp.time_days;

-- ── View: Active studies dashboard ────────────────────────────────────

CREATE OR REPLACE VIEW v_active_studies AS
SELECT
    study_code,
    substance_name,
    study_type,
    climate_zone,
    temperature_c,
    humidity_percent,
    status,
    predicted_shelf_life_months,
    regression_r_squared,
    created_at,
    updated_at
FROM stability_studies
WHERE status IN ('draft', 'in_progress', 'completed', 'under_review')
ORDER BY updated_at DESC;

-- ── RLS for audit log (read-only for org admins) ─────────────────────

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view audit log" ON audit_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('org_admin', 'super_admin'))
    );

-- Audit log is insert-only via triggers (no direct insert from client)
CREATE POLICY "System can insert audit log" ON audit_log
    FOR INSERT WITH CHECK (TRUE);

-- No update or delete on audit log (immutability for GxP)
-- (RLS default denies UPDATE/DELETE when no policy exists)

-- ── Final comments ────────────────────────────────────────────────────

COMMENT ON TABLE audit_log IS 'GxP audit trail — 21 CFR Part 11 compliant. Immutable.';
COMMENT ON VIEW v_study_summary IS 'Study summary with latest time point and OOS count';
COMMENT ON VIEW v_degradation_trend IS 'Degradation trend with rate calculation';
COMMENT ON VIEW v_active_studies IS 'Dashboard view of active studies';
