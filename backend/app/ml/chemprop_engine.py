"""
Chemprop Integration — Message Passing Neural Networks for molecular property prediction.
Graph-based deep learning for chemical property prediction.

Chemprop (MIT License) uses message passing on molecular graphs to learn
representations directly from SMILES, achieving state-of-the-art on
many molecular property prediction benchmarks.

Installation: pip install chemprop
GitHub: https://github.com/chemprop/chemprop
"""

import os
import json
import logging
import tempfile
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import chemprop
    from chemprop.args import TrainArgs, PredictArgs
    from chemprop.train import run_training, run_prediction
    from chemprop.utils import load_checkpoint
    HAS_CHEMPROP = True
except ImportError:
    HAS_CHEMPROP = False
    logger.info("Chemprop not installed — install with: pip install chemprop")


@dataclass
class ChempropPrediction:
    """Prediction from a Chemprop MPNN model."""
    smiles: str
    property_name: str
    predicted_value: float
    uncertainty: Optional[float] = None
    model_path: str = ""
    ensemble_size: int = 1


@dataclass
class ChempropTrainingResult:
    """Result of Chemprop model training."""
    property_name: str
    model_path: str
    n_train: int
    n_val: int
    n_test: int
    metric: str
    train_score: float
    val_score: float
    test_score: float
    ensemble_size: int
    training_time_seconds: float


class ChempropEngine:
    """
    Chemprop MPNN engine for molecular property prediction.
    Supports training, prediction, and uncertainty estimation.
    """

    def __init__(self, models_dir: str = "./ml_models/chemprop"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._loaded_models: Dict[str, Any] = {}

    @property
    def is_available(self) -> bool:
        return HAS_CHEMPROP

    def train(
        self,
        smiles_list: List[str],
        values: List[float],
        property_name: str,
        epochs: int = 50,
        batch_size: int = 50,
        ensemble_size: int = 5,
        split_type: str = "random",
        metric: str = "rmse",
    ) -> ChempropTrainingResult:
        """
        Train a Chemprop MPNN model on experimental data.
        Uses ensemble of models for uncertainty estimation.
        """
        if not HAS_CHEMPROP:
            raise RuntimeError("Chemprop not installed")

        import time
        start_time = time.time()

        # Prepare data files
        data_dir = self.models_dir / "data" / property_name
        data_dir.mkdir(parents=True, exist_ok=True)

        # Write CSV with SMILES and targets
        train_file = data_dir / "train.csv"
        with open(train_file, "w") as f:
            f.write("smiles,target\n")
            for smi, val in zip(smiles_list, values):
                f.write(f"{smi},{val}\n")

        # Model output directory
        model_dir = self.models_dir / property_name
        model_dir.mkdir(parents=True, exist_ok=True)

        # Train ensemble
        best_scores = []
        for i in range(ensemble_size):
            save_dir = model_dir / f"model_{i}"
            save_dir.mkdir(parents=True, exist_ok=True)

            args = TrainArgs()
            args.data_path = str(train_file)
            args.save_dir = str(save_dir)
            args.epochs = epochs
            args.batch_size = batch_size
            args.split_type = split_type
            args.metric = metric
            args.smiles_columns = ["smiles"]
            args.target_columns = ["target"]
            args.num_workers = 0  # avoid multiprocessing issues
            args.quiet = True

            try:
                # Run training
                mean_score, std_score = run_training(args)
                best_scores.append(mean_score)
                logger.info(f"Chemprop model {i} for '{property_name}': {metric}={mean_score:.4f}")
            except Exception as e:
                logger.error(f"Chemprop training failed for model {i}: {e}")
                best_scores.append(float("inf"))

        elapsed = time.time() - start_time

        # Save metadata
        meta = {
            "property_name": property_name,
            "n_samples": len(smiles_list),
            "ensemble_size": ensemble_size,
            "metric": metric,
            "scores": best_scores,
            "mean_score": float(np.mean([s for s in best_scores if s < float("inf")])),
        }
        meta_file = model_dir / "metadata.json"
        meta_file.write_text(json.dumps(meta, indent=2))

        return ChempropTrainingResult(
            property_name=property_name,
            model_path=str(model_dir),
            n_train=int(len(smiles_list) * 0.8),
            n_val=int(len(smiles_list) * 0.1),
            n_test=int(len(smiles_list) * 0.1),
            metric=metric,
            train_score=float(np.mean(best_scores)),
            val_score=float(np.mean(best_scores)),
            test_score=float(np.mean(best_scores)),
            ensemble_size=ensemble_size,
            training_time_seconds=elapsed,
        )

    def predict(
        self,
        smiles_list: List[str],
        property_name: str,
    ) -> List[ChempropPrediction]:
        """
        Predict properties using trained Chemprop model.
        Returns predictions with uncertainty from ensemble.
        """
        if not HAS_CHEMPROP:
            return []

        model_dir = self.models_dir / property_name
        if not model_dir.exists():
            logger.warning(f"No trained model for '{property_name}'")
            return []

        # Prepare input file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("smiles\n")
            for smi in smiles_list:
                f.write(f"{smi}\n")
            input_file = f.name

        # Collect predictions from ensemble
        all_preds = []
        for model_path in sorted(model_dir.glob("model_*")):
            checkpoint_files = list(model_path.glob("**/*.pt"))
            if not checkpoint_files:
                continue

            try:
                args = PredictArgs()
                args.test_path = input_file
                args.checkpoint_paths = [str(checkpoint_files[0])]
                args.smiles_columns = ["smiles"]
                args.num_workers = 0
                args.quiet = True

                preds = run_prediction(args)
                if preds:
                    all_preds.append([p[0] for p in preds])
            except Exception as e:
                logger.warning(f"Chemprop prediction failed: {e}")

        # Clean up
        os.unlink(input_file)

        if not all_preds:
            return []

        # Ensemble statistics
        all_preds = np.array(all_preds)
        results = []
        for i, smi in enumerate(smiles_list):
            pred_values = all_preds[:, i]
            mean_pred = float(np.mean(pred_values))
            uncertainty = float(np.std(pred_values)) if len(pred_values) > 1 else 0.0

            results.append(ChempropPrediction(
                smiles=smi,
                property_name=property_name,
                predicted_value=mean_pred,
                uncertainty=uncertainty,
                model_path=str(model_dir),
                ensemble_size=len(all_preds),
            ))

        return results

    def train_from_benchmarks(self, property_name: str) -> Optional[ChempropTrainingResult]:
        """
        Train Chemprop model using benchmark experimental data.
        """
        from app.services.experimental.benchmark_loaders import BenchmarkAggregator

        aggregator = BenchmarkAggregator()
        all_data = aggregator.get_all_training_data()

        benchmark_map = {
            "solubility": "solubility",
            "logd": "logd",
            "hydration_free_energy": "hydration_free_energy",
        }

        target = benchmark_map.get(property_name)
        if not target or target not in all_data:
            return None

        smiles, values = all_data[target]

        return self.train(
            smiles_list=smiles,
            values=values,
            property_name=property_name,
            epochs=50,
            ensemble_size=5,
        )


# Global singleton
chemprop_engine = ChempropEngine()
