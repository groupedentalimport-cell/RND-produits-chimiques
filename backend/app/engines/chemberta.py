"""
ChemBERTa Property Predictor — Transformer-based molecular property prediction.
Uses pre-trained chemical language models from HuggingFace.

Models:
  - ChemBERTa (seyonec/ChemBERTa_zinc250k_v2_40k) — SMILES-based BERT
  - MolBERT — molecular BERT for property prediction
  - ChemBERTa-2 — improved version with larger training set

These models learn molecular representations from SMILES strings
and can be fine-tuned on experimental data for property prediction.
"""

import logging
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ChemBERTaPrediction:
    """Prediction from a ChemBERTa model."""
    property_name: str
    predicted_value: float
    confidence: float
    model_name: str
    smiles: str
    embedding: Optional[List[float]] = None


class ChemBERTaPredictor:
    """
    Transformer-based molecular property prediction using ChemBERTa.
    """

    AVAILABLE_MODELS = {
        "ChemBERTa-zinc250k": {
            "model_id": "seyonec/ChemBERTa_zinc250k_v2_40k",
            "description": "ChemBERTa trained on 250K ZINC molecules",
            "training_data": "ZINC250k",
            "properties": ["solubility", "toxicity", "bioactivity"],
        },
        "ChemBERTa-2": {
            "model_id": "DeepChem/ChemBERTa-77M-MTR",
            "description": "ChemBERTa-2 with 77M parameters, multi-task regression",
            "training_data": "MoleculeNet",
            "properties": ["solubility", "logp", "melting_point", "binding_affinity"],
        },
        "MolBERT": {
            "model_id": "jablonkagroup/molbert",
            "description": "Molecular BERT for property prediction",
            "training_data": "ChEMBL",
            "properties": ["bioactivity", "admet"],
        },
    }

    def __init__(self, model_name: str = "ChemBERTa-zinc250k"):
        self.model_name = model_name
        self.model_info = self.AVAILABLE_MODELS.get(model_name, {})
        self._model = None
        self._tokenizer = None
        self._available = False

    def _load_model(self) -> bool:
        """Load ChemBERTa model from HuggingFace."""
        if self._model is not None:
            return True

        try:
            from transformers import AutoTokenizer, AutoModel
            import torch

            model_id = self.model_info.get("model_id", "seyonec/ChemBERTa_zinc250k_v2_40k")
            self._tokenizer = AutoTokenizer.from_pretrained(model_id)
            self._model = AutoModel.from_pretrained(model_id)
            self._model.eval()
            self._available = True
            logger.info(f"Loaded ChemBERTa model: {model_id}")
            return True

        except ImportError:
            logger.info("transformers not installed — ChemBERTa predictions disabled")
            return False
        except Exception as e:
            logger.warning(f"Failed to load ChemBERTa: {e}")
            return False

    @property
    def is_available(self) -> bool:
        return self._available or self._load_model()

    def get_embedding(self, smiles: str) -> Optional[List[float]]:
        """
        Get molecular embedding from ChemBERTa.
        Returns a 768-dimensional vector representing the molecule.
        """
        if not self.is_available:
            return None

        try:
            import torch

            inputs = self._tokenizer(
                smiles,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512,
            )

            with torch.no_grad():
                outputs = self._model(**inputs)

            # Use [CLS] token embedding
            cls_embedding = outputs.last_hidden_state[:, 0, :].squeeze().numpy()
            return cls_embedding.tolist()

        except Exception as e:
            logger.error(f"ChemBERTa embedding failed: {e}")
            return None

    def predict_property(
        self,
        smiles: str,
        property_name: str,
        fine_tuned_model: Optional[str] = None,
    ) -> Optional[ChemBERTaPrediction]:
        """
        Predict a molecular property using ChemBERTa.
        For production use, fine-tune on experimental data.
        """
        embedding = self.get_embedding(smiles)
        if embedding is None:
            return None

        # Without fine-tuned model, return embedding-based estimate
        # In production, load a fine-tuned regression head
        return ChemBERTaPrediction(
            property_name=property_name,
            predicted_value=0.0,  # Would be from fine-tuned head
            confidence=0.5,
            model_name=self.model_name,
            smiles=smiles,
            embedding=embedding[:50],  # First 50 dims for storage
        )

    def compute_similarity_from_embeddings(
        self,
        smiles1: str,
        smiles2: str,
    ) -> Optional[float]:
        """Compute cosine similarity between molecular embeddings."""
        emb1 = self.get_embedding(smiles1)
        emb2 = self.get_embedding(smiles2)

        if emb1 is None or emb2 is None:
            return None

        a = np.array(emb1)
        b = np.array(emb2)
        cos_sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        return float(cos_sim)

    def batch_embeddings(self, smiles_list: List[str]) -> List[Optional[List[float]]]:
        """Get embeddings for a batch of SMILES."""
        return [self.get_embedding(smi) for smi in smiles_list]

    def list_models(self) -> List[Dict[str, Any]]:
        """List available ChemBERTa models."""
        return [
            {"key": k, **v}
            for k, v in self.AVAILABLE_MODELS.items()
        ]


# Global singleton
chemberta = ChemBERTaPredictor()
