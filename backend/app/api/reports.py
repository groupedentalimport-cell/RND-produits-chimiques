"""
Reports API — Generate ICH/FDA/EMA compliant reports.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import io

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.user import User
from app.models.project import Project, Analysis, Substance
from app.services.regulatory_reports import RegulatoryReportGenerator
from app.services.gxp_audit import log_event

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReportRequest(BaseModel):
    analysis_id: int
    format: str = "pdf"  # pdf, docx, xlsx


@router.post("/generate")
def generate_report(
    request: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("write:reports")),
):
    """Generate an ICH-compliant regulatory report."""
    analysis = db.query(Analysis).filter(Analysis.id == request.analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    project = db.query(Project).filter(Project.id == analysis.project_id).first()
    if project.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    substances = db.query(Substance).filter(Substance.project_id == project.id).all()

    generator = RegulatoryReportGenerator(company_name="ChemStab Industrial")

    analysis_data = {
        "id": analysis.id,
        "overall_score": analysis.overall_score,
        "overall_severity": analysis.risk_level,
        "risks": analysis.results.get("risks", {}) if analysis.results else {},
        "recommendations": analysis.results.get("recommendations", []) if analysis.results else [],
        "kinetics_results": analysis.kinetics_results,
        "qspr_predictions": analysis.qspr_predictions,
    }

    project_data = {
        "name": project.name,
        "product_type": project.product_type,
        "formulation_type": project.formulation_type,
        "target_market": project.target_market,
        "code": project.code,
        "version": project.version,
        "is_gxp_critical": project.is_gxp_critical,
    }

    substances_data = [
        {
            "name": s.name,
            "cas_number": s.cas_number,
            "formula": s.formula,
            "molar_mass": s.molar_mass,
            "concentration": s.concentration,
            "concentration_unit": s.concentration_unit,
            "purity": s.purity,
            "grade": s.grade,
        }
        for s in substances
    ]

    signature = None
    if analysis.is_signed:
        signature = {
            "signed_by": str(analysis.signed_by),
            "meaning": analysis.signature_meaning,
            "timestamp": analysis.signed_at.isoformat() if analysis.signed_at else "",
            "signature_hash": analysis.signature_hash,
        }

    # Generate report
    if request.format == "pdf":
        content = generator.generate_pdf(analysis_data, project_data, substances_data, signature)
        media_type = "application/pdf"
        filename = f"stability_report_{analysis.id}.pdf"
    elif request.format == "docx":
        content = generator.generate_docx(analysis_data, project_data, substances_data, signature)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"stability_report_{analysis.id}.docx"
    elif request.format == "xlsx":
        content = generator.generate_xlsx(analysis_data, substances_data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"stability_report_{analysis.id}.xlsx"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {request.format}")

    # Audit
    log_event(
        db=db, user_id=current_user.id, org_id=current_user.org_id,
        event_type="EXPORT", resource_type="Report", resource_id=analysis.id,
        action=f"Generated {request.format.upper()} report for analysis #{analysis.id}",
        details={"format": request.format, "filename": filename},
    )
    db.commit()

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
