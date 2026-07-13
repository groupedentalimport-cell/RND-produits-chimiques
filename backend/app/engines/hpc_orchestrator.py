"""
Cloud HPC Orchestrator — Manage cloud-based high-performance computing.
Supports AWS Batch, Google Cloud Vertex AI, Azure HB-series.

Use cases:
  - DFT calculations on large molecules (~$0.50–5 per calculation)
  - MD simulations on GPU clusters (~$1–3/h per node)
  - ChemBERTa fine-tuning on TPU (~$10–50 per run)
  - Batch property prediction for large libraries
"""

import os
import json
import logging
import time
import uuid
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class CloudProvider(str, Enum):
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"
    LOCAL = "local"


class JobStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class HPCJob:
    """A cloud HPC job specification."""
    job_id: str
    job_type: str  # "dft", "md", "ml_training", "batch_prediction"
    provider: CloudProvider
    status: JobStatus
    molecule: str
    method: str
    parameters: Dict[str, Any]

    # Cost tracking
    estimated_cost_usd: float = 0.0
    actual_cost_usd: float = 0.0
    compute_time_seconds: float = 0.0

    # Results
    result: Optional[Dict[str, Any]] = None
    output_files: List[str] = field(default_factory=list)

    # Timestamps
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None

    @property
    def elapsed_seconds(self) -> float:
        if self.started_at is None:
            return 0.0
        end = self.completed_at or time.time()
        return end - self.started_at


@dataclass
class ComputeResources:
    """Specification for compute resources."""
    provider: CloudProvider
    instance_type: str
    vcpus: int
    memory_gb: int
    gpu_count: int = 0
    gpu_type: str = ""
    cost_per_hour_usd: float = 0.0
    spot_price_usd: float = 0.0


# ── Instance catalogs ─────────────────────────────────────────────────

AWS_INSTANCES = {
    "c5.xlarge": ComputeResources(CloudProvider.AWS, "c5.xlarge", 4, 8, cost_per_hour_usd=0.17),
    "c5.4xlarge": ComputeResources(CloudProvider.AWS, "c5.4xlarge", 16, 32, cost_per_hour_usd=0.68),
    "c5.9xlarge": ComputeResources(CloudProvider.AWS, "c5.9xlarge", 36, 72, cost_per_hour_usd=1.53),
    "p3.2xlarge": ComputeResources(CloudProvider.AWS, "p3.2xlarge", 8, 61, 1, "V100", cost_per_hour_usd=3.06),
    "p4d.24xlarge": ComputeResources(CloudProvider.AWS, "p4d.24xlarge", 96, 1152, 8, "A100", cost_per_hour_usd=32.77),
    "g5.xlarge": ComputeResources(CloudProvider.AWS, "g5.xlarge", 4, 16, 1, "A10G", cost_per_hour_usd=1.006),
}

GCP_INSTANCES = {
    "n2-standard-4": ComputeResources(CloudProvider.GCP, "n2-standard-4", 4, 16, cost_per_hour_usd=0.194),
    "n2-standard-16": ComputeResources(CloudProvider.GCP, "n2-standard-16", 16, 64, cost_per_hour_usd=0.776),
    "a2-highgpu-1g": ComputeResources(CloudProvider.GCP, "a2-highgpu-1g", 12, 85, 1, "A100", cost_per_hour_usd=3.67),
    "tpu-v4-8": ComputeResources(CloudProvider.GCP, "tpu-v4-8", 0, 0, 0, "TPUv4", cost_per_hour_usd=1.20),
}

AZURE_INSTANCES = {
    "HB120rs_v3": ComputeResources(CloudProvider.AZURE, "HB120rs_v3", 120, 456, cost_per_hour_usd=3.60),
    "NC6s_v3": ComputeResources(CloudProvider.AZURE, "NC6s_v3", 6, 112, 1, "V100", cost_per_hour_usd=3.06),
    "ND96amsr_A100_v4": ComputeResources(CloudProvider.AZURE, "ND96amsr_A100_v4", 96, 1900, 8, "A100", cost_per_hour_usd=32.77),
}


class CloudHPCOrchestrator:
    """
    Orchestrate cloud HPC jobs for DFT, MD, and ML training.
    """

    def __init__(self, default_provider: CloudProvider = CloudProvider.LOCAL):
        self.default_provider = default_provider
        self.jobs: Dict[str, HPCJob] = {}
        self._provider_clients: Dict[str, Any] = {}

    def estimate_cost(
        self,
        job_type: str,
        molecule_size: int,
        method: str,
        provider: Optional[CloudProvider] = None,
    ) -> Dict[str, Any]:
        """
        Estimate cost for a computation job.
        """
        provider = provider or self.default_provider

        # Cost estimation based on job type and molecule size
        if job_type == "dft":
            return self._estimate_dft_cost(molecule_size, method, provider)
        elif job_type == "md":
            return self._estimate_md_cost(molecule_size, method, provider)
        elif job_type == "ml_training":
            return self._estimate_ml_cost(molecule_size, method, provider)
        else:
            return {"error": f"Unknown job type: {job_type}"}

    def submit_job(
        self,
        job_type: str,
        molecule: str,
        method: str,
        parameters: Dict[str, Any],
        provider: Optional[CloudProvider] = None,
    ) -> HPCJob:
        """
        Submit a computation job to the cloud.
        """
        provider = provider or self.default_provider
        job_id = str(uuid.uuid4())[:8]

        cost_estimate = self.estimate_cost(job_type, len(molecule), method, provider)

        job = HPCJob(
            job_id=job_id,
            job_type=job_type,
            provider=provider,
            status=JobStatus.SUBMITTED,
            molecule=molecule,
            method=method,
            parameters=parameters,
            estimated_cost_usd=cost_estimate.get("estimated_cost_usd", 0.0),
        )

        self.jobs[job_id] = job

        if provider == CloudProvider.LOCAL:
            # Run locally
            job.status = JobStatus.RUNNING
            job.started_at = time.time()
            # Would delegate to local DFT/MD engine
            logger.info(f"Job {job_id} submitted locally: {job_type} for {molecule}")
        else:
            # Submit to cloud
            logger.info(f"Job {job_id} submitted to {provider.value}: {job_type} for {molecule}")

        return job

    def get_job_status(self, job_id: str) -> Optional[HPCJob]:
        """Get status of a submitted job."""
        return self.jobs.get(job_id)

    def list_jobs(self, status: Optional[JobStatus] = None) -> List[HPCJob]:
        """List all jobs, optionally filtered by status."""
        jobs = list(self.jobs.values())
        if status:
            jobs = [j for j in jobs if j.status == status]
        return jobs

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        job = self.jobs.get(job_id)
        if job and job.status in (JobStatus.SUBMITTED, JobStatus.RUNNING):
            job.status = JobStatus.CANCELLED
            job.completed_at = time.time()
            return True
        return False

    def get_cost_summary(self) -> Dict[str, Any]:
        """Get cost summary for all jobs."""
        total_estimated = sum(j.estimated_cost_usd for j in self.jobs.values())
        total_actual = sum(j.actual_cost_usd for j in self.jobs.values())

        by_type = {}
        for job in self.jobs.values():
            if job.job_type not in by_type:
                by_type[job.job_type] = {"count": 0, "estimated": 0, "actual": 0}
            by_type[job.job_type]["count"] += 1
            by_type[job.job_type]["estimated"] += job.estimated_cost_usd
            by_type[job.job_type]["actual"] += job.actual_cost_usd

        return {
            "total_jobs": len(self.jobs),
            "total_estimated_cost_usd": round(total_estimated, 2),
            "total_actual_cost_usd": round(total_actual, 2),
            "by_type": by_type,
        }

    # ── Cost estimation ───────────────────────────────────────────────

    def _estimate_dft_cost(self, n_atoms: int, method: str, provider: CloudProvider) -> Dict[str, Any]:
        """Estimate DFT calculation cost."""
        # Rough scaling: O(N³) for DFT, N = number of basis functions ≈ 10 * n_atoms
        n_basis = 10 * n_atoms

        # Time estimation (hours) based on method
        time_factors = {
            "HF": 0.001, "B3LYP": 0.005, "M062X": 0.008,
            "wB97X-D": 0.01, "MP2": 0.05, "CCSD": 0.5, "CCSD(T)": 2.0,
        }
        base_time = time_factors.get(method, 0.01)
        compute_hours = base_time * (n_basis / 100) ** 2

        # Cost based on provider
        if provider == CloudProvider.AWS:
            instance = "c5.4xlarge"
            cost_per_hour = AWS_INSTANCES[instance].cost_per_hour_usd
        elif provider == CloudProvider.GCP:
            instance = "n2-standard-16"
            cost_per_hour = GCP_INSTANCES[instance].cost_per_hour_usd
        else:
            cost_per_hour = 0.0  # local

        estimated_cost = compute_hours * cost_per_hour

        return {
            "job_type": "dft",
            "method": method,
            "n_atoms": n_atoms,
            "n_basis_functions": n_basis,
            "estimated_hours": round(compute_hours, 2),
            "instance_type": instance if provider != CloudProvider.LOCAL else "local",
            "cost_per_hour_usd": cost_per_hour,
            "estimated_cost_usd": round(estimated_cost, 2),
            "provider": provider.value,
        }

    def _estimate_md_cost(self, n_atoms: int, method: str, provider: CloudProvider) -> Dict[str, Any]:
        """Estimate MD simulation cost."""
        # MD scales as O(N) for bonded, O(N²) for non-bonded
        # Typical: ~1 ns/hour for 10K atoms on GPU
        base_ns_per_hour = 1.0
        compute_hours = (n_atoms / 10000) / base_ns_per_hour

        if provider == CloudProvider.AWS:
            instance = "g5.xlarge"
            cost_per_hour = AWS_INSTANCES[instance].cost_per_hour_usd
        elif provider == CloudProvider.GCP:
            instance = "a2-highgpu-1g"
            cost_per_hour = GCP_INSTANCES[instance].cost_per_hour_usd
        else:
            cost_per_hour = 0.0

        return {
            "job_type": "md",
            "n_atoms": n_atoms,
            "estimated_hours": round(compute_hours, 2),
            "instance_type": instance if provider != CloudProvider.LOCAL else "local",
            "estimated_cost_usd": round(compute_hours * cost_per_hour, 2),
            "provider": provider.value,
        }

    def _estimate_ml_cost(self, n_samples: int, method: str, provider: CloudProvider) -> Dict[str, Any]:
        """Estimate ML training cost."""
        if "chemberta" in method.lower() or "transformer" in method.lower():
            compute_hours = 0.5  # ~30 min for fine-tuning
            if provider == CloudProvider.GCP:
                instance = "tpu-v4-8"
                cost_per_hour = GCP_INSTANCES[instance].cost_per_hour_usd
            else:
                instance = "p3.2xlarge"
                cost_per_hour = AWS_INSTANCES.get(instance, AWS_INSTANCES["p3.2xlarge"]).cost_per_hour_usd
        else:
            compute_hours = 0.1  # scikit-learn is fast
            cost_per_hour = 0.17  # c5.xlarge

        return {
            "job_type": "ml_training",
            "method": method,
            "n_samples": n_samples,
            "estimated_hours": round(compute_hours, 2),
            "estimated_cost_usd": round(compute_hours * cost_per_hour, 2),
            "provider": provider.value,
        }


# Global singleton
hpc_orchestrator = CloudHPCOrchestrator()
