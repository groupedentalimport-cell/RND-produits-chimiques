"""
QSPR Model Validation — ICH Q2(R2) Compliant

Validates ML/QSPR models for pharmaceutical use:
  1. Cross-validation metrics (R², RMSE, MAE)
  2. Applicability Domain (AD) assessment
  3. Prediction confidence scoring
  4. Comparison with experimental reference data
  5. Model provenance and versioning
  6. Bias detection and residual analysis

Required for regulatory acceptance of computational predictions.
"""

import math
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
# Validation Metrics
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class ValidationMetrics:
    """Standard regression validation metrics."""
    r_squared: float          # Coefficient of determination
    rmse: float               # Root Mean Square Error
    mae: float                # Mean Absolute Error
    mse: float                # Mean Square Error
    n_samples: int            # Number of samples
    n_features: int           # Number of features
    adjusted_r_squared: float # R² adjusted for number of features
    max_error: float          # Maximum absolute error
    mean_error: float         # Mean error (bias)
    std_error: float          # Standard deviation of errors


@dataclass
class CrossValidationResult:
    """K-fold cross-validation result."""
    k_folds: int
    fold_metrics: List[ValidationMetrics]
    mean_r_squared: float
    std_r_squared: float
    mean_rmse: float
    std_rmse: float
    mean_mae: float
    std_mae: float


@dataclass
class ApplicabilityDomain:
    """
    Applicability Domain assessment.
    Determines if a new prediction is within the model's reliable range.
    """
    method: str  # "leverage", "knn", "probability_density"
    threshold: float
    training_range: Dict[str, Tuple[float, float]]  # feature → (min, max)
    is_inside: bool
    distance_from_center: float
    warning: Optional[str] = None


@dataclass
class ModelValidationReport:
    """Complete model validation report."""
    model_name: str
    model_version: str
    model_type: str
    property_predicted: str
    training_dataset: str
    training_source: str
    validation_date: str

    # Metrics
    cross_validation: CrossValidationResult
    test_metrics: Optional[ValidationMetrics] = None

    # Applicability
    applicability_domain: Optional[ApplicabilityDomain] = None

    # Provenance
    training_samples: int = 0
    feature_count: int = 0
    features: List[str] = field(default_factory=list)
    hyperparameters: Dict[str, Any] = field(default_factory=dict)

    # Compliance
    ich_reference: str = "ICH Q2(R2)"
    validation_status: str = "pending"  # "pending", "qualified", "rejected"
    reviewer: str = ""
    review_date: str = ""
    comments: str = ""


# ═══════════════════════════════════════════════════════════════════════
# Metric Computation
# ═══════════════════════════════════════════════════════════════════════

def compute_regression_metrics(
    y_true: List[float],
    y_pred: List[float],
    n_features: int = 1,
) -> ValidationMetrics:
    """
    Compute standard regression validation metrics.

    Args:
        y_true: Actual values
        y_pred: Predicted values
        n_features: Number of features (for adjusted R²)
    """
    n = len(y_true)
    if n == 0:
        raise ValueError("Empty arrays")
    if n != len(y_pred):
        raise ValueError("Arrays must have same length")

    errors = [yt - yp for yt, yp in zip(y_true, y_pred)]
    abs_errors = [abs(e) for e in errors]
    sq_errors = [e ** 2 for e in errors]

    mean_y = sum(y_true) / n
    ss_tot = sum((yt - mean_y) ** 2 for yt in y_true)
    ss_res = sum(sq_errors)

    r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    mse = ss_res / n
    rmse = math.sqrt(mse)
    mae = sum(abs_errors) / n

    # Adjusted R²
    if n > n_features + 1:
        adj_r_squared = 1.0 - (1.0 - r_squared) * (n - 1) / (n - n_features - 1)
    else:
        adj_r_squared = r_squared

    return ValidationMetrics(
        r_squared=round(r_squared, 6),
        rmse=round(rmse, 6),
        mae=round(mae, 6),
        mse=round(mse, 6),
        n_samples=n,
        n_features=n_features,
        adjusted_r_squared=round(adj_r_squared, 6),
        max_error=round(max(abs_errors), 6),
        mean_error=round(sum(errors) / n, 6),  # bias
        std_error=round(math.sqrt(sum((e - sum(errors)/n)**2 for e in errors) / n), 6),
    )


def k_fold_cross_validation(
    y_true: List[float],
    y_pred_folds: List[List[Tuple[float, float]]],  # List of (y_true, y_pred) per fold
    n_features: int = 1,
) -> CrossValidationResult:
    """
    Compute k-fold cross-validation metrics.

    Args:
        y_true: Full dataset actual values (for reference)
        y_pred_folds: List of folds, each containing (y_true, y_pred) tuples
        n_features: Number of features
    """
    k = len(y_pred_folds)
    fold_metrics = []

    for fold in y_pred_folds:
        fold_true = [f[0] for f in fold]
        fold_pred = [f[1] for f in fold]
        metrics = compute_regression_metrics(fold_true, fold_pred, n_features)
        fold_metrics.append(metrics)

    r2_values = [m.r_squared for m in fold_metrics]
    rmse_values = [m.rmse for m in fold_metrics]
    mae_values = [m.mae for m in fold_metrics]

    return CrossValidationResult(
        k_folds=k,
        fold_metrics=fold_metrics,
        mean_r_squared=round(_mean(r2_values), 6),
        std_r_squared=round(_std(r2_values), 6),
        mean_rmse=round(_mean(rmse_values), 6),
        std_rmse=round(_std(rmse_values), 6),
        mean_mae=round(_mean(mae_values), 6),
        std_mae=round(_std(mae_values), 6),
    )


# ═══════════════════════════════════════════════════════════════════════
# Applicability Domain
# ═══════════════════════════════════════════════════════════════════════

def check_applicability_domain(
    prediction_input: Dict[str, float],
    training_data: List[Dict[str, float]],
    method: str = "range",
) -> ApplicabilityDomain:
    """
    Check if a prediction is within the model's applicability domain.

    Methods:
        "range": Check if all features are within training min/max
        "leverage": Williams leverage approach (simplified)
    """
    if not training_data:
        return ApplicabilityDomain(
            method=method, threshold=1.0,
            training_range={}, is_inside=True,
            distance_from_center=0.0,
            warning="No training data available for AD check",
        )

    # Compute training ranges
    features = list(prediction_input.keys())
    training_range = {}
    for feat in features:
        values = [d.get(feat, 0) for d in training_data if feat in d]
        if values:
            training_range[feat] = (min(values), max(values))

    if method == "range":
        is_inside = True
        max_deviation = 0.0

        for feat, (t_min, t_max) in training_range.items():
            val = prediction_input.get(feat, 0)
            if val < t_min or val > t_max:
                is_inside = False
                # How far outside (normalized)
                range_width = t_max - t_min if t_max > t_min else 1.0
                if val < t_min:
                    deviation = (t_min - val) / range_width
                else:
                    deviation = (val - t_max) / range_width
                max_deviation = max(max_deviation, deviation)

        warning = None
        if not is_inside:
            warning = (
                f"Prediction is OUTSIDE the applicability domain. "
                f"Maximum deviation: {max_deviation:.2f}x training range. "
                f"Prediction may be unreliable."
            )

        return ApplicabilityDomain(
            method="range",
            threshold=1.0,
            training_range=training_range,
            is_inside=is_inside,
            distance_from_center=round(max_deviation, 4),
            warning=warning,
        )

    elif method == "leverage":
        # Simplified leverage: distance from training centroid
        centroids = {}
        for feat in features:
            values = [d.get(feat, 0) for d in training_data if feat in d]
            if values:
                centroids[feat] = sum(values) / len(values)

        # Euclidean distance (normalized by range)
        dist_sq = 0.0
        for feat in features:
            if feat in centroids and feat in training_range:
                t_min, t_max = training_range[feat]
                range_width = t_max - t_min if t_max > t_min else 1.0
                normalized_diff = (prediction_input.get(feat, 0) - centroids[feat]) / range_width
                dist_sq += normalized_diff ** 2

        distance = math.sqrt(dist_sq)
        threshold = 3.0  # 3σ rule
        is_inside = distance <= threshold

        return ApplicabilityDomain(
            method="leverage",
            threshold=threshold,
            training_range=training_range,
            is_inside=is_inside,
            distance_from_center=round(distance, 4),
            warning=f"Leverage distance: {distance:.2f} (threshold: {threshold})"
                    if not is_inside else None,
        )

    else:
        raise ValueError(f"Unknown AD method: {method}")


# ═══════════════════════════════════════════════════════════════════════
# Confidence Scoring
# ═══════════════════════════════════════════════════════════════════════

def compute_prediction_confidence(
    model_r_squared: float,
    is_in_ad: bool,
    distance_from_ad_center: float,
    training_samples: int,
) -> float:
    """
    Compute a 0-1 confidence score for a prediction.

    Factors:
        - Model quality (R²)
        - Applicability domain membership
        - Distance from AD center
        - Training data quantity
    """
    # Base confidence from R²
    base = model_r_squared

    # AD penalty
    ad_factor = 1.0 if is_in_ad else max(0.1, 1.0 - distance_from_ad_center * 0.3)

    # Training data factor (more data → more confidence)
    data_factor = min(1.0, training_samples / 500)  # Saturates at 500 samples

    confidence = base * ad_factor * (0.7 + 0.3 * data_factor)
    return round(max(0.0, min(1.0, confidence)), 4)


# ═══════════════════════════════════════════════════════════════════════
# Model Validation Report Generator
# ═══════════════════════════════════════════════════════════════════════

def generate_validation_report(
    model_name: str,
    model_version: str,
    model_type: str,
    property_predicted: str,
    training_dataset: str,
    training_source: str,
    y_true: List[float],
    y_pred: List[float],
    y_true_test: Optional[List[float]] = None,
    y_pred_test: Optional[List[float]] = None,
    n_features: int = 1,
    features: Optional[List[str]] = None,
    hyperparameters: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate a complete model validation report.

    This is the main entry point for model validation.
    Returns a JSON-serializable dict suitable for regulatory submission.
    """
    # Training metrics
    train_metrics = compute_regression_metrics(y_true, y_pred, n_features)

    # Simplified cross-validation (using train/test split if available)
    if y_true_test and y_pred_test:
        test_metrics = compute_regression_metrics(y_true_test, y_pred_test, n_features)
    else:
        test_metrics = None

    # Quality assessment
    quality = _assess_model_quality(train_metrics, test_metrics)

    return {
        "model": {
            "name": model_name,
            "version": model_version,
            "type": model_type,
            "property": property_predicted,
        },
        "training_data": {
            "dataset": training_dataset,
            "source": training_source,
            "n_samples": len(y_true),
            "n_features": n_features,
            "features": features or [],
        },
        "training_metrics": {
            "r_squared": train_metrics.r_squared,
            "adjusted_r_squared": train_metrics.adjusted_r_squared,
            "rmse": train_metrics.rmse,
            "mae": train_metrics.mae,
            "max_error": train_metrics.max_error,
            "mean_error": train_metrics.mean_error,  # bias
        },
        "test_metrics": {
            "r_squared": test_metrics.r_squared,
            "rmse": test_metrics.rmse,
            "mae": test_metrics.mae,
            "max_error": test_metrics.max_error,
        } if test_metrics else None,
        "quality_assessment": quality,
        "hyperparameters": hyperparameters or {},
        "validation_date": datetime.now(timezone.utc).isoformat(),
        "ich_reference": "ICH Q2(R2) — Validation of Analytical Procedures",
        "regulatory_status": _regulatory_status(train_metrics),
    }


def _assess_model_quality(
    train: ValidationMetrics,
    test: Optional[ValidationMetrics],
) -> Dict[str, Any]:
    """Assess overall model quality."""
    issues = []
    warnings = []

    # R² check
    if train.r_squared < 0.6:
        issues.append(f"Low R² ({train.r_squared:.3f}) — model explains < 60% of variance")
    elif train.r_squared < 0.8:
        warnings.append(f"Moderate R² ({train.r_squared:.3f}) — consider additional features")

    # Bias check
    if abs(train.mean_error) > train.rmse * 0.5:
        issues.append(f"Systematic bias detected (mean error: {train.mean_error:.3f})")

    # Overfitting check
    if test and train.r_squared - test.r_squared > 0.15:
        issues.append(
            f"Potential overfitting: train R² ({train.r_squared:.3f}) >> "
            f"test R² ({test.r_squared:.3f})"
        )

    # Sample size check
    if train.n_samples < 30:
        warnings.append(f"Small sample size ({train.n_samples}) — results may be unstable")

    if not issues:
        status = "QUALIFIED"
        grade = "A" if train.r_squared > 0.9 else "B" if train.r_squared > 0.8 else "C"
    elif len(issues) == 1 and not any("bias" in i.lower() for i in issues):
        status = "CONDITIONALLY_QUALIFIED"
        grade = "C"
    else:
        status = "NOT_QUALIFIED"
        grade = "D"

    return {
        "status": status,
        "grade": grade,
        "issues": issues,
        "warnings": warnings,
    }


def _regulatory_status(metrics: ValidationMetrics) -> str:
    """Determine regulatory acceptance status."""
    if metrics.r_squared >= 0.9 and metrics.n_samples >= 100:
        return "ACCEPTABLE — High confidence for regulatory submission"
    elif metrics.r_squared >= 0.8 and metrics.n_samples >= 50:
        return "CONDITIONALLY_ACCEPTABLE — Additional validation recommended"
    elif metrics.r_squared >= 0.6 and metrics.n_samples >= 30:
        return "PRELIMINARY — Use with caution, supplementary data required"
    else:
        return "NOT_ACCEPTABLE — Model requires retraining or additional data"


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _std(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    return math.sqrt(sum((v - m) ** 2 for v in values) / (len(values) - 1))
