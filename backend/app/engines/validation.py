"""
QSPR Validation Pipeline — Cross-validation, R², RMSE, applicability domain.
Provides publishable-quality model validation metrics.

Validation follows OECD principles for QSPR:
  1. Defined endpoint
  2. Unambiguous algorithm
  3. Defined domain of applicability
  4. Appropriate measures of goodness-of-fit, robustness, and predictivity
  5. Mechanistic interpretation (if possible)
"""

import numpy as np
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    from sklearn.model_selection import (
        cross_val_score, KFold, LeaveOneOut, StratifiedKFold,
        cross_validate
    )
    from sklearn.metrics import (
        r2_score, mean_squared_error, mean_absolute_error,
        explained_variance_score, max_error
    )
    from sklearn.preprocessing import StandardScaler
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


@dataclass
class ValidationMetrics:
    """Comprehensive validation metrics for a QSPR model."""
    # Basic metrics
    r2: float  # Coefficient of determination
    r2_adj: float  # Adjusted R²
    rmse: float  # Root mean squared error
    mae: float  # Mean absolute error
    mse: float  # Mean squared error
    evs: float  # Explained variance score
    max_err: float  # Maximum error

    # Cross-validation metrics
    cv_r2_mean: float
    cv_r2_std: float
    cv_r2_scores: List[float]
    cv_rmse_mean: float
    cv_rmse_std: float
    cv_rmse_scores: List[float]

    # Training info
    n_samples: int
    n_features: int
    n_folds: int
    model_type: str
    property_name: str

    # Applicability domain
    applicability_domain: Dict[str, Any] = field(default_factory=dict)

    # Feature importance (top 10)
    top_features: Dict[str, float] = field(default_factory=dict)

    # Data source
    training_source: str = ""
    validation_date: str = ""

    @property
    def is_publishable(self) -> bool:
        """Check if metrics meet publication-quality thresholds."""
        return (
            self.r2 > 0.6
            and self.cv_r2_mean > 0.5
            and self.rmse < self._rmse_threshold()
            and self.n_samples >= 50
        )

    def _rmse_threshold(self) -> float:
        """Property-specific RMSE thresholds for publishable models."""
        thresholds = {
            "solubility": 1.0,  # log(mol/L)
            "logp": 0.8,
            "logd": 1.0,
            "melting_point": 30.0,  # °C
            "boiling_point": 15.0,  # °C
            "hydration_free_energy": 2.0,  # kcal/mol
        }
        return thresholds.get(self.property_name, 999.0)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "metrics": {
                "r2": round(self.r2, 4),
                "r2_adjusted": round(self.r2_adj, 4),
                "rmse": round(self.rmse, 4),
                "mae": round(self.mae, 4),
                "explained_variance": round(self.evs, 4),
                "max_error": round(self.max_err, 4),
            },
            "cross_validation": {
                "n_folds": self.n_folds,
                "r2_mean": round(self.cv_r2_mean, 4),
                "r2_std": round(self.cv_r2_std, 4),
                "r2_scores": [round(s, 4) for s in self.cv_r2_scores],
                "rmse_mean": round(self.cv_rmse_mean, 4),
                "rmse_std": round(self.cv_rmse_std, 4),
                "rmse_scores": [round(s, 4) for s in self.cv_rmse_scores],
            },
            "applicability_domain": self.applicability_domain,
            "top_features": dict(list(self.top_features.items())[:10]),
            "training": {
                "n_samples": self.n_samples,
                "n_features": self.n_features,
                "model_type": self.model_type,
                "property": self.property_name,
                "source": self.training_source,
            },
            "quality": {
                "is_publishable": self.is_publishable,
                "r2_quality": self._r2_quality(),
                "cv_quality": self._cv_quality(),
            },
        }

    def _r2_quality(self) -> str:
        if self.r2 >= 0.9:
            return "excellent"
        elif self.r2 >= 0.8:
            return "good"
        elif self.r2 >= 0.7:
            return "acceptable"
        elif self.r2 >= 0.6:
            return "marginal"
        return "poor"

    def _cv_quality(self) -> str:
        if self.cv_r2_mean >= 0.8:
            return "excellent"
        elif self.cv_r2_mean >= 0.7:
            return "good"
        elif self.cv_r2_mean >= 0.6:
            return "acceptable"
        elif self.cv_r2_mean >= 0.5:
            return "marginal"
        return "poor"


@dataclass
class ApplicabilityDomain:
    """Applicability domain analysis for a QSPR model."""
    method: str  # "leverage", "distance", "probability"
    training_range: Dict[str, Tuple[float, float]]  # feature → (min, max)
    warning_threshold: float
    training_points: int

    def check(self, X: np.ndarray) -> Tuple[bool, float]:
        """
        Check if a prediction is within the applicability domain.
        Returns (is_within, warning_level).
        """
        # Simple range-based check
        for i, (feat, (min_val, max_val)) in enumerate(self.training_range.items()):
            if i < X.shape[0]:
                val = X[i]
                if val < min_val * 0.9 or val > max_val * 1.1:
                    return False, 1.0
        return True, 0.0


class QSPRValidator:
    """
    Comprehensive QSPR model validation following OECD principles.
    """

    def __init__(self):
        self.validation_history: List[ValidationMetrics] = []

    def validate(
        self,
        model: Any,
        X: np.ndarray,
        y: np.ndarray,
        property_name: str,
        descriptor_names: List[str],
        n_folds: int = 5,
        model_type: str = "unknown",
        training_source: str = "",
    ) -> ValidationMetrics:
        """
        Full validation of a QSPR model.
        Returns comprehensive metrics including cross-validation.
        """
        if not HAS_SKLEARN:
            raise RuntimeError("scikit-learn not installed")

        n_samples, n_features = X.shape

        # ── Fit model on full data ────────────────────────────────────
        model.fit(X, y)
        y_pred = model.predict(X)

        # Basic metrics
        r2 = r2_score(y, y_pred)
        r2_adj = 1 - (1 - r2) * (n_samples - 1) / (n_samples - n_features - 1)
        mse = mean_squared_error(y, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y, y_pred)
        evs = explained_variance_score(y, y_pred)
        max_err = max_error(y, y_pred)

        # ── Cross-validation ──────────────────────────────────────────
        cv = KFold(n_splits=n_folds, shuffle=True, random_state=42)

        cv_r2_scores = cross_val_score(model, X, y, cv=cv, scoring="r2", n_jobs=-1)
        cv_r2_mean = float(cv_r2_scores.mean())
        cv_r2_std = float(cv_r2_scores.std())

        # RMSE via cross_validate
        cv_results = cross_validate(
            model, X, y, cv=cv,
            scoring="neg_mean_squared_error",
            return_train_score=False, n_jobs=-1,
        )
        cv_rmse_scores = np.sqrt(-cv_results["test_score"])
        cv_rmse_mean = float(cv_rmse_scores.mean())
        cv_rmse_std = float(cv_rmse_scores.std())

        # ── Feature importance ────────────────────────────────────────
        top_features = {}
        if hasattr(model, "feature_importances_"):
            imp = model.feature_importances_
            sorted_idx = np.argsort(imp)[::-1][:15]
            for idx in sorted_idx:
                if idx < len(descriptor_names):
                    top_features[descriptor_names[idx]] = round(float(imp[idx]), 4)
        elif hasattr(model, "coef_"):
            coef = np.abs(model.coef_)
            sorted_idx = np.argsort(coef)[::-1][:15]
            for idx in sorted_idx:
                if idx < len(descriptor_names):
                    top_features[descriptor_names[idx]] = round(float(coef[idx]), 4)

        # ── Applicability domain ──────────────────────────────────────
        training_range = {}
        for i, name in enumerate(descriptor_names[:n_features]):
            col = X[:, i]
            training_range[name] = (float(np.min(col)), float(np.max(col)))

        ad = ApplicabilityDomain(
            method="range",
            training_range=training_range,
            warning_threshold=0.3,
            training_points=n_samples,
        )

        # ── Build validation result ───────────────────────────────────
        from datetime import datetime, timezone

        metrics = ValidationMetrics(
            r2=r2,
            r2_adj=r2_adj,
            rmse=rmse,
            mae=mae,
            mse=mse,
            evs=evs,
            max_err=float(max_err),
            cv_r2_mean=cv_r2_mean,
            cv_r2_std=cv_r2_std,
            cv_r2_scores=cv_r2_scores.tolist(),
            cv_rmse_mean=cv_rmse_mean,
            cv_rmse_std=cv_rmse_std,
            cv_rmse_scores=cv_rmse_scores.tolist(),
            n_samples=n_samples,
            n_features=n_features,
            n_folds=n_folds,
            model_type=model_type,
            property_name=property_name,
            applicability_domain={
                "method": "range",
                "features_in_domain": len(training_range),
                "training_samples": n_samples,
            },
            top_features=top_features,
            training_source=training_source,
            validation_date=datetime.now(timezone.utc).isoformat(),
        )

        self.validation_history.append(metrics)

        logger.info(
            f"Validation for '{property_name}' ({model_type}): "
            f"R²={r2:.4f}, CV-R²={cv_r2_mean:.4f}±{cv_r2_std:.4f}, "
            f"RMSE={rmse:.4f}, N={n_samples}"
        )

        return metrics

    def validate_with_confidence(
        self,
        model: Any,
        X: np.ndarray,
        y: np.ndarray,
        property_name: str,
        descriptor_names: List[str],
    ) -> Tuple[ValidationMetrics, np.ndarray]:
        """
        Validate and return prediction intervals.
        Returns metrics and prediction intervals for each sample.
        """
        metrics = self.validate(
            model, X, y, property_name, descriptor_names
        )

        # Bootstrap prediction intervals
        n_bootstrap = 100
        predictions = np.zeros((n_bootstrap, len(y)))

        for i in range(n_bootstrap):
            idx = np.random.choice(len(y), size=len(y), replace=True)
            X_boot, y_boot = X[idx], y[idx]
            model.fit(X_boot, y_boot)
            predictions[i] = model.predict(X)

        # 95% prediction intervals
        lower = np.percentile(predictions, 2.5, axis=0)
        upper = np.percentile(predictions, 97.5, axis=0)

        intervals = np.column_stack([lower, upper])

        return metrics, intervals

    def get_validation_summary(self) -> Dict[str, Any]:
        """Summary of all validated models."""
        return {
            "total_validations": len(self.validation_history),
            "models": [
                {
                    "property": m.property_name,
                    "r2": round(m.r2, 4),
                    "cv_r2": round(m.cv_r2_mean, 4),
                    "rmse": round(m.rmse, 4),
                    "n_samples": m.n_samples,
                    "publishable": m.is_publishable,
                    "quality": m._r2_quality(),
                }
                for m in self.validation_history
            ],
        }


# Global singleton
qspr_validator = QSPRValidator()
