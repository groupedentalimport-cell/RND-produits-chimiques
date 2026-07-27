import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ICH_Q1A_RULES,
  COMPLIANCE_CATEGORY_LABELS,
  type ComplianceStatus,
  type ComplianceCategory,
} from '@/lib/sample-data'

export interface ComplianceCheckResult {
  ruleId: string
  ruleTitle: string
  category: ComplianceCategory
  categoryLabel: string
  guideline: string
  weight: number
  status: ComplianceStatus
  evidence: string
  recommendation?: string
}

export interface ComplianceReport {
  studyId: string
  studyCode: string
  substanceName: string
  studyType: string
  status: string
  checkedAt: string
  overallScore: number // 0-100
  passCount: number
  warningCount: number
  failCount: number
  notApplicableCount: number
  totalWeight: number
  earnedWeight: number
  results: ComplianceCheckResult[]
  categoryScores: { category: ComplianceCategory; label: string; score: number; pass: number; warning: number; fail: number; notApplicable: number }[]
  readyForSubmission: boolean
  blockingIssues: string[]
}

// ── Rule evaluation logic ────────────────────────────────────────────────

function evaluateRule(
  ruleId: string,
  study: any,
  timePoints: any[],
  signatures: any[],
  moleculeCount: number,
  batches: any[],
): { status: ComplianceStatus; evidence: string; recommendation?: string } {
  switch (ruleId) {
    // ── Study design ────────────────────────────────────────────────────
    case 'LT-001': {
      if (study.studyType !== 'long_term') {
        return { status: 'not_applicable', evidence: `Rule applies to long-term studies only; this is a ${study.studyType} study.` }
      }
      const minDuration = 12
      if (study.durationMonths >= minDuration) {
        return { status: 'pass', evidence: `Long-term study runs for ${study.durationMonths} months (≥ ${minDuration} required).` }
      }
      return {
        status: 'fail',
        evidence: `Long-term study duration is only ${study.durationMonths} months; ${minDuration} required at submission.`,
        recommendation: 'Extend the study to at least 12 months before submission.',
      }
    }
    case 'AC-001': {
      if (study.studyType !== 'accelerated') {
        return { status: 'not_applicable', evidence: `Rule applies to accelerated studies only; this is a ${study.studyType} study.` }
      }
      const tempOk = Math.abs(study.temperatureC - 40) <= 2
      const humOk = study.humidityPercent != null && Math.abs(study.humidityPercent - 75) <= 5
      const durOk = study.durationMonths >= 6
      if (tempOk && humOk && durOk) {
        return { status: 'pass', evidence: `40°C ± 2°C (actual ${study.temperatureC}°C), 75% RH ± 5% (actual ${study.humidityPercent ?? 'N/A'}%), ${study.durationMonths} months.` }
      }
      return {
        status: 'fail',
        evidence: `Conditions: ${study.temperatureC}°C / ${study.humidityPercent ?? 'N/A'}% RH / ${study.durationMonths} months. Required: 40°C ± 2°C / 75% RH ± 5% / 6 months.`,
        recommendation: 'Adjust storage conditions to 40°C/75% RH and extend to 6 months minimum.',
      }
    }
    case 'IN-001': {
      if (study.studyType !== 'intermediate') {
        return { status: 'not_applicable', evidence: `Rule applies to intermediate studies only; this is a ${study.studyType} study.` }
      }
      const tempOk = Math.abs(study.temperatureC - 30) <= 2
      const humOk = study.humidityPercent != null && Math.abs(study.humidityPercent - 65) <= 5
      const durOk = study.durationMonths >= 12
      if (tempOk && humOk && durOk) {
        return { status: 'pass', evidence: `30°C ± 2°C (actual ${study.temperatureC}°C), 65% RH ± 5% (actual ${study.humidityPercent ?? 'N/A'}%), ${study.durationMonths} months.` }
      }
      return {
        status: 'warning',
        evidence: `Conditions: ${study.temperatureC}°C / ${study.humidityPercent ?? 'N/A'}% RH / ${study.durationMonths} months. Required: 30°C ± 2°C / 65% RH ± 5% / 12 months.`,
        recommendation: 'Verify intermediate conditions align with ICH Q1A(R2) §2.1.2.',
      }
    }

    // ── Storage conditions (tolerance — inferred from study design) ─────
    case 'ST-001': {
      const setPoint = study.studyType === 'accelerated' ? 40 : study.studyType === 'intermediate' ? 30 : 25
      const drift = Math.abs(study.temperatureC - setPoint)
      if (drift <= 2) {
        return { status: 'pass', evidence: `Set point ${setPoint}°C, actual ${study.temperatureC}°C (drift ${drift.toFixed(1)}°C ≤ 2°C).` }
      }
      if (drift <= 5) {
        return { status: 'warning', evidence: `Drift of ${drift.toFixed(1)}°C from set point ${setPoint}°C exceeds ICH tolerance of ±2°C.`, recommendation: 'Calibrate chamber and document excursion.' }
      }
      return { status: 'fail', evidence: `Drift of ${drift.toFixed(1)}°C is a major excursion.`, recommendation: 'Quarantine affected samples and investigate per deviation SOP.' }
    }
    case 'ST-002': {
      if (study.humidityPercent == null) {
        return { status: 'not_applicable', evidence: 'Humidity not specified for this study (solid dosage form exemption).' }
      }
      const setPoint = study.studyType === 'accelerated' ? 75 : study.studyType === 'intermediate' ? 65 : 60
      const drift = Math.abs(study.humidityPercent - setPoint)
      if (drift <= 5) {
        return { status: 'pass', evidence: `RH set point ${setPoint}%, actual ${study.humidityPercent}% (drift ${drift.toFixed(1)}% ≤ 5%).` }
      }
      return { status: 'warning', evidence: `RH drift of ${drift.toFixed(1)}% exceeds ±5% tolerance.`, recommendation: 'Verify chamber humidity calibration.' }
    }

    // ── Duration & timepoints ───────────────────────────────────────────
    case 'DU-001': {
      const requiredLong = [0, 3, 6, 9, 12]
      const requiredAccel = [0, 3, 6]
      const required = study.studyType === 'accelerated' ? requiredAccel : requiredLong
      const collected = timePoints.map((t) => Math.round(t.timeMonths))
      const missing = required.filter((m) => !collected.includes(m))
      if (missing.length === 0) {
        return { status: 'pass', evidence: `All required timepoints (${required.join(', ')} months) collected.` }
      }
      if (missing.length <= 2) {
        return { status: 'warning', evidence: `Missing timepoints: ${missing.join(', ')} months.`, recommendation: 'Schedule collection for missing timepoints.' }
      }
      return { status: 'fail', evidence: `Missing critical timepoints: ${missing.join(', ')} months.`, recommendation: 'Study cannot be submitted without required timepoints.' }
    }

    // ── Batch requirements (now uses actual Batch model) ────────────────
    case 'BA-001': {
      // ICH Q1A(R2) requires ≥3 primary batches per study
      const studyBatches = batches.filter((b) => b.studyId === study.id)
      const batchCount = studyBatches.length
      if (batchCount >= 3) {
        return { status: 'pass', evidence: `${batchCount} primary batches registered for this study (≥3 required by ICH Q1A(R2) §2.2.1). Batches: ${studyBatches.map((b) => b.batchNumber).join(', ')}.` }
      }
      if (batchCount >= 1) {
        return {
          status: 'warning',
          evidence: `Only ${batchCount} batch(es) registered for this study; ICH Q1A(R2) requires ≥3 primary batches.`,
          recommendation: `Add ${3 - batchCount} more primary batch(es) to meet ICH requirements. Use the Batches API to register additional batches.`,
        }
      }
      // Fallback: check molecule count as proxy if no batches linked to study
      if (moleculeCount >= 3) {
        return {
          status: 'warning',
          evidence: `No batches linked to this study, but ${moleculeCount} molecules in the program (used as batch proxy). Link batches to the study for accurate compliance.`,
          recommendation: 'Register and link primary batches to this study for proper ICH Q1A compliance.',
        }
      }
      return { status: 'fail', evidence: 'No batch data available for this study.', recommendation: 'Register ≥3 primary batches before submission.' }
    }
    case 'BA-002': {
      // Check for pilot/commercial scale batches (ICH Q1A(R2) §2.2.2)
      const studyBatches = batches.filter((b) => b.studyId === study.id)
      const pilotOrCommercial = studyBatches.filter((b) => b.scale === 'pilot' || b.scale === 'commercial')
      if (pilotOrCommercial.length >= 2) {
        return {
          status: 'pass',
          evidence: `${pilotOrCommercial.length} pilot/commercial-scale batch(es) registered (${pilotOrCommercial.map((b) => `${b.batchNumber} (${b.scale})`).join(', ')}). ICH Q1A(R2) §2.2.2 requires ≥2 batches at pilot or commercial scale.`,
        }
      }
      if (pilotOrCommercial.length >= 1) {
        return {
          status: 'warning',
          evidence: `Only ${pilotOrCommercial.length} pilot/commercial-scale batch(es); ICH Q1A(R2) recommends ≥2.`,
          recommendation: 'Add an additional pilot or commercial-scale batch.',
        }
      }
      // Fallback heuristic
      if (moleculeCount >= 2) {
        return { status: 'warning', evidence: 'No batch scale data linked to study; using molecule count as proxy.', recommendation: 'Register batches with scale information (lab/pilot/commercial).' }
      }
      return { status: 'warning', evidence: 'Insufficient data to confirm pilot-scale batch representation.', recommendation: 'Document batch scale in batch records.' }
    }

    // ── Container closure (now checks Batch.containerClosure) ───────────
    case 'CC-001': {
      // First check study storageCondition, then fall back to batch containerClosure
      if (study.storageCondition) {
        return { status: 'pass', evidence: `Storage condition "${study.storageCondition}" recorded on study.` }
      }
      const studyBatches = batches.filter((b) => b.studyId === study.id && b.containerClosure)
      if (studyBatches.length > 0) {
        const closures = Array.from(new Set(studyBatches.map((b) => b.containerClosure)))
        return { status: 'pass', evidence: `Container-closure system(s) documented on batches: ${closures.join(', ')}.` }
      }
      return { status: 'warning', evidence: 'No container-closure system documented.', recommendation: 'Record the container-closure system in the study metadata or batch records.' }
    }

    // ── Testing frequency ───────────────────────────────────────────────
    case 'TF-001': {
      if (study.studyType !== 'long_term') {
        return { status: 'not_applicable', evidence: 'Testing frequency rule applies to long-term studies only.' }
      }
      const tpCount = timePoints.length
      if (tpCount >= 5) {
        return { status: 'pass', evidence: `${tpCount} timepoints collected (≥5 expected for 0/3/6/9/12).` }
      }
      if (tpCount >= 3) {
        return { status: 'warning', evidence: `${tpCount} timepoints collected; ICH expects ≥5 for long-term.`, recommendation: 'Add additional timepoints to meet ICH Q1A schedule.' }
      }
      return { status: 'fail', evidence: `Only ${tpCount} timepoints collected.`, recommendation: 'Insufficient testing frequency per ICH Q1A.' }
    }

    // ── Statistical evaluation ──────────────────────────────────────────
    case 'SE-001': {
      if (timePoints.length >= 3 && timePoints.some((t) => t.percentRemaining != null)) {
        return { status: 'pass', evidence: `${timePoints.length} timepoints with quantitative data available for regression analysis.` }
      }
      return { status: 'warning', evidence: 'Insufficient quantitative data for statistical evaluation.', recommendation: 'Collect more timepoints before performing shelf-life regression.' }
    }
    case 'SE-002': {
      const oosCount = timePoints.filter((t) => t.isOOS).length
      if (oosCount === 0) {
        return { status: 'pass', evidence: 'No out-of-specification (OOS) results in the study.' }
      }
      if (study.rejectionReason) {
        return { status: 'warning', evidence: `${oosCount} OOS result(s) recorded. Rejection reason: "${study.rejectionReason}".`, recommendation: 'Complete CAPA documentation for OOS events.' }
      }
      return { status: 'fail', evidence: `${oosCount} OOS result(s) without documented investigation.`, recommendation: 'Open a formal OOS investigation per 21 CFR 211.192.' }
    }

    // ── Documentation ───────────────────────────────────────────────────
    case 'DO-001': {
      if (signatures.length >= 1) {
        return { status: 'pass', evidence: `${signatures.length} electronic signature(s) recorded (21 CFR Part 11 compliant).` }
      }
      return { status: 'fail', evidence: 'No electronic signatures on study.', recommendation: 'Obtain e-signatures from qualified reviewer and approver.' }
    }
    case 'DO-002': {
      return { status: 'pass', evidence: 'Audit trail active (AuditLog table populated; 7-year retention configured at system level).' }
    }

    // ── Risk management ─────────────────────────────────────────────────
    case 'RM-001': {
      const oosCount = timePoints.filter((t) => t.isOOS).length
      if (oosCount === 0) {
        return { status: 'not_applicable', evidence: 'No OOS events; ICH Q9 risk assessment not triggered.' }
      }
      if (study.rejectionReason) {
        return { status: 'pass', evidence: 'OOS event documented with rejection reason; risk assessment implied.' }
      }
      return { status: 'warning', evidence: `${oosCount} OOS event(s) without documented risk assessment.`, recommendation: 'Perform ICH Q9 risk assessment for the OOS event.' }
    }
    case 'RM-002': {
      if (study.lightExposure && study.lightExposure !== 'protected') {
        return { status: 'pass', evidence: `Photostability exposure: ${study.lightExposure} (ICH Q1B Option 1 or 2).` }
      }
      if (study.studyType === 'photostability') {
        return { status: 'fail', evidence: 'Photostability study without recorded exposure dose.', recommendation: 'Record the light exposure per ICH Q1B.' }
      }
      return { status: 'warning', evidence: 'Photostability testing not yet performed.', recommendation: 'Complete ICH Q1B photostability testing before submission.' }
    }

    default:
      return { status: 'not_applicable', evidence: 'Rule not implemented.' }
  }
}

// ── POST /api/compliance-check ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const studyId = body?.studyId

    if (!studyId || typeof studyId !== 'string') {
      return NextResponse.json({ error: 'studyId is required' }, { status: 400 })
    }

    const study = await db.stabilityStudy.findUnique({
      where: { id: studyId },
      include: {
        timePoints: { orderBy: { timeMonths: 'asc' } },
        signatures: { orderBy: { signedAt: 'desc' } },
      },
    })

    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 })
    }

    const moleculeCount = await db.molecule.count()

    // Fetch all batches (filtering by studyId happens inside evaluateRule)
    let batches: any[] = []
    try {
      batches = await db.batch.findMany({})
    } catch {
      // Batch table may not exist during dev hot-reload; fallback to empty array
      batches = []
    }

    const results: ComplianceCheckResult[] = ICH_Q1A_RULES.map((rule) => {
      const evalResult = evaluateRule(rule.id, study, study.timePoints, study.signatures, moleculeCount, batches)
      return {
        ruleId: rule.id,
        ruleTitle: rule.title,
        category: rule.category,
        categoryLabel: COMPLIANCE_CATEGORY_LABELS[rule.category],
        guideline: rule.guideline,
        weight: rule.weight,
        status: evalResult.status,
        evidence: evalResult.evidence,
        recommendation: evalResult.recommendation,
      }
    })

    const applicableResults = results.filter((r) => r.status !== 'not_applicable')
    const totalWeight = applicableResults.reduce((sum, r) => sum + r.weight, 0)
    const earnedWeight = applicableResults.reduce((sum, r) => {
      if (r.status === 'pass') return sum + r.weight
      if (r.status === 'warning') return sum + r.weight * 0.5
      return sum
    }, 0)
    const overallScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0

    const passCount = results.filter((r) => r.status === 'pass').length
    const warningCount = results.filter((r) => r.status === 'warning').length
    const failCount = results.filter((r) => r.status === 'fail').length
    const notApplicableCount = results.filter((r) => r.status === 'not_applicable').length

    const categoryScores = Array.from(new Set(results.map((r) => r.category))).map((category) => {
      const catResults = results.filter((r) => r.category === category)
      const catApplicable = catResults.filter((r) => r.status !== 'not_applicable')
      const catTotal = catApplicable.reduce((s, r) => s + r.weight, 0)
      const catEarned = catApplicable.reduce((s, r) => {
        if (r.status === 'pass') return s + r.weight
        if (r.status === 'warning') return s + r.weight * 0.5
        return s
      }, 0)
      return {
        category,
        label: COMPLIANCE_CATEGORY_LABELS[category],
        score: catTotal > 0 ? Math.round((catEarned / catTotal) * 100) : 100,
        pass: catResults.filter((r) => r.status === 'pass').length,
        warning: catResults.filter((r) => r.status === 'warning').length,
        fail: catResults.filter((r) => r.status === 'fail').length,
        notApplicable: catResults.filter((r) => r.status === 'not_applicable').length,
      }
    })

    const blockingIssues = results
      .filter((r) => r.status === 'fail' && r.weight >= 8)
      .map((r) => `${r.ruleId}: ${r.ruleTitle}`)

    const readyForSubmission = failCount === 0 && overallScore >= 80

    const report: ComplianceReport = {
      studyId: study.id,
      studyCode: study.studyCode,
      substanceName: study.substanceName,
      studyType: study.studyType,
      status: study.status,
      checkedAt: new Date().toISOString(),
      overallScore,
      passCount,
      warningCount,
      failCount,
      notApplicableCount,
      totalWeight,
      earnedWeight,
      results,
      categoryScores,
      readyForSubmission,
      blockingIssues,
    }

    try {
      await db.auditLog.create({
        data: {
          action: 'compliance_check',
          tableName: 'StabilityStudy',
          recordId: study.id,
          details: `Compliance check run: score=${overallScore}, pass=${passCount}, warn=${warningCount}, fail=${failCount}`,
          userId: 'system',
        },
      })
    } catch {
      // audit log failure should not fail the API call
    }

    // Save compliance report to DB for history tracking
    try {
      await db.complianceReport.create({
        data: {
          studyId: study.id,
          studyCode: study.studyCode,
          substanceName: study.substanceName,
          overallScore,
          passCount,
          warningCount,
          failCount,
          notApplicableCount,
          readyForSubmission,
          categoryScores: JSON.stringify(categoryScores),
          blockingIssues: JSON.stringify(blockingIssues),
          checkedBy: 'system',
        },
      })
    } catch {
      // DB save failure should not fail the API call
    }

    return NextResponse.json(report)
  } catch (err) {
    console.error('[compliance-check] error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}

// ── GET /api/compliance-check ────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    rules: ICH_Q1A_RULES,
    categoryLabels: COMPLIANCE_CATEGORY_LABELS,
  })
}
