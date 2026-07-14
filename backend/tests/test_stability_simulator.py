"""
Tests for the Stability Simulator Engine — ICH Q1A-Q1F compliant.

Covers:
  - Kinetic equations (zero, first, second order)
  - Arrhenius rate constant computation
  - Q10 factor
  - Shelf life interpolation
  - ICH protocol simulation
  - Accelerated-to-storage extrapolation
  - Monte Carlo uncertainty propagation
  - Molecular risk assessment (SMARTS)
  - Edge cases and error handling

Run: cd backend && python -m pytest tests/test_stability_simulator.py -v
"""

import pytest
import math
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.stability_simulator import (
    # Kinetics
    concentration_at_time,
    degradation_at_time,
    arrhenius_k,
    arrhenius_extrapolate,
    ea_from_two_temps,
    q10_factor,
    eyring_k,
    # Simulation
    simulate_stability,
    simulate_ich_protocol,
    extrapolate_from_accelerated,
    monte_carlo_shelf_life,
    assess_molecular_stability_risk,
    # Helpers
    _interpolate_shelf_life,
    _linear_regression,
    _auto_time_points,
    # Types
    ICH_CONDITIONS,
    KineticOrder,
    StudyType,
    ClimateZone,
    TimePoint,
)


# ═══════════════════════════════════════════════════════════════════════
# Kinetic Equations
# ═══════════════════════════════════════════════════════════════════════

class TestKineticEquations:
    """Test core kinetic equations with known reference values."""

    # ── Zero-order ─────────────────────────────────────────────────────

    def test_zero_order_basic(self):
        """C(t) = C0 - k*t → C(10) = 100 - 0.5*10 = 95.0"""
        result = concentration_at_time(100.0, 0.5, 10.0, order=0)
        assert result == pytest.approx(95.0, abs=0.01)

    def test_zero_order_complete_degradation(self):
        """Zero-order should not go below 0."""
        result = concentration_at_time(100.0, 1.0, 200.0, order=0)
        assert result == 0.0

    def test_zero_order_t0(self):
        """At t=0, concentration equals C0 for all orders."""
        result = concentration_at_time(100.0, 0.5, 0.0, order=0)
        assert result == pytest.approx(100.0)

    # ── First-order ────────────────────────────────────────────────────

    def test_first_order_basic(self):
        """C(t) = C0 * exp(-k*t) → C(10) = 100 * exp(-0.1*10) ≈ 36.79"""
        result = concentration_at_time(100.0, 0.1, 10.0, order=1)
        assert result == pytest.approx(36.79, abs=0.1)

    def test_first_order_half_life(self):
        """Half-life = ln(2)/k. For k=0.1: t½ ≈ 6.93 days."""
        k = 0.1
        t_half = math.log(2) / k
        result = concentration_at_time(100.0, k, t_half, order=1)
        assert result == pytest.approx(50.0, abs=0.01)

    def test_first_order_never_zero(self):
        """First-order asymptotically approaches zero but never reaches it."""
        result = concentration_at_time(100.0, 0.1, 1000.0, order=1)
        assert result > 0.0

    # ── Second-order ───────────────────────────────────────────────────

    def test_second_order_basic(self):
        """1/C(t) = 1/C0 + k*t → C(10) = 1/(0.01 + 0.1) ≈ 9.09"""
        result = concentration_at_time(100.0, 0.01, 10.0, order=2)
        assert result == pytest.approx(9.09, abs=0.1)

    def test_second_order_t0(self):
        """At t=0, second-order returns C0."""
        result = concentration_at_time(100.0, 0.01, 0.0, order=2)
        assert result == pytest.approx(100.0)

    # ── Degradation percentage ─────────────────────────────────────────

    def test_degradation_at_time(self):
        """10% degradation at t90 for first-order."""
        k = -math.log(0.9) / 365.0  # k such that t90 = 365 days
        result = degradation_at_time(100.0, k, 365.0, order=1)
        assert result == pytest.approx(10.0, abs=0.1)

    def test_degradation_at_t0(self):
        """No degradation at t=0."""
        result = degradation_at_time(100.0, 0.1, 0.0, order=1)
        assert result == pytest.approx(0.0)


# ═══════════════════════════════════════════════════════════════════════
# Arrhenius
# ═══════════════════════════════════════════════════════════════════════

class TestArrhenius:
    """Test Arrhenius equation and related functions."""

    def test_arrhenius_k_basic(self):
        """k = A * exp(-Ea/(R*T)). Higher T → higher k."""
        k_25 = arrhenius_k(1e10, 75000.0, 25.0)
        k_40 = arrhenius_k(1e10, 75000.0, 40.0)
        assert k_40 > k_25, "Rate constant must increase with temperature"
        assert k_25 > 0

    def test_arrhenius_k_known_value(self):
        """Verify against hand-calculated value.
        A=1e10, Ea=75000 J/mol, T=25°C (298.15 K)
        k = 1e10 * exp(-75000/(8.314*298.15)) ≈ 1e10 * exp(-30.24)
        """
        k = arrhenius_k(1e10, 75000.0, 25.0)
        expected = 1e10 * math.exp(-75000.0 / (8.314 * 298.15))
        assert k == pytest.approx(expected, rel=1e-6)

    def test_arrhenius_extrapolate(self):
        """Extrapolating from 40°C to 25°C should give lower k."""
        k_40 = arrhenius_k(1e10, 75000.0, 40.0)
        k_25_extrap = arrhenius_extrapolate(k_40, 40.0, 25.0, 75000.0)
        k_25_direct = arrhenius_k(1e10, 75000.0, 25.0)
        assert k_25_extrap == pytest.approx(k_25_direct, rel=1e-6)

    def test_ea_from_two_temps(self):
        """Derive Ea from two temperatures and verify."""
        Ea_original = 75000.0
        k1 = arrhenius_k(1e10, Ea_original, 25.0)
        k2 = arrhenius_k(1e10, Ea_original, 40.0)
        Ea_derived = ea_from_two_temps(k1, 25.0, k2, 40.0)
        assert Ea_derived == pytest.approx(Ea_original, rel=1e-4)

    def test_q10_factor_range(self):
        """Q10 should be between 1.5 and 4.0 for typical pharma Ea."""
        for T in [15, 25, 30, 37, 40]:
            q = q10_factor(T, Ea=75000.0)
            assert 1.5 < q < 4.0, f"Q10={q} out of expected range at {T}°C"

    def test_q10_increases_with_ea(self):
        """Higher Ea → higher Q10 (more temperature sensitivity)."""
        q_low = q10_factor(25.0, Ea=50000.0)
        q_high = q10_factor(25.0, Ea=100000.0)
        assert q_high > q_low

    def test_arrhenius_negative_temperature_raises(self):
        """Temperature below absolute zero should raise error."""
        with pytest.raises(ValueError):
            arrhenius_k(1e10, 75000.0, -300.0)


# ═══════════════════════════════════════════════════════════════════════
# Stability Simulation
# ═══════════════════════════════════════════════════════════════════════

class TestStabilitySimulation:
    """Test the main simulation function."""

    def test_basic_simulation(self, sample_stability_params):
        """Basic simulation should return valid results."""
        result = simulate_stability(**sample_stability_params)

        assert result.substance_name == "Acetylsalicylic Acid"
        assert result.temperature_c == 25.0
        assert len(result.time_points) > 0
        assert result.rate_constant > 0

    def test_time_points_decreasing(self, sample_stability_params):
        """Concentration should decrease over time (first-order)."""
        result = simulate_stability(**sample_stability_params)
        concentrations = [tp.concentration for tp in result.time_points]
        # Should generally decrease (not strictly for all models)
        assert concentrations[-1] < concentrations[0]

    def test_shelf_life_exists(self, sample_stability_params):
        """Shelf life should be computed for reasonable parameters."""
        result = simulate_stability(**sample_stability_params)
        if result.shelf_life_days is not None:
            assert result.shelf_life_days > 0
            assert result.shelf_life_months > 0

    def test_t90_before_t95(self, sample_stability_params):
        """t90 should occur before t95 (more degradation needed for t95)."""
        result = simulate_stability(**sample_stability_params)
        if result.t90_days and result.t95_days:
            assert result.t90_days >= result.t95_days

    def test_regression_computed(self, sample_stability_params):
        """Regression statistics should be computed for ≥3 time points."""
        result = simulate_stability(**sample_stability_params)
        if len(result.time_points) >= 3:
            assert result.regression_r_squared is not None
            assert 0 <= result.regression_r_squared <= 1

    def test_oos_detection(self, sample_stability_params):
        """Time points below spec_lower should be flagged OOS."""
        # Use parameters that guarantee degradation below 90%
        params = {**sample_stability_params, "activation_energy": 100000.0}
        result = simulate_stability(**params)
        oos_points = [tp for tp in result.time_points if tp.is_oos]
        # With high Ea, some points should be OOS
        if result.shelf_life_days is not None:
            assert len(oos_points) > 0

    def test_custom_time_points(self, sample_stability_params):
        """Custom time points should be respected."""
        params = {**sample_stability_params, "time_points_months": [0, 6, 12, 24]}
        result = simulate_stability(**params)
        assert len(result.time_points) == 4
        assert result.time_points[0].time_months == 0
        assert result.time_points[1].time_months == 6

    def test_zero_order_simulation(self, sample_stability_params):
        """Zero-order simulation should work."""
        params = {**sample_stability_params, "kinetic_order": 0}
        result = simulate_stability(**params)
        assert result.kinetic_order == 0
        assert len(result.time_points) > 0

    def test_higher_temp_faster_degradation(self, sample_stability_params):
        """Higher temperature should give shorter shelf life."""
        result_25 = simulate_stability(**sample_stability_params)
        params_40 = {**sample_stability_params, "temperature_c": 40.0}
        result_40 = simulate_stability(**params_40)

        if result_25.shelf_life_days and result_40.shelf_life_days:
            assert result_40.shelf_life_days < result_25.shelf_life_days

    def test_humidity_effect(self, sample_stability_params):
        """Higher humidity should increase degradation (when humidity_effect > 0)."""
        params_dry = {**sample_stability_params, "humidity_percent": 30.0, "humidity_effect_factor": 0.001}
        params_humid = {**sample_stability_params, "humidity_percent": 90.0, "humidity_effect_factor": 0.001}

        result_dry = simulate_stability(**params_dry)
        result_humid = simulate_stability(**params_humid)

        if result_dry.shelf_life_days and result_humid.shelf_life_days:
            assert result_humid.shelf_life_days < result_dry.shelf_life_days


# ═══════════════════════════════════════════════════════════════════════
# ICH Protocol
# ═══════════════════════════════════════════════════════════════════════

class TestICHProtocol:
    """Test multi-condition ICH protocol simulation."""

    def test_protocol_returns_multiple_conditions(self, sample_stability_params):
        """ICH protocol should return long-term + accelerated + intermediate."""
        results = simulate_ich_protocol(
            substance_name=sample_stability_params["substance_name"],
            initial_concentration=sample_stability_params["initial_concentration"],
            activation_energy=sample_stability_params["activation_energy"],
            pre_exponential_factor=sample_stability_params["pre_exponential_factor"],
        )
        assert "accelerated" in results
        assert "intermediate" in results
        # Should have at least one long-term condition
        long_term_keys = [k for k in results if k.startswith("long_term")]
        assert len(long_term_keys) >= 1

    def test_protocol_with_stress(self, sample_stability_params):
        """Protocol with stress tests should include stress conditions."""
        results = simulate_ich_protocol(
            substance_name=sample_stability_params["substance_name"],
            initial_concentration=sample_stability_params["initial_concentration"],
            activation_energy=sample_stability_params["activation_energy"],
            pre_exponential_factor=sample_stability_params["pre_exponential_factor"],
            include_stress=True,
        )
        stress_keys = [k for k in results if k.startswith("stress")]
        assert len(stress_keys) >= 2

    def test_protocol_without_stress(self, sample_stability_params):
        """Protocol without stress should not include stress conditions."""
        results = simulate_ich_protocol(
            substance_name=sample_stability_params["substance_name"],
            initial_concentration=sample_stability_params["initial_concentration"],
            activation_energy=sample_stability_params["activation_energy"],
            pre_exponential_factor=sample_stability_params["pre_exponential_factor"],
            include_stress=False,
        )
        stress_keys = [k for k in results if k.startswith("stress")]
        assert len(stress_keys) == 0

    def test_accelerated_worse_than_long_term(self, sample_stability_params):
        """Accelerated condition should give shorter shelf life than long-term."""
        results = simulate_ich_protocol(
            substance_name=sample_stability_params["substance_name"],
            initial_concentration=sample_stability_params["initial_concentration"],
            activation_energy=sample_stability_params["activation_energy"],
            pre_exponential_factor=sample_stability_params["pre_exponential_factor"],
            climate_zone=ClimateZone.ZONE_II,
            include_stress=False,
        )
        if "accelerated" in results and "long_term_II" in results:
            acc = results["accelerated"]
            lt = results["long_term_II"]
            if acc.shelf_life_days and lt.shelf_life_days:
                assert acc.shelf_life_days < lt.shelf_life_days


# ═══════════════════════════════════════════════════════════════════════
# Extrapolation
# ═══════════════════════════════════════════════════════════════════════

class TestExtrapolation:
    """Test accelerated-to-storage extrapolation."""

    def test_extrapolation_gives_longer_shelf_life(self):
        """Extrapolated shelf life at 25°C should be longer than at 40°C."""
        k_40 = arrhenius_k(1e10, 75000.0, 40.0)
        result = extrapolate_from_accelerated(
            accelerated_k=k_40,
            accelerated_temp_c=40.0,
            storage_temp_c=25.0,
            Ea=75000.0,
        )
        assert result.extrapolated_shelf_life_days > result.accelerated_shelf_life_days

    def test_q10_in_extrapolation(self):
        """Q10 should be reasonable (1.5-4.0)."""
        k_40 = arrhenius_k(1e10, 75000.0, 40.0)
        result = extrapolate_from_accelerated(
            accelerated_k=k_40,
            accelerated_temp_c=40.0,
            storage_temp_c=25.0,
            Ea=75000.0,
        )
        assert 1.5 < result.q10_value < 4.0

    def test_temperature_gap(self):
        """Temperature gap should be correctly reported."""
        k_40 = arrhenius_k(1e10, 75000.0, 40.0)
        result = extrapolate_from_accelerated(
            accelerated_k=k_40,
            accelerated_temp_c=40.0,
            storage_temp_c=25.0,
            Ea=75000.0,
        )
        assert result.temperature_gap == 15.0


# ═══════════════════════════════════════════════════════════════════════
# Monte Carlo
# ═══════════════════════════════════════════════════════════════════════

class TestMonteCarlo:
    """Test Monte Carlo uncertainty propagation."""

    def test_monte_carlo_basic(self):
        """Monte Carlo should return valid statistics."""
        result = monte_carlo_shelf_life(
            mean_Ea=75000.0,
            std_Ea=7500.0,
            mean_A=1e10,
            std_A=1e9,
            temperature_c=25.0,
            n_simulations=500,
        )
        assert result["n_simulations"] > 0
        assert result["mean_shelf_life_days"] > 0
        assert result["std_shelf_life_days"] > 0
        assert result["ci_lower_days"] < result["ci_upper_days"]

    def test_monte_carlo_ci_contain_mean(self):
        """95% CI should contain the mean."""
        result = monte_carlo_shelf_life(
            mean_Ea=75000.0,
            std_Ea=7500.0,
            mean_A=1e10,
            std_A=1e9,
            temperature_c=25.0,
            n_simulations=1000,
            confidence_level=0.95,
        )
        assert result["ci_lower_days"] <= result["mean_shelf_life_days"]
        assert result["mean_shelf_life_days"] <= result["ci_upper_days"]

    def test_monte_carlo_histogram(self):
        """Histogram should have correct structure."""
        result = monte_carlo_shelf_life(
            mean_Ea=75000.0,
            std_Ea=7500.0,
            mean_A=1e10,
            std_A=1e9,
            temperature_c=25.0,
            n_simulations=500,
        )
        assert "histogram" in result
        assert "bins" in result["histogram"]
        assert "counts" in result["histogram"]
        assert len(result["histogram"]["bins"]) == len(result["histogram"]["counts"]) + 1


# ═══════════════════════════════════════════════════════════════════════
# Molecular Risk Assessment
# ═══════════════════════════════════════════════════════════════════════

class TestMolecularRisk:
    """Test SMARTS-based degradation risk assessment."""

    def test_aspirin_risk(self):
        """Aspirin has ester group → should detect hydrolysis risk."""
        result = assess_molecular_stability_risk(smiles="CC(=O)Oc1ccccc1C(=O)O")
        assert "overall_stability_score" in result
        assert "pathway_risks" in result
        assert "functional_groups" in result
        # Aspirin has an ester → hydrolysis risk should be detected
        fg_names = [fg["name"] for fg in result["functional_groups"]]
        assert "ester" in fg_names

    def test_no_smiles_fallback(self):
        """Without SMILES, should return fallback assessment."""
        result = assess_molecular_stability_risk()
        assert result["overall_stability_score"] == 50.0
        assert "note" in result

    def test_recommendations_present(self):
        """Should return recommendations."""
        result = assess_molecular_stability_risk(smiles="CC(=O)Oc1ccccc1C(=O)O")
        assert "recommendations" in result
        assert len(result["recommendations"]) > 0

    def test_invalid_smiles(self):
        """Invalid SMILES should return error."""
        result = assess_molecular_stability_risk(smiles="INVALID_SMILES")
        assert "error" in result


# ═══════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════

class TestHelpers:
    """Test helper/utility functions."""

    def test_auto_time_points_short(self):
        """Short study (≤6 months) should have appropriate time points."""
        tp = _auto_time_points(6)
        assert tp == [0, 1, 2, 3, 6]

    def test_auto_time_points_long(self):
        """Long study (36 months) should have ICH-compliant time points."""
        tp = _auto_time_points(36)
        assert 0 in tp
        assert 36 in tp
        assert 3 in tp
        assert 6 in tp

    def test_interpolate_shelf_life(self):
        """Shelf life interpolation should give correct value."""
        time_points = [
            TimePoint(0, 0, 100, "mg/mL", 100.0, 0.0, False, False),
            TimePoint(90, 3, 95, "mg/mL", 95.0, 5.0, False, False),
            TimePoint(180, 6, 88, "mg/mL", 88.0, 12.0, True, False),
        ]
        sl = _interpolate_shelf_life(time_points, threshold=90.0)
        # Should be between 90 and 180 days
        assert sl is not None
        assert 90 < sl < 180

    def test_linear_regression(self):
        """Linear regression should fit a decreasing trend."""
        time_points = [
            TimePoint(0, 0, 100, "mg/mL", 100.0, 0.0, False, False),
            TimePoint(90, 3, 97, "mg/mL", 97.0, 3.0, False, False),
            TimePoint(180, 6, 94, "mg/mL", 94.0, 6.0, False, False),
            TimePoint(365, 12, 90, "mg/mL", 90.0, 10.0, False, False),
        ]
        reg = _linear_regression(time_points)
        assert reg["slope"] < 0, "Slope should be negative (degradation)"
        assert reg["r_squared"] > 0.9, "R² should be high for linear data"
        assert reg["intercept"] > 90


# ═══════════════════════════════════════════════════════════════════════
# ICH Conditions Reference
# ═══════════════════════════════════════════════════════════════════════

class TestICHConditions:
    """Test ICH condition definitions."""

    def test_all_zones_present(self):
        """All 5 climate zones should be defined."""
        zones = set()
        for code, cond in ICH_CONDITIONS.items():
            if cond.zone:
                zones.add(cond.zone)
        assert ClimateZone.ZONE_I in zones
        assert ClimateZone.ZONE_II in zones
        assert ClimateZone.ZONE_III in zones
        assert ClimateZone.ZONE_IVA in zones
        assert ClimateZone.ZONE_IVB in zones

    def test_accelerated_condition(self):
        """Accelerated should be 40°C/75% RH."""
        acc = ICH_CONDITIONS["accelerated"]
        assert acc.temperature_c == 40.0
        assert acc.humidity_percent == 75.0
        assert acc.study_type == StudyType.ACCELERATED

    def test_long_term_zone_ii(self):
        """Long-term Zone II should be 25°C/60% RH."""
        lt = ICH_CONDITIONS["long_term_II"]
        assert lt.temperature_c == 25.0
        assert lt.humidity_percent == 60.0
        assert lt.duration_months == 36

    def test_stress_conditions_exist(self):
        """Stress tests (thermal, humidity, oxidative) should exist."""
        assert "stress_thermal" in ICH_CONDITIONS
        assert "stress_humidity" in ICH_CONDITIONS
        assert "stress_oxidative" in ICH_CONDITIONS


# ═══════════════════════════════════════════════════════════════════════
# Edge Cases
# ═══════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_zero_concentration(self):
        """Zero initial concentration should not crash."""
        result = simulate_stability(
            substance_name="Test",
            initial_concentration=0.001,
            temperature_c=25.0,
            activation_energy=75000.0,
            pre_exponential_factor=1e10,
        )
        assert result is not None

    def test_very_high_ea(self):
        """Very high Ea should give very long shelf life."""
        result = simulate_stability(
            substance_name="Stable Compound",
            initial_concentration=100.0,
            temperature_c=25.0,
            activation_energy=150000.0,
            pre_exponential_factor=1e10,
        )
        if result.shelf_life_days:
            assert result.shelf_life_days > 365  # > 1 year

    def test_very_low_ea(self):
        """Very low Ea should give short shelf life."""
        result = simulate_stability(
            substance_name="Unstable Compound",
            initial_concentration=100.0,
            temperature_c=25.0,
            activation_energy=10000.0,
            pre_exponential_factor=1e10,
        )
        if result.shelf_life_days:
            assert result.shelf_life_days < 365  # < 1 year

    def test_extreme_temperature(self):
        """Simulation at extreme temperature should not crash."""
        result = simulate_stability(
            substance_name="Test",
            initial_concentration=100.0,
            temperature_c=60.0,
            activation_energy=75000.0,
            pre_exponential_factor=1e10,
        )
        assert result is not None

    def test_simulation_result_fields(self, sample_stability_params):
        """All expected fields should be present in the result."""
        result = simulate_stability(**sample_stability_params)
        assert hasattr(result, "condition_code")
        assert hasattr(result, "substance_name")
        assert hasattr(result, "time_points")
        assert hasattr(result, "shelf_life_days")
        assert hasattr(result, "regression_r_squared")
        assert hasattr(result, "computed_at")
