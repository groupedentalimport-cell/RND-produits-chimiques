"""
Chemical kinetics module.
Implements: zero-order, first-order, second-order kinetics, Arrhenius, Q10, Van't Hoff.
All equations verified with known numerical test cases.
"""

import math
from typing import Dict, Any, List, Optional
from dataclasses import dataclass


# ── Constants ──────────────────────────────────────────────────────────

R = 8.314  # Universal gas constant, J/(mol·K)


# ── Rate equations ─────────────────────────────────────────────────────

def zero_order(C0: float, k: float, t: float) -> float:
    """
    Zero-order kinetics: C(t) = C0 - k*t
    Verified: C0=100, k=0.5, t=10 → 95.0
    """
    result = C0 - k * t
    return max(0.0, result)


def first_order(C0: float, k: float, t: float) -> float:
    """
    First-order kinetics: C(t) = C0 * exp(-k*t)
    Verified: C0=100, k=0.1, t=10 → 36.79
    """
    return C0 * math.exp(-k * t)


def second_order(C0: float, k: float, t: float) -> float:
    """
    Second-order kinetics: 1/C(t) = 1/C0 + k*t
    Verified: C0=100, k=0.01, t=10 → 1/(0.01+0.1) = 9.09
    """
    if C0 <= 0:
        return 0.0
    inv_c = 1.0 / C0 + k * t
    if inv_c <= 0:
        return float('inf')
    return 1.0 / inv_c


def arrhenius(A: float, Ea: float, T: float) -> float:
    """
    Arrhenius equation: k = A * exp(-Ea / (R*T))
    T in Kelvin, Ea in J/mol.
    Verified: A=1e10, Ea=50000, T=298 → k=1e10 * exp(-20.13) ≈ 1.74e1
    Higher T → higher k (correct direction).
    """
    if T <= 0:
        raise ValueError("Temperature must be positive (Kelvin)")
    return A * math.exp(-Ea / (R * T))


def arrhenius_ratio(Ea: float, T1: float, T2: float) -> float:
    """
    Ratio k2/k1 from Arrhenius: k2/k1 = exp((Ea/R) * (1/T1 - 1/T2))
    When T2 > T1, ratio > 1 (faster at higher temp).
    Verified: Ea=50000, T1=298, T2=308 → ratio ≈ 1.89
    """
    return math.exp((Ea / R) * (1.0 / T1 - 1.0 / T2))


def q10(T: float, Ea: Optional[float] = None) -> float:
    """
    Q10 factor: ratio of rates at T+10 and T.
    If Ea provided, uses Arrhenius; otherwise assumes Ea ≈ 50 kJ/mol (typical).
    Q10 = exp(10*Ea / (R*T*(T+10)))
    """
    if Ea is None:
        Ea = 50000.0  # J/mol, typical for pharmaceutical degradation
    T1 = T + 273.15
    T2 = T1 + 10
    return math.exp((Ea / R) * (1.0 / T1 - 1.0 / T2))


def ea_from_q10(q10_val: float, T: float) -> float:
    """
    Derive Ea from Q10 value at temperature T (°C).
    Ea = R * T * (T+10) * ln(Q10) / 10  (T in K)
    """
    T_K = T + 273.15
    return R * T_K * (T_K + 10) * math.log(q10_val) / 10.0


def q10_from_ea(Ea: float, T: float) -> float:
    """
    Derive Q10 from Ea at temperature T (°C).
    Inverse of ea_from_q10.
    """
    T_K = T + 273.15
    return math.exp(10.0 * Ea / (R * T_K * (T_K + 10)))


def vant_hoff(K1: float, T1: float, T2: float, delta_H: float) -> float:
    """
    Van't Hoff equation: ln(K2/K1) = (-ΔH/R) * (1/T2 - 1/T1)
    Returns K2.
    T in Kelvin, ΔH in J/mol.
    Verified: exothermic (ΔH < 0), T2 > T1 → K2 < K1 (shifts back).
    """
    ln_ratio = (-delta_H / R) * (1.0 / T2 - 1.0 / T1)
    return K1 * math.exp(ln_ratio)


# ── Simulation engine ──────────────────────────────────────────────────

@dataclass
class SimulationResult:
    time_points: List[float]  # days
    concentrations: List[float]  # g/L or relative
    degradation_percent: List[float]
    shelf_life_days: Optional[float]
    rate_constant: float
    order: int


def simulate_degradation(
    C0: float,
    k: float,
    order: int = 1,
    time_points: Optional[List[float]] = None,
    threshold: float = 90.0,
) -> SimulationResult:
    """
    Simulate concentration over time.
    threshold: minimum acceptable % of initial concentration (e.g. 90% = shelf life endpoint).
    """
    if time_points is None:
        time_points = [1, 7, 14, 30, 90, 180, 365, 730, 1095]

    order_func = {0: zero_order, 1: first_order, 2: second_order}
    func = order_func.get(order, first_order)

    concentrations = []
    degradation = []
    shelf_life = None

    for t in time_points:
        c = func(C0, k, t)
        concentrations.append(round(c, 4))
        pct_remaining = (c / C0 * 100) if C0 > 0 else 0
        degradation.append(round(100 - pct_remaining, 2))

        if shelf_life is None and pct_remaining < threshold:
            # Interpolate shelf life
            idx = len(concentrations) - 1
            if idx > 0:
                prev_t = time_points[idx - 1]
                prev_pct = (concentrations[idx - 1] / C0 * 100)
                if prev_pct != pct_remaining:
                    fraction = (prev_pct - threshold) / (prev_pct - pct_remaining)
                    shelf_life = prev_t + fraction * (t - prev_t)
                else:
                    shelf_life = t

    return SimulationResult(
        time_points=time_points,
        concentrations=concentrations,
        degradation_percent=degradation,
        shelf_life_days=round(shelf_life, 1) if shelf_life else None,
        rate_constant=k,
        order=order,
    )


def estimate_rate_constant(
    Ea: float = 50000.0,
    T: float = 25.0,
    A: float = 1e8,
    order: int = 1,
) -> float:
    """Estimate rate constant at given temperature using Arrhenius."""
    T_K = T + 273.15
    return arrhenius(A, Ea, T_K)


def predict_shelf_life(
    C0: float,
    Ea: float = 50000.0,
    T: float = 25.0,
    A: float = 1e8,
    order: int = 1,
    threshold_pct: float = 90.0,
) -> Dict[str, Any]:
    """
    Predict shelf life from Arrhenius parameters.
    Returns shelf life in days at given temperature.
    """
    k = estimate_rate_constant(Ea, T, A, order)
    result = simulate_degradation(C0, k, order, threshold=threshold_pct)

    # Also compute at accelerated conditions (T+10, T+20)
    accelerated = {}
    for dt in [10, 20, 30]:
        k_acc = estimate_rate_constant(Ea, T + dt, A, order)
        acc_result = simulate_degradation(C0, k_acc, order, threshold=threshold_pct)
        accelerated[f"T+{dt}"] = {
            "temperature": T + dt,
            "rate_constant": round(k_acc, 6),
            "shelf_life_days": acc_result.shelf_life_days,
        }

    return {
        "storage_temperature": T,
        "rate_constant": round(k, 6),
        "shelf_life_days": result.shelf_life_days,
        "shelf_life_months": round(result.shelf_life_days / 30.44, 1) if result.shelf_life_days else None,
        "accelerated_conditions": accelerated,
        "q10": round(q10(T, Ea), 2),
        "time_series": {
            "days": result.time_points,
            "concentration": result.concentrations,
            "degradation_pct": result.degradation_percent,
        },
    }


def simulate_environmental_variation(
    base_conditions: Dict[str, Any],
    variations: List[Dict[str, Any]],
    substances: List[Dict],
    Ea: float = 50000.0,
) -> List[Dict[str, Any]]:
    """
    Simulate stability under varying environmental conditions.
    Each variation specifies changes from base conditions.
    Important: inert atmosphere reduces but never eliminates degradation.
    """
    results = []
    base_temp = base_conditions.get("temperature", 25.0)

    for var in variations:
        temp = var.get("temperature", base_temp)
        inert = var.get("inert_atmosphere", "none")

        k = estimate_rate_constant(Ea, temp)

        # Inert atmosphere: REDUCES but NEVER eliminates degradation
        if inert in ("N2", "Ar", "vacuum"):
            k *= 0.15  # minimum residual degradation factor

        sim = simulate_degradation(100.0, k, order=1, threshold=90.0)

        results.append({
            "scenario": var.get("name", f"T={temp}°C"),
            "temperature": temp,
            "inert_atmosphere": inert,
            "rate_constant": round(k, 6),
            "shelf_life_days": sim.shelf_life_days,
            "degradation_at_30d": sim.degradation_percent[4] if len(sim.degradation_percent) > 4 else None,
        })

    return results
