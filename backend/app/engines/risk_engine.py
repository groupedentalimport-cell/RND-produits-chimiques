"""
Risk assessment engine.
Evaluates all chemical, physicochemical and environmental risks.
Each risk type MUST have a corresponding calculation function that can produce non-zero scores.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import math

from app.engines.unit_normalizer import normalize_concentration, normalize_temperature
from app.data.chemical_db import lookup_chemical


# ── Risk type definitions ──────────────────────────────────────────────

RISK_TYPES = {
    "chemical_incompatibility": {
        "icon": "⚗️",
        "name": "Chemical Incompatibility",
        "description": "Acid-base, redox, or other reactive incompatibilities between substances",
    },
    "precipitation": {
        "icon": "🧪",
        "name": "Precipitation Risk",
        "description": "Risk of solute precipitation due to concentration exceeding solubility limits",
    },
    "oxidation": {
        "icon": "🔬",
        "name": "Oxidation Risk",
        "description": "Risk of oxidative degradation, enhanced by O₂, light, metal ions",
    },
    "hydrolysis": {
        "icon": "💧",
        "name": "Hydrolysis Risk",
        "description": "Risk of hydrolytic degradation, enhanced by extreme pH and temperature",
    },
    "photodegradation": {
        "icon": "☀️",
        "name": "Photodegradation Risk",
        "description": "Risk of light/UV-induced degradation",
    },
    "polymerization": {
        "icon": "🔗",
        "name": "Polymerization Risk",
        "description": "Risk of unwanted polymerization reactions",
    },
    "complexation": {
        "icon": "🧬",
        "name": "Complexation Risk",
        "description": "Risk of metal-ligand complexation altering bioavailability",
    },
    "thermal_decomposition": {
        "icon": "🌡️",
        "name": "Thermal Decomposition",
        "description": "Risk of thermally-induced decomposition at storage temperature",
    },
    "maillard": {
        "icon": "🍬",
        "name": "Maillard Reaction",
        "description": "Browning reaction between reducing sugars and amino acids/amines",
    },
}


@dataclass
class RiskResult:
    risk_type: str
    score: float  # 0-100 (0 = critical risk, 100 = no risk)
    severity: str  # low, moderate, high, critical
    description: str
    factors: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


def _score_to_severity(score: float) -> str:
    if score <= 20:
        return "critical"
    elif score <= 40:
        return "high"
    elif score <= 60:
        return "moderate"
    else:
        return "low"


# ── Individual risk calculators ────────────────────────────────────────

def assess_chemical_incompatibility(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess chemical incompatibilities between substances in the mixture."""
    from app.data.chemical_db import INCOMPATIBILITY_RULES

    score = 100.0
    factors = []
    recommendations = []

    sub_dicts = []
    for s in substances:
        from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical
        db_entry = lookup_chemical(s.get("name", ""))
        merged = {**db_entry, **s}
        sub_dicts.append(merged)

    for rule in INCOMPATIBILITY_RULES:
        if rule["detect"](sub_dicts):
            penalty = rule["score_penalty"]
            score -= penalty
            factors.append({
                "rule": rule["type"],
                "description": rule["description"],
                "severity": rule["severity"],
                "penalty": penalty,
            })
            recommendations.append(f"⚠️ {rule['description']}")

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="chemical_incompatibility",
        score=score,
        severity=_score_to_severity(score),
        description="Assessment of reactive incompatibilities between mixture components",
        factors=factors,
        recommendations=recommendations,
    )


def assess_precipitation(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess precipitation risk based on concentration vs solubility."""
    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    score = 100.0
    factors = []
    recommendations = []

    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        solubility = db_entry.get("solubility")

        if solubility is None or solubility == "miscible":
            continue

        conc = s.get("concentration", 0)
        unit = s.get("concentration_unit", "g/L")
        molar_mass = s.get("molar_mass") or db_entry.get("molar_mass")

        try:
            conc_g_l = normalize_concentration(conc, unit, molar_mass)
        except (ValueError, TypeError):
            continue

        if isinstance(solubility, (int, float)) and solubility > 0:
            ratio = conc_g_l / solubility
            if ratio > 0.8:
                penalty = min(40, (ratio - 0.8) * 200)
                score -= penalty
                factors.append({
                    "substance": s.get("name"),
                    "concentration_g_l": round(conc_g_l, 3),
                    "solubility_g_l": solubility,
                    "saturation_ratio": round(ratio, 3),
                    "penalty": round(penalty, 1),
                })
                recommendations.append(f"Reduce {s['name']} concentration — saturation at {ratio*100:.0f}%")

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="precipitation",
        score=score,
        severity=_score_to_severity(score),
        description="Risk of solute crystallization or precipitation",
        factors=factors,
        recommendations=recommendations,
    )


def assess_oxidation(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess oxidation risk based on substance sensitivity, dissolved O₂, light, metal ions."""
    score = 100.0
    factors = []
    recommendations = []

    dissolved_o2 = conditions.get("dissolved_oxygen", 8.0)
    light = conditions.get("light_exposure", 0.0)
    uv = conditions.get("uv_exposure", 0.0)
    inert = conditions.get("inert_atmosphere", "none")

    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        sensitivity = db_entry.get("oxidation_sensitivity", 0)

        if sensitivity <= 0:
            continue

        # Base risk from dissolved oxygen
        o2_factor = dissolved_o2 / 8.0  # normalize to ambient
        if inert in ("N2", "Ar", "vacuum"):
            # Inert atmosphere REDUCES but never eliminates oxidation
            o2_factor *= 0.15  # residual O₂ + anaerobic pathways

        # Light enhancement
        light_factor = 1.0 + (light / 1000.0) * 0.3 + (uv / 1.0) * 0.5

        risk = sensitivity * o2_factor * light_factor
        penalty = risk * 30
        score -= penalty

        if penalty > 2:
            factors.append({
                "substance": s.get("name"),
                "oxidation_sensitivity": sensitivity,
                "o2_factor": round(o2_factor, 3),
                "light_factor": round(light_factor, 3),
                "penalty": round(penalty, 1),
            })

    if dissolved_o2 > 6 and any(
        (lookup_chemical(s.get("name", "")).get("oxidation_sensitivity", 0)) > 0.5
        for s in substances
    ):
        recommendations.append("Consider nitrogen overlay to reduce dissolved oxygen")
        recommendations.append("Add antioxidant (e.g., sodium metabisulfite, BHT)")

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="oxidation",
        score=score,
        severity=_score_to_severity(score),
        description="Risk of oxidative degradation",
        factors=factors,
        recommendations=recommendations,
    )


def assess_hydrolysis(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess hydrolysis risk based on pH, temperature, substance sensitivity."""
    score = 100.0
    factors = []
    recommendations = []

    ph = conditions.get("ph", 7.0)
    temp = conditions.get("temperature", 25.0)

    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        sensitivity = db_entry.get("hydrolysis_sensitivity", 0)

        if sensitivity <= 0:
            continue

        ph_opt = db_entry.get("ph_optimal", 7.0)
        ph_deviation = abs(ph - ph_opt)

        # Rate doubles roughly every 10°C (Q10 ≈ 2)
        temp_factor = 2.0 ** ((temp - 25.0) / 10.0)
        ph_factor = 1.0 + (ph_deviation / 5.0) ** 2

        risk = sensitivity * ph_factor * min(temp_factor, 10.0)
        penalty = risk * 20
        score -= penalty

        if penalty > 2:
            factors.append({
                "substance": s.get("name"),
                "hydrolysis_sensitivity": sensitivity,
                "ph_deviation": round(ph_deviation, 2),
                "temp_factor": round(temp_factor, 3),
                "penalty": round(penalty, 1),
            })

    if ph < 3 or ph > 10:
        recommendations.append("Adjust pH closer to physiological range to reduce hydrolysis")
    if temp > 30:
        recommendations.append("Reduce storage temperature to slow hydrolysis kinetics")

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="hydrolysis",
        score=score,
        severity=_score_to_severity(score),
        description="Risk of hydrolytic degradation",
        factors=factors,
        recommendations=recommendations,
    )


def assess_photodegradation(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess photodegradation risk from light and UV exposure."""
    score = 100.0
    factors = []
    recommendations = []

    light = conditions.get("light_exposure", 0.0)
    uv = conditions.get("uv_exposure", 0.0)

    if light == 0 and uv == 0:
        return RiskResult(
            risk_type="photodegradation", score=100.0, severity="low",
            description="No significant light exposure detected",
        )

    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    max_sensitivity = 0
    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        sens = db_entry.get("light_sensitivity", 0)
        max_sensitivity = max(max_sensitivity, sens)

        if sens > 0:
            light_risk = sens * (light / 500.0 + uv / 0.5) * 25
            score -= light_risk
            if light_risk > 2:
                factors.append({
                    "substance": s.get("name"),
                    "light_sensitivity": sens,
                    "penalty": round(light_risk, 1),
                })

    if max_sensitivity > 0.3:
        recommendations.append("Use amber glass or opaque packaging")
        recommendations.append("Store away from direct light sources")
        if uv > 0:
            recommendations.append("Add UV absorber to formulation")

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="photodegradation",
        score=score,
        severity=_score_to_severity(score),
        description="Risk of light and UV-induced degradation",
        factors=factors,
        recommendations=recommendations,
    )


def assess_polymerization(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess unwanted polymerization risk."""
    score = 100.0
    factors = []
    recommendations = []

    # Known monomer-like structures
    monomer_indicators = ["acrylic", "vinyl", "styrene", "acrylamide", "methacrylate"]

    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    for s in substances:
        name_lower = s.get("name", "").lower()
        for indicator in monomer_indicators:
            if indicator in name_lower:
                penalty = 25
                temp = conditions.get("temperature", 25.0)
                if temp > 40:
                    penalty += 15
                score -= penalty
                factors.append({
                    "substance": s.get("name"),
                    "monomer_type": indicator,
                    "penalty": penalty,
                })
                recommendations.append(f"Add polymerization inhibitor for {s['name']}")
                break

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="polymerization",
        score=score,
        severity=_score_to_severity(score),
        description="Risk of unwanted polymerization",
        factors=factors,
        recommendations=recommendations,
    )


def assess_complexation(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess metal-ligand complexation risk."""
    score = 100.0
    factors = []
    recommendations = []

    has_chelator = False
    has_metal = False
    metal_subs = []
    chelator_subs = []

    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        if db_entry.get("is_chelator"):
            has_chelator = True
            chelator_subs.append(s.get("name"))
        if db_entry.get("category") == "metallic_salt":
            has_metal = True
            metal_subs.append(s.get("name"))

    if has_chelator and has_metal:
        penalty = 15
        score -= penalty
        factors.append({
            "chelators": chelator_subs,
            "metals": metal_subs,
            "penalty": penalty,
            "description": "Chelator may sequester metal ions affecting formulation efficacy",
        })
        recommendations.append("Verify chelator-metal ratio doesn't deplete essential metal ions")

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="complexation",
        score=score,
        severity=_score_to_severity(score),
        description="Risk of metal-ligand complexation",
        factors=factors,
        recommendations=recommendations,
    )


def assess_thermal_decomposition(substances: List[Dict], conditions: Dict) -> RiskResult:
    """Assess thermal decomposition risk at storage temperature."""
    score = 100.0
    factors = []
    recommendations = []

    temp = conditions.get("temperature", 25.0)

    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        melting = db_entry.get("melting_point")
        optimal = db_entry.get("temp_optimal", 25.0)

        if melting and temp > melting * 0.8:
            penalty = 30
            score -= penalty
            factors.append({
                "substance": s.get("name"),
                "storage_temp": temp,
                "melting_point": melting,
                "penalty": penalty,
            })
            recommendations.append(f"Temperature too high for {s['name']} — reduce storage temperature")

        if temp > optimal + 20:
            penalty = min(25, (temp - optimal - 20) * 0.5)
            score -= penalty
            factors.append({
                "substance": s.get("name"),
                "deviation_from_optimal": round(temp - optimal, 1),
                "penalty": round(penalty, 1),
            })

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="thermal_decomposition",
        score=score,
        severity=_score_to_severity(score),
        description="Risk of thermally-induced degradation",
        factors=factors,
        recommendations=recommendations,
    )


def assess_maillard(substances: List[Dict], conditions: Dict) -> RiskResult:
    """
    Assess Maillard reaction risk (reducing sugar + amino acid/amine).
    This risk MUST be calculated — not just declared in RISK_TYPES.
    """
    score = 100.0
    factors = []
    recommendations = []

    has_reducing_sugar = False
    has_amine = False
    sugar_names = []
    amine_names = []

    from app.data.chemical_db import CHEMICAL_DATABASE, lookup_chemical

    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        if db_entry.get("is_reducing_sugar"):
            has_reducing_sugar = True
            sugar_names.append(s.get("name"))
        if db_entry.get("is_amino_acid"):
            has_amine = True
            amine_names.append(s.get("name"))

    if has_reducing_sugar and has_amine:
        # Maillard reaction is temperature and pH dependent
        temp = conditions.get("temperature", 25.0)
        ph = conditions.get("ph", 7.0)

        temp_factor = 2.0 ** ((temp - 25.0) / 10.0)
        ph_factor = 1.0 + abs(ph - 6.5) * 0.1

        penalty = 20 * temp_factor * ph_factor
        penalty = min(50, penalty)

        score -= penalty
        factors.append({
            "reducing_sugars": sugar_names,
            "amino_acids": amine_names,
            "temp_factor": round(temp_factor, 3),
            "ph_factor": round(ph_factor, 3),
            "penalty": round(penalty, 1),
        })
        recommendations.append("Maillard reaction detected: reducing sugar + amino acid")
        recommendations.append("Reduce temperature to slow browning reaction")
        recommendations.append("Consider replacing reducing sugar with non-reducing polyol")
        recommendations.append("Reduce pH below 5 to inhibit Maillard reaction")

    score = max(0.0, min(100.0, score))
    return RiskResult(
        risk_type="maillard",
        score=score,
        severity=_score_to_severity(score),
        description="Maillard reaction risk: browning from reducing sugar + amino acid interaction",
        factors=factors,
        recommendations=recommendations,
    )


# ── Container compatibility ────────────────────────────────────────────

def assess_container_compatibility(substances: List[Dict], container_type: str, conditions: Dict) -> Dict[str, Any]:
    """Evaluate compatibility with packaging material."""
    from app.data.chemical_db import CONTAINER_COMPATIBILITY, CHEMICAL_DATABASE

    compat = CONTAINER_COMPATIBILITY.get(container_type, CONTAINER_COMPATIBILITY.get("glass_I"))
    score = compat.get("default", 0.8) * 100
    factors = []

    for s in substances:
        db_entry = lookup_chemical(s.get("name", ""))
        category = db_entry.get("category", "default")

        if category == "acid":
            score = min(score, compat.get("acids", 0.5) * 100)
            if compat.get("acids", 1.0) < 0.5:
                factors.append({"substance": s["name"], "issue": f"{container_type} is poorly resistant to acids"})
        elif category == "base":
            score = min(score, compat.get("bases", 0.5) * 100)
            if compat.get("bases", 1.0) < 0.5:
                factors.append({"substance": s["name"], "issue": f"{container_type} is poorly resistant to bases"})
        elif category in ("oxidizer",):
            score = min(score, compat.get("oxidizers", 0.5) * 100)
        elif category in ("solvent", "surfactant"):
            score = min(score, compat.get("organics", 0.5) * 100)

    return {
        "container_type": container_type,
        "score": round(max(0, min(100, score)), 1),
        "severity": _score_to_severity(score),
        "factors": factors,
    }


# ── Master assessment ──────────────────────────────────────────────────

def assess_all_risks(substances: List[Dict], conditions: Dict, container_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Run ALL risk assessments and return comprehensive results.
    Every risk type defined in RISK_TYPES is evaluated here — none left as dead declarations.
    """
    risk_functions = {
        "chemical_incompatibility": assess_chemical_incompatibility,
        "precipitation": assess_precipitation,
        "oxidation": assess_oxidation,
        "hydrolysis": assess_hydrolysis,
        "photodegradation": assess_photodegradation,
        "polymerization": assess_polymerization,
        "complexation": assess_complexation,
        "thermal_decomposition": assess_thermal_decomposition,
        "maillard": assess_maillard,
    }

    results = {}
    all_recommendations = []
    total_score = 0
    count = 0

    for risk_type, func in risk_functions.items():
        result = func(substances, conditions)
        results[risk_type] = {
            "icon": RISK_TYPES[risk_type]["icon"],
            "name": RISK_TYPES[risk_type]["name"],
            "score": round(result.score, 1),
            "severity": result.severity,
            "description": result.description,
            "factors": result.factors,
            "recommendations": result.recommendations,
        }
        total_score += result.score
        count += 1
        all_recommendations.extend(result.recommendations)

    # Container compatibility
    if container_type:
        container_result = assess_container_compatibility(substances, container_type, conditions)
        results["container_compatibility"] = container_result
        total_score += container_result["score"]
        count += 1

    overall_score = round(total_score / count, 1) if count > 0 else 0

    return {
        "overall_score": overall_score,
        "overall_severity": _score_to_severity(overall_score),
        "risks": results,
        "recommendations": list(set(all_recommendations)),
    }
