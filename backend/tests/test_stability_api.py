"""
Tests for the Stability Study API endpoints.

Covers:
  - Simulation endpoint
  - ICH protocol endpoint
  - Extrapolation endpoint
  - Monte Carlo endpoint
  - Molecular risk endpoint
  - Conditions reference endpoint
  - Error handling

Run: cd backend && python -m pytest tests/test_stability_api.py -v
Requires: FastAPI test client (no DB needed for these tests)
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient


# ── Mock auth dependency ───────────────────────────────────────────────

class FakeUser:
    id = 1
    email = "test@chemstab.com"
    role = "analyst"
    is_active = True
    is_locked = False


def override_get_current_user():
    return FakeUser()


def override_require_permission(permission: str):
    def _dep():
        return FakeUser()
    return _dep


# ── Create test app ────────────────────────────────────────────────────

@pytest.fixture
def client():
    """Create a test client with mocked auth."""
    from app.main import app
    from app.core.security import get_current_user, require_permission

    # Override auth dependencies
    app.dependency_overrides[get_current_user] = override_get_current_user

    # Override require_permission to return a factory
    from functools import partial
    app.dependency_overrides[require_permission] = lambda perm: override_require_permission(perm)

    # Override DB dependency to avoid needing a real database
    from app.core.database import get_db

    def override_get_db():
        yield None

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    yield client

    app.dependency_overrides.clear()


# ═══════════════════════════════════════════════════════════════════════
# Simulation Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestSimulationEndpoint:

    def test_simulate_basic(self, client):
        """POST /api/v1/stability/simulate should return simulation results."""
        response = client.post("/api/v1/stability/simulate", json={
            "substance_name": "Aspirin",
            "initial_concentration": 100,
            "temperature_c": 25,
            "humidity_percent": 60,
            "activation_energy": 75000,
            "pre_exponential_factor": 1e10,
            "kinetic_order": 1,
            "duration_months": 36,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "simulation" in data
        assert data["simulation"]["substance_name"] == "Aspirin"
        assert len(data["simulation"]["time_points"]) > 0

    def test_simulate_with_custom_time_points(self, client):
        """Simulation with custom time points should respect them."""
        response = client.post("/api/v1/stability/simulate", json={
            "substance_name": "Test",
            "initial_concentration": 100,
            "temperature_c": 25,
            "activation_energy": 75000,
            "pre_exponential_factor": 1e10,
            "time_points_months": [0, 6, 12, 24, 36],
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data["simulation"]["time_points"]) == 5

    def test_simulate_missing_required_field(self, client):
        """Missing required fields should return 422."""
        response = client.post("/api/v1/stability/simulate", json={
            "substance_name": "Test",
            # Missing initial_concentration
        })
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# Protocol Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestProtocolEndpoint:

    def test_protocol_zone_ii(self, client):
        """POST /api/v1/stability/protocol should return multi-condition results."""
        response = client.post("/api/v1/stability/protocol", json={
            "substance_name": "Aspirin",
            "initial_concentration": 100,
            "activation_energy": 75000,
            "pre_exponential_factor": 1e10,
            "climate_zone": "II",
            "include_stress": False,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "accelerated" in data["conditions_simulated"]
        assert "intermediate" in data["conditions_simulated"]
        assert "long_term_II" in data["conditions_simulated"]

    def test_protocol_invalid_zone(self, client):
        """Invalid climate zone should return 400."""
        response = client.post("/api/v1/stability/protocol", json={
            "substance_name": "Test",
            "initial_concentration": 100,
            "activation_energy": 75000,
            "pre_exponential_factor": 1e10,
            "climate_zone": "INVALID",
        })
        assert response.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# Extrapolation Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestExtrapolationEndpoint:

    def test_extrapolate_basic(self, client):
        """POST /api/v1/stability/extrapolate should return extrapolated shelf life."""
        response = client.post("/api/v1/stability/extrapolate", json={
            "accelerated_rate_constant": 0.005,
            "accelerated_temperature_c": 40,
            "storage_temperature_c": 25,
            "activation_energy": 75000,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["extrapolation"]["extrapolated_shelf_life_days"] > 0


# ═══════════════════════════════════════════════════════════════════════
# Monte Carlo Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestMonteCarloEndpoint:

    def test_monte_carlo_basic(self, client):
        """POST /api/v1/stability/monte-carlo should return distribution."""
        response = client.post("/api/v1/stability/monte-carlo", json={
            "mean_activation_energy": 75000,
            "std_activation_energy": 7500,
            "mean_pre_exponential": 1e10,
            "std_pre_exponential": 1e9,
            "temperature_c": 25,
            "n_simulations": 500,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["monte_carlo"]["mean_shelf_life_days"] > 0


# ═══════════════════════════════════════════════════════════════════════
# Molecular Risk Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestMolecularRiskEndpoint:

    def test_risk_with_smiles(self, client):
        """POST /api/v1/stability/molecular-risk should assess SMILES."""
        response = client.post("/api/v1/stability/molecular-risk", json={
            "smiles": "CC(=O)Oc1ccccc1C(=O)O",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "overall_stability_score" in data["risk_assessment"]


# ═══════════════════════════════════════════════════════════════════════
# Conditions Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestConditionsEndpoint:

    def test_list_conditions(self, client):
        """GET /api/v1/stability/conditions should list all ICH conditions."""
        response = client.get("/api/v1/stability/conditions")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] > 0
        assert len(data["conditions"]) > 0

    def test_list_conditions_filter_zone(self, client):
        """Filtering by zone should return only matching conditions."""
        response = client.get("/api/v1/stability/conditions?zone=II")
        assert response.status_code == 200
        data = response.json()
        for cond in data["conditions"]:
            assert cond["zone"] == "II" or cond["zone"] is None

    def test_get_zone_conditions(self, client):
        """GET /api/v1/stability/conditions/II should return Zone II conditions."""
        response = client.get("/api/v1/stability/conditions/II")
        assert response.status_code == 200
        data = response.json()
        assert data["climate_zone"] == "II"

    def test_invalid_zone(self, client):
        """Invalid zone should return 400."""
        response = client.get("/api/v1/stability/conditions/INVALID")
        assert response.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# Ea Derivation Endpoint
# ═══════════════════════════════════════════════════════════════════════

class TestEaDerivation:

    def test_derive_ea(self, client):
        """POST /api/v1/stability/derive-ea should compute Ea from two temps."""
        response = client.post("/api/v1/stability/derive-ea", json={
            "k1": 0.001,
            "temperature1_c": 25,
            "k2": 0.005,
            "temperature2_c": 40,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["activation_energy_jmol"] > 0
        assert data["q10_at_t1"] > 1


# ═══════════════════════════════════════════════════════════════════════
# Health & Version
# ═══════════════════════════════════════════════════════════════════════

class TestHealthEndpoints:

    def test_health(self, client):
        """GET /health should return healthy."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_version(self, client):
        """GET /version should include stability_simulation feature."""
        response = client.get("/version")
        assert response.status_code == 200
        data = response.json()
        assert data["features"]["stability_simulation"] is True

    def test_root(self, client):
        """GET / should return app info with stability features."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        features = data["features"]
        stability_features = [f for f in features if "stability" in f.lower() or "ICH" in f]
        assert len(stability_features) > 0
