"""
GxP Audit Service — 21 CFR Part 11 compliant audit trail.
All operations are logged with full context. Immutable records.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import hashlib
import json

from app.models.audit import AuditEvent, AuditExport
from app.core.config import settings


def log_event(
    db: Session,
    user_id: int,
    org_id: int,
    event_type: str,
    resource_type: str,
    action: str,
    resource_id: Optional[int] = None,
    details: Optional[Dict] = None,
    old_values: Optional[Dict] = None,
    new_values: Optional[Dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    session_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> AuditEvent:
    """
    Create an immutable audit trail entry.
    21 CFR Part 11 §11.10(e): Audit trails must record date/time, operator ID, and nature of action.
    """
    event = AuditEvent(
        org_id=org_id,
        user_id=user_id,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        details=details,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
        session_id=session_id,
        request_id=request_id,
    )
    db.add(event)
    db.flush()
    return event


def sign_event(
    db: Session,
    event_id: int,
    user_id: int,
    meaning: str = "Reviewed and Approved",
) -> AuditEvent:
    """
    Apply electronic signature to an audit event.
    21 CFR Part 11 §11.50: Signed records shall contain:
    - Printed name of signer
    - Date and time of signing
    - Meaning of signature
    """
    event = db.query(AuditEvent).filter(AuditEvent.id == event_id).first()
    if not event:
        raise ValueError(f"Audit event {event_id} not found")

    # Compute signature hash
    sig_data = f"{event.id}|{event.event_type}|{event.action}|{user_id}|{meaning}"
    sig_hash = hashlib.sha256(sig_data.encode()).hexdigest()

    event.is_signed = "Y"
    event.signature_hash = sig_hash
    event.signature_meaning = meaning

    # Log the signing event itself
    log_event(
        db=db,
        user_id=user_id,
        org_id=event.org_id,
        event_type="SIGN",
        resource_type="AuditEvent",
        resource_id=event_id,
        action=f"Electronic signature applied: {meaning}",
        details={"signature_hash": sig_hash, "original_event": event.action},
    )

    return event


def get_audit_trail(
    db: Session,
    org_id: int,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    event_type: Optional[str] = None,
    user_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[AuditEvent]:
    """Query audit trail with filters. Read-only — never modifies records."""
    query = db.query(AuditEvent).filter(AuditEvent.org_id == org_id)

    if resource_type:
        query = query.filter(AuditEvent.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditEvent.resource_id == resource_id)
    if event_type:
        query = query.filter(AuditEvent.event_type == event_type)
    if user_id:
        query = query.filter(AuditEvent.user_id == user_id)
    if date_from:
        query = query.filter(AuditEvent.created_at >= date_from)
    if date_to:
        query = query.filter(AuditEvent.created_at <= date_to)

    return query.order_by(desc(AuditEvent.created_at)).offset(offset).limit(limit).all()


def export_audit_trail(
    db: Session,
    org_id: int,
    exported_by: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    resource_type: Optional[str] = None,
    event_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Export audit trail for regulatory submission.
    Returns JSON with all records and integrity hash.
    """
    events = get_audit_trail(
        db=db,
        org_id=org_id,
        resource_type=resource_type,
        event_type=event_type,
        date_from=date_from,
        date_to=date_to,
        limit=100000,
    )

    export_data = {
        "export_metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "exported_by": exported_by,
            "org_id": org_id,
            "date_range": {
                "from": date_from.isoformat() if date_from else None,
                "to": date_to.isoformat() if date_to else None,
            },
            "total_records": len(events),
            "filters": {
                "resource_type": resource_type,
                "event_type": event_type,
            },
        },
        "events": [],
    }

    for event in events:
        export_data["events"].append({
            "id": event.id,
            "timestamp": event.created_at.isoformat() if event.created_at else None,
            "user_id": event.user_id,
            "event_type": event.event_type,
            "resource_type": event.resource_type,
            "resource_id": event.resource_id,
            "action": event.action,
            "details": event.details,
            "old_values": event.old_values,
            "new_values": event.new_values,
            "ip_address": event.ip_address,
            "is_signed": event.is_signed,
            "signature_hash": event.signature_hash,
            "signature_meaning": event.signature_meaning,
        })

    # Compute integrity hash
    export_json = json.dumps(export_data, sort_keys=True, default=str)
    file_hash = hashlib.sha256(export_json.encode()).hexdigest()
    export_data["integrity_hash"] = file_hash

    # Record the export itself
    export_record = AuditExport(
        org_id=org_id,
        exported_by=exported_by,
        date_from=date_from,
        date_to=date_to,
        resource_type=resource_type,
        event_type=event_type,
        total_records=len(events),
        file_hash=file_hash,
    )
    db.add(export_record)
    db.commit()

    return export_data


def get_user_activity_summary(
    db: Session,
    org_id: int,
    user_id: int,
    days: int = 30,
) -> Dict[str, Any]:
    """Get summary of user activity for compliance reporting."""
    since = datetime.utcnow() - timedelta(days=days)

    events = db.query(AuditEvent).filter(
        and_(
            AuditEvent.org_id == org_id,
            AuditEvent.user_id == user_id,
            AuditEvent.created_at >= since,
        )
    ).all()

    summary = {
        "user_id": user_id,
        "period_days": days,
        "total_actions": len(events),
        "by_type": {},
        "by_resource": {},
        "signed_count": sum(1 for e in events if e.is_signed == "Y"),
        "first_action": min((e.created_at for e in events), default=None),
        "last_action": max((e.created_at for e in events), default=None),
    }

    for event in events:
        summary["by_type"][event.event_type] = summary["by_type"].get(event.event_type, 0) + 1
        summary["by_resource"][event.resource_type] = summary["by_resource"].get(event.resource_type, 0) + 1

    return summary
