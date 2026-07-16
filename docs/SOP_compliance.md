# Standard Operating Procedures (SOP)
# ChemStab Industrial v5.3 — GxP Computerized System

---

## SOP-001: System Access Control

**Purpose:** Define rules for user authentication, authorization, and access management.

### 1.1 User Registration
1. New users must be approved by an Org Admin
2. Email verification required before activation
3. Minimum role: `viewer` (read-only)
4. Role assignment must be documented in audit trail

### 1.2 Password Policy
- Minimum 12 characters
- Must include: uppercase, lowercase, digit, special character
- Account lockout after 5 failed attempts (30-minute lockout)
- Password expiry: 90 days (configurable)
- No password reuse (last 12 passwords)

### 1.3 Role-Based Access Control (RBAC)

| Role | Read | Write | Execute | Approve | Admin |
|------|------|-------|---------|---------|-------|
| Viewer | Own projects | — | — | — | — |
| Analyst | Own projects | Own projects | Analysis, Predictions | — | — |
| Project Manager | Org projects | Own projects | Analysis, Predictions | Reports | — |
| Org Admin | Org projects | Org projects | All | All | Users, Settings |
| Super Admin | All | All | All | All | All |

### 1.4 Session Management
- Access token lifetime: 8 hours (GxP session limit)
- Refresh token lifetime: 30 days
- Automatic logout after 30 minutes of inactivity
- Concurrent sessions: maximum 3 per user

---

## SOP-002: Stability Study Conduct

**Purpose:** Define the procedure for conducting ICH-compliant stability studies.

### 2.1 Study Initiation
1. Create study in ChemStab with required fields:
   - Substance name, CAS number, batch number
   - Initial concentration and purity
   - Storage conditions (temperature, humidity, container)
   - Planned duration and time points
2. System auto-generates study code (STB-YYYY-NNNN)
3. Status: DRAFT

### 2.2 Study Approval Workflow
```
DRAFT → IN_PROGRESS → COMPLETED → UNDER_REVIEW → APPROVED
                                                → REJECTED (back to DRAFT)
```

### 2.3 Time Point Measurements
1. Record assay, impurities, physical tests at each time point
2. System auto-detects OOS (Out of Specification) results
3. OOS results trigger investigation requirement
4. All measurements logged in audit trail

### 2.4 Simulation and Prediction
1. Run stability simulation using Arrhenius kinetics
2. System computes shelf life (t90, t95, t99)
3. Regression analysis (ICH Q1E) with R² and confidence intervals
4. Predictions are advisory — experimental data takes precedence

### 2.5 Study Completion
1. All planned time points must be completed or justified
2. Statistical evaluation must be documented
3. Electronic signature required for approval
4. Audit trail must be intact (hash chain verified)

---

## SOP-003: Electronic Signatures (21 CFR Part 11)

**Purpose:** Define the procedure for applying and verifying electronic signatures.

### 3.1 Signature Application
1. User authenticates with credentials
2. Selects meaning (e.g., "Reviewed and Approved")
3. System computes SHA-256 hash of:
   - Study data + user ID + meaning + timestamp
4. Hash stored in audit trail with SIGN action
5. Signature is linked to specific record

### 3.2 Signature Verification
1. Retrieve signature from audit trail
2. Recompute hash from original data
3. Compare hashes — must match
4. Verify user was authorized to sign
5. Verify timestamp is within study period

### 3.3 Signature Meanings
| Meaning | Use Case |
|---------|----------|
| "Reviewed and Approved" | Study/report approval |
| "Reviewed and Rejected" | Study/report rejection |
| "Data Verified" | Time point data verification |
| "Method Validated" | Analytical method validation |
| "System Qualified" | Computer system qualification |

---

## SOP-004: Audit Trail Management

**Purpose:** Define requirements for audit trail integrity and retention.

### 4.1 What Must Be Logged
- All CREATE, UPDATE, DELETE operations on GxP data
- All electronic signatures
- All login/logout events
- All export/report generation
- All configuration changes

### 4.2 Audit Trail Integrity
- Hash chain: each entry includes SHA-256 of previous entry
- Tamper detection: chain verification available via API
- Immutable: no UPDATE or DELETE allowed on audit_log table
- Backup: daily automated backup with 7-year retention

### 4.3 Audit Trail Review
- QA must review audit trail before study approval
- Review includes: chain integrity, OOS investigations, signature validity
- Findings documented and tracked

---

## SOP-005: Data Integrity (ALCOA+)

**Purpose:** Ensure data integrity principles are followed.

### 5.1 ALCOA+ Principles

| Principle | Requirement | Implementation |
|-----------|-------------|----------------|
| **A**ttributable | Who performed the action | User ID in audit trail |
| **L**egible | Data is readable | Structured JSON logging |
| **C**ontemporaneous | Recorded at time of action | Timestamp on every entry |
| **O**riginal | First recording | No modification of original data |
| **A**ccurate | Free from errors | Input validation, OOS detection |
| **+** Complete | No data deleted | Immutable audit trail |
| **+** Consistent | Chronological order | Hash chain enforces order |
| **+** Enduring | Available for retention period | 7-year backup policy |
| **+** Available | Accessible when needed | Database indexing, search |

---

## SOP-006: Computer System Validation (CSV)

**Purpose:** Define the validation lifecycle for ChemStab.

### 6.1 Validation Phases
1. **IQ (Installation Qualification):** Verify software installed correctly
2. **OQ (Operational Qualification):** Verify functions work as specified
3. **PQ (Performance Qualification):** Verify system performs under load

### 6.2 Validation Evidence
- Requirements traceability matrix
- Test protocols and results
- Deviation reports and resolutions
- Validation summary report

### 6.3 Periodic Review
- Annual review of system configuration
- Re-validation after major updates
- Change control for all modifications
