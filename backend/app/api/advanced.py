"""
Level 3 API — Quantum chemistry, MD, HPC, ChemBERTa, literature mining.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/advanced", tags=["Level 3 — Advanced Computing"])


# ── Schemas ────────────────────────────────────────────────────────────

class DFTRequest(BaseModel):
    smiles: str
    method: str = "B3LYP"
    basis_set: str = "6-31G*"
    charge: int = 0
    multiplicity: int = 1
    calculation_type: str = "single_point"  # single_point, optimization, frequency


class TransitionStateRequest(BaseModel):
    reactant_smiles: str
    product_smiles: str
    method: str = "B3LYP"
    basis_set: str = "6-31G*"


class ReactionEnergyRequest(BaseModel):
    reactant_smiles: List[str]
    product_smiles: List[str]
    method: str = "B3LYP"
    basis_set: str = "6-31G*"


class MDRequest(BaseModel):
    smiles: str
    temperature: float = 298.15
    pressure: float = 1.0
    time_ns: float = 1.0
    force_field: str = "MMFF94"
    solvent: str = "water"


class HPCJobRequest(BaseModel):
    job_type: str  # "dft", "md", "ml_training"
    molecule: str
    method: str
    provider: str = "local"
    parameters: dict = {}


class LiteratureExtractRequest(BaseModel):
    text: str
    extraction_type: str = "stability_data"
    source_title: Optional[str] = None
    source_doi: Optional[str] = None


# ── DFT Endpoints ─────────────────────────────────────────────────────

@router.post("/dft/compute")
def dft_compute(
    request: DFTRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Run DFT quantum chemical calculation.
    Computes electronic energy, HOMO/LUMO, dipole moment, etc.
    Requires Psi4, ORCA, or Gaussian installation.
    """
    from app.engines.dft_engine import dft_engine

    if request.calculation_type == "single_point":
        result = dft_engine.compute_single_point(
            request.smiles, request.method, request.basis_set,
            request.charge, request.multiplicity,
        )
    elif request.calculation_type == "optimization":
        result = dft_engine.compute_geometry_optimization(
            request.smiles, request.method, request.basis_set,
            request.charge, request.multiplicity,
        )
    else:
        raise HTTPException(400, f"Unknown calculation type: {request.calculation_type}")

    return {
        "molecule": result.molecule,
        "method": result.method,
        "basis_set": result.basis_set,
        "engine": result.engine,
        "convergence": result.convergence,
        "total_energy_hartree": result.total_energy_hartree,
        "total_energy_kj_mol": result.total_energy_kj_mol,
        "homo_eV": result.homo_energy,
        "lumo_eV": result.lumo_energy,
        "homo_lumo_gap_eV": result.homo_lumo_gap,
        "dipole_debye": result.dipole_moment,
        "frequencies_cm": result.frequencies[:10] if result.frequencies else None,
        "available": dft_engine.is_available,
        "note": "DFT requires Psi4, ORCA, or Gaussian installation" if not dft_engine.is_available else None,
    }


@router.post("/dft/transition-state")
def dft_transition_state(
    request: TransitionStateRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Compute activation energy from transition state search.
    Ea = E_TS - E_reactant (from DFT, not empirical estimation).
    """
    from app.engines.dft_engine import dft_engine

    result = dft_engine.compute_transition_state(
        request.reactant_smiles, request.product_smiles,
        request.method, request.basis_set,
    )

    return {
        "reactant_energy_hartree": result.reactant_energy,
        "product_energy_hartree": result.product_energy,
        "ts_energy_hartree": result.ts_energy,
        "activation_energy_kj_mol": round(result.activation_energy_kj_mol, 2),
        "reaction_energy_kj_mol": round(result.reaction_energy_kj_mol, 2),
        "imaginary_frequency_cm": result.imaginary_frequency,
        "method": result.method,
        "basis_set": result.basis_set,
    }


@router.post("/dft/reaction-energy")
def dft_reaction_energy(
    request: ReactionEnergyRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Compute reaction energy: ΔE = ΣE(products) - ΣE(reactants)
    """
    from app.engines.dft_engine import dft_engine

    result = dft_engine.compute_reaction_energy(
        request.reactant_smiles, request.product_smiles,
        request.method, request.basis_set,
    )

    return {
        "reaction": result.reaction,
        "delta_e_kj_mol": round(result.delta_e, 2),
        "delta_h_kj_mol": round(result.delta_h, 2) if result.delta_h else None,
        "delta_g_kj_mol": round(result.delta_g, 2) if result.delta_g else None,
        "method": result.method,
        "basis_set": result.basis_set,
    }


@router.post("/dft/homo-lumo")
def dft_homo_lumo(
    smiles: str,
    method: str = "B3LYP",
    basis_set: str = "6-31G*",
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Compute HOMO/LUMO energies and reactivity descriptors.
    """
    from app.engines.dft_engine import dft_engine

    result = dft_engine.compute_homo_lumo(smiles, method, basis_set)
    return result or {"error": "DFT engine not available"}


@router.get("/dft/methods")
def list_dft_methods(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List available DFT methods and basis sets."""
    from app.engines.dft_engine import dft_engine

    return {
        "methods": dft_engine.METHODS,
        "basis_sets": dft_engine.BASIS_SETS,
        "engine_available": dft_engine.is_available,
        "detected_engine": dft_engine.engine,
    }


# ── Molecular Dynamics Endpoints ──────────────────────────────────────

@router.post("/md/simulate")
def md_simulate(
    request: MDRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Run molecular dynamics simulation.
    Simulates molecular behavior in solution.
    """
    from app.engines.md_engine import md_engine

    result = md_engine.simulate(
        request.smiles,
        temperature=request.temperature,
        pressure=request.pressure,
        time_ns=request.time_ns,
        force_field=request.force_field,
        solvent=request.solvent,
    )

    return {
        "molecule": result.molecule,
        "force_field": result.force_field,
        "solvent": result.solvent,
        "temperature_K": result.temperature,
        "simulation_time_ns": result.simulation_time_ns,
        "average_energy_kj_mol": result.average_energy,
        "energy_std": result.energy_std,
        "rmsd_mean_A": result.rmsd_mean,
        "radius_of_gyration_A": result.radius_of_gyration,
        "aggregation_detected": result.aggregation_detected,
        "precipitation_detected": result.precipitation_detected,
        "conformational_stability": result.conformational_stability,
        "engine": result.engine,
        "available": md_engine.is_available,
    }


@router.post("/md/solvation-energy")
def md_solvation_energy(
    smiles: str,
    solvent: str = "water",
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """Compute solvation free energy."""
    from app.engines.md_engine import md_engine

    energy = md_engine.compute_solvation_energy(smiles, solvent)
    return {
        "smiles": smiles,
        "solvent": solvent,
        "solvation_energy_kj_mol": round(energy, 2),
        "engine": md_engine.engine,
    }


# ── Cloud HPC Endpoints ──────────────────────────────────────────────

@router.post("/hpc/estimate-cost")
def hpc_estimate_cost(
    job_type: str,
    molecule_size: int,
    method: str,
    provider: str = "local",
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """Estimate cost for a cloud HPC job."""
    from app.engines.hpc_orchestrator import hpc_orchestrator, CloudProvider

    provider_enum = CloudProvider(provider) if provider in [p.value for p in CloudProvider] else CloudProvider.LOCAL
    estimate = hpc_orchestrator.estimate_cost(job_type, molecule_size, method, provider_enum)
    return estimate


@router.post("/hpc/submit")
def hpc_submit_job(
    request: HPCJobRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """Submit a computation job to cloud HPC."""
    from app.engines.hpc_orchestrator import hpc_orchestrator, CloudProvider

    provider_enum = CloudProvider(request.provider) if request.provider in [p.value for p in CloudProvider] else CloudProvider.LOCAL
    job = hpc_orchestrator.submit_job(
        request.job_type, request.molecule, request.method,
        request.parameters, provider_enum,
    )

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "estimated_cost_usd": job.estimated_cost_usd,
        "provider": job.provider.value,
    }


@router.get("/hpc/jobs")
def hpc_list_jobs(
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """List all HPC jobs."""
    from app.engines.hpc_orchestrator import hpc_orchestrator

    jobs = hpc_orchestrator.list_jobs()
    return {
        "jobs": [
            {
                "job_id": j.job_id,
                "type": j.job_type,
                "status": j.status.value,
                "molecule": j.molecule,
                "estimated_cost_usd": j.estimated_cost_usd,
                "elapsed_seconds": j.elapsed_seconds,
            }
            for j in jobs
        ],
        "cost_summary": hpc_orchestrator.get_cost_summary(),
    }


@router.get("/hpc/providers")
def hpc_providers(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List available cloud HPC providers and instance types."""
    from app.engines.hpc_orchestrator import AWS_INSTANCES, GCP_INSTANCES, AZURE_INSTANCES

    return {
        "aws": {k: {"vcpus": v.vcpus, "memory_gb": v.memory_gb, "gpu": v.gpu_type, "cost_usd_h": v.cost_per_hour_usd} for k, v in AWS_INSTANCES.items()},
        "gcp": {k: {"vcpus": v.vcpus, "memory_gb": v.memory_gb, "gpu": v.gpu_type, "cost_usd_h": v.cost_per_hour_usd} for k, v in GCP_INSTANCES.items()},
        "azure": {k: {"vcpus": v.vcpus, "memory_gb": v.memory_gb, "gpu": v.gpu_type, "cost_usd_h": v.cost_per_hour_usd} for k, v in AZURE_INSTANCES.items()},
    }


# ── ChemBERTa Endpoints ──────────────────────────────────────────────

@router.post("/chemberta/embedding")
def chemberta_embedding(
    smiles: str,
    model: str = "ChemBERTa-zinc250k",
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """Get molecular embedding from ChemBERTa transformer."""
    from app.engines.chemberta import chemberta

    embedding = chemberta.get_embedding(smiles)
    if embedding is None:
        return {"error": "ChemBERTa not available. Install transformers + torch."}

    return {
        "smiles": smiles,
        "model": model,
        "embedding_dim": len(embedding),
        "embedding_preview": embedding[:20],
        "available": chemberta.is_available,
    }


@router.post("/chemberta/similarity")
def chemberta_similarity(
    smiles1: str,
    smiles2: str,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """Compute similarity using ChemBERTa embeddings (cosine similarity)."""
    from app.engines.chemberta import chemberta

    similarity = chemberta.compute_similarity_from_embeddings(smiles1, smiles2)
    if similarity is None:
        return {"error": "ChemBERTa not available"}

    return {
        "smiles1": smiles1,
        "smiles2": smiles2,
        "cosine_similarity": round(similarity, 4),
        "model": chemberta.model_name,
    }


@router.get("/chemberta/models")
def chemberta_models(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List available ChemBERTa models."""
    from app.engines.chemberta import chemberta

    return {"models": chemberta.list_models()}


# ── Literature Mining Endpoints ───────────────────────────────────────

@router.post("/literature/extract")
def literature_extract(
    request: LiteratureExtractRequest,
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """
    Extract stability data from scientific text using LLMs.
    Extracts: half-lives, Ea, solubility, pKa, excipient compatibility.
    """
    from app.engines.literature_mining import lit_mining

    source_metadata = {}
    if request.source_title:
        source_metadata["title"] = request.source_title
    if request.source_doi:
        source_metadata["doi"] = request.source_doi

    result = lit_mining.extract_from_text(
        request.text, request.extraction_type, source_metadata,
    )

    return {
        "extracted_count": len(result.extracted_data),
        "quality": round(result.extraction_quality, 3),
        "processing_time_s": round(result.processing_time_seconds, 2),
        "model": result.model_used,
        "data_points": [
            {
                "compound": dp.compound_name,
                "property": dp.property_name,
                "value": dp.value,
                "unit": dp.unit,
                "conditions": dp.conditions,
                "confidence": round(dp.confidence, 3),
            }
            for dp in result.extracted_data
        ],
        "source": {
            "title": result.source.title,
            "doi": result.source.doi,
        },
    }


@router.post("/literature/extract-doi")
def literature_extract_doi(
    doi: str,
    extraction_type: str = "stability_data",
    current_user: User = Depends(require_permission("execute:predictions")),
):
    """Extract stability data from a paper given its DOI."""
    from app.engines.literature_mining import lit_mining

    result = lit_mining.extract_from_doi(doi, extraction_type)
    if result is None:
        raise HTTPException(404, f"Could not fetch paper with DOI: {doi}")

    return {
        "extracted_count": len(result.extracted_data),
        "quality": round(result.extraction_quality, 3),
        "source": {
            "title": result.source.title,
            "doi": result.source.doi,
            "journal": result.source.journal,
            "year": result.source.year,
        },
        "data_points": [
            {
                "compound": dp.compound_name,
                "property": dp.property_name,
                "value": dp.value,
                "unit": dp.unit,
                "conditions": dp.conditions,
                "confidence": round(dp.confidence, 3),
            }
            for dp in result.extracted_data
        ],
    }


# ── Level 3 Capabilities ─────────────────────────────────────────────

@router.get("/capabilities")
def level3_capabilities(
    current_user: User = Depends(require_permission("read:molecules")),
):
    """List all Level 3 advanced computing capabilities."""
    from app.engines.dft_engine import dft_engine
    from app.engines.md_engine import md_engine
    from app.engines.chemberta import chemberta
    from app.engines.literature_mining import lit_mining

    return {
        "dft": {
            "available": dft_engine.is_available,
            "engine": dft_engine.engine,
            "methods": list(dft_engine.METHODS.keys()),
            "basis_sets": list(dft_engine.BASIS_SETS.keys()),
        },
        "molecular_dynamics": {
            "available": md_engine.is_available,
            "engine": md_engine.engine,
            "force_fields": list(md_engine.FORCE_FIELDS.keys()),
            "solvents": list(md_engine.SOLVENTS.keys()),
        },
        "cloud_hpc": {
            "providers": ["aws", "gcp", "azure", "local"],
            "job_types": ["dft", "md", "ml_training", "batch_prediction"],
        },
        "chemberta": {
            "available": chemberta.is_available,
            "models": list(chemberta.AVAILABLE_MODELS.keys()),
        },
        "literature_mining": {
            "available": lit_mining._api_key is not None,
            "providers": ["openai", "anthropic"],
            "extraction_types": ["stability_data", "arrhenius_data", "excipient_compatibility"],
        },
    }
