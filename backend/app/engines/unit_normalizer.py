"""
Centralized unit normalization for all scientific calculations.
All concentrations are normalized to g/L as internal unit.
All temperatures to °C. All pressures to hPa.
"""

from typing import Optional


def normalize_concentration(value: float, unit: str, molar_mass: Optional[float] = None) -> float:
    """
    Convert any concentration to g/L (internal unit).

    Args:
        value: numerical concentration value
        unit: one of 'mg/L', 'g/L', '%', 'mol/L', 'ppm', 'g/mL'
        molar_mass: molar mass in g/mol (required for mol/L conversion)

    Returns:
        concentration in g/L
    """
    unit_lower = unit.lower().strip()

    conversions = {
        "mg/l": lambda v: v / 1000.0,
        "g/l": lambda v: v,
        "g/100ml": lambda v: v * 10.0,
        "%": lambda v: v * 10.0,  # w/v % = g/100mL → g/L
        "mol/l": lambda v: v * molar_mass if molar_mass else v,
        "m": lambda v: v * molar_mass if molar_mass else v,
        "ppm": lambda v: v / 1000.0,  # ppm ≈ mg/L for dilute aqueous
        "g/ml": lambda v: v * 1000.0,
    }

    converter = conversions.get(unit_lower)
    if converter is None:
        raise ValueError(f"Unknown concentration unit: '{unit}'. Supported: {list(conversions.keys())}")

    return converter(value)


def normalize_temperature(value: float, unit: str = "C") -> float:
    """Convert temperature to °C."""
    u = unit.upper().strip()
    if u in ("C", "°C", "CELSIUS"):
        return value
    elif u in ("F", "°F", "FAHRENHEIT"):
        return (value - 32.0) * 5.0 / 9.0
    elif u in ("K", "KELVIN"):
        return value - 273.15
    raise ValueError(f"Unknown temperature unit: '{unit}'")


def normalize_pressure(value: float, unit: str = "hPa") -> float:
    """Convert pressure to hPa."""
    u = unit.lower().strip()
    conversions = {
        "hpa": 1.0,
        "mbar": 1.0,
        "bar": 1000.0,
        "atm": 1013.25,
        "mmhg": 1.33322,
        "torr": 1.33322,
        "kpa": 10.0,
        "psi": 68.9476,
    }
    factor = conversions.get(u)
    if factor is None:
        raise ValueError(f"Unknown pressure unit: '{unit}'")
    return value * factor


def concentration_to_mol_per_l(g_per_l: float, molar_mass: float) -> float:
    """Convert g/L to mol/L."""
    if molar_mass <= 0:
        raise ValueError("Molar mass must be positive")
    return g_per_l / molar_mass
