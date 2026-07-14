"""
Pytest configuration and shared fixtures for ChemStab Industrial.
"""

import pytest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture
def sample_molecule():
    """Standard test molecule: Aspirin (Acetylsalicylic acid)."""
    return {
        "name": "Acetylsalicylic Acid",
        "cas_number": "50-78-2",
        "smiles": "CC(=O)Oc1ccccc1C(=O)O",
        "molar_mass": 180.16,
        "formula": "C9H8O4",
        "logp": 1.2,
        "melting_point": 135.0,
    }


@pytest.fixture
def sample_stability_params():
    """Standard stability simulation parameters."""
    return {
        "substance_name": "Acetylsalicylic Acid",
        "initial_concentration": 100.0,
        "concentration_unit": "mg/mL",
        "temperature_c": 25.0,
        "humidity_percent": 60.0,
        "activation_energy": 75000.0,
        "pre_exponential_factor": 1e10,
        "kinetic_order": 1,
        "duration_months": 36,
        "spec_lower": 90.0,
    }


@pytest.fixture
def accelerated_params():
    """Accelerated stability parameters."""
    return {
        "substance_name": "Acetylsalicylic Acid",
        "initial_concentration": 100.0,
        "concentration_unit": "mg/mL",
        "temperature_c": 40.0,
        "humidity_percent": 75.0,
        "activation_energy": 75000.0,
        "pre_exponential_factor": 1e10,
        "kinetic_order": 1,
        "duration_months": 6,
        "spec_lower": 90.0,
    }


@pytest.fixture
def ich_conditions():
    """Expected ICH storage conditions for validation."""
    return {
        "long_term_I": {"temp": 21.0, "rh": 45.0},
        "long_term_II": {"temp": 25.0, "rh": 60.0},
        "long_term_III": {"temp": 30.0, "rh": 35.0},
        "long_term_IVa": {"temp": 30.0, "rh": 65.0},
        "long_term_IVb": {"temp": 30.0, "rh": 75.0},
        "accelerated": {"temp": 40.0, "rh": 75.0},
        "intermediate": {"temp": 30.0, "rh": 65.0},
    }
