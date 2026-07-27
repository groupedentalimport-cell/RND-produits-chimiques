'use client'

import { useState, useEffect } from 'react'
import { Printer, Shield, Clock, FileText, BookOpen, AlertTriangle, GraduationCap, Scale, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  REPORT_TYPES, statusColors,
} from '@/lib/sample-data'
import type { ReportData, StudyData } from '@/lib/types'

// ── Report content sections by type ──────────────────────────────────────────
const REPORT_CONTENT: Record<string, { sections: { title: string; body: string }[] }> = {
  ich_q1a: {
    sections: [
      { title: '1. Scope & Objective', body: 'This stability protocol defines the testing requirements for the evaluation of the chemical substance under defined storage conditions per ICH Q1A(R2) guidelines. The objective is to establish the retest period or shelf life for the substance based on long-term, accelerated, and intermediate study data.' },
      { title: '2. Test Conditions', body: 'Long-term: 25°C ± 2°C / 60% RH ± 5% RH for a minimum of 12 months. Accelerated: 40°C ± 2°C / 75% RH ± 5% RH for 6 months. Intermediate: 30°C ± 2°C / 65% RH ± 5% RH for 12 months (if significant change occurs at accelerated condition).' },
      { title: '3. Testing Frequency', body: 'Long-term: 0, 3, 6, 9, 12, 18, 24 months, then annually through the proposed retest period. Accelerated: 0, 3, 6 months. Intermediate: 0, 6, 9, 12 months.' },
      { title: '4. Container Closure System', body: 'The substance shall be stored in the container closure system proposed for marketing or in a system that simulates the proposed packaging. HDPE bottles with induction seals are recommended for solid dosage forms. Glass vials with rubber stoppers for liquid formulations.' },
      { title: '5. Acceptance Criteria', body: 'Assay: 90.0%–110.0% of label claim. Degradation products: each unidentified ≤0.5%, total unidentified ≤1.0%, total degradation ≤2.0%. Dissolution: Q ≥ 80% in 30 minutes. Appearance: conforms to specification. Microbial limits: per USP <61> and <62>.' },
      { title: '6. Statistical Analysis Plan', body: 'Data shall be analyzed using regression analysis per ICH Q1E. Linear and non-linear models will be considered. The 95% confidence limit for the individual batch shall meet the acceptance criteria at the proposed retest period. Poolability of batches will be assessed per ICH Q1E.' },
      { title: '7. Out-of-Specification Protocol', body: 'Any OOS result shall be investigated per 21 CFR Part 211.165. Phase I laboratory investigation to identify assignable cause. If no assignable cause, Phase II full-scale investigation. Extension of testing may be considered per ICH Q1A guidance.' },
    ],
  },
  ctd_module: {
    sections: [
      { title: '3.2.P.8.1 Summary', body: 'This section provides a summary of the stability data generated for the drug product. The stability summary includes the types of studies conducted, the conditions tested, and the overall conclusions regarding shelf life and storage recommendations.' },
      { title: '3.2.P.8.2 Post-Approval Changes', body: 'Changes to the drug product after approval shall be managed per ICH Q1A(R2) and applicable regional guidelines. SUPAC levels defined: Level 1 (minor changes), Level 2 (moderate changes), Level 3 (major changes). Each level has specific stability testing requirements and notification requirements.' },
      { title: '3.2.P.8.3 Stability Data Tables', body: 'All stability data shall be presented in tabular format including: time point, test parameter, individual and mean results, specification limits, and whether results meet acceptance criteria. Data tables shall cover all storage conditions tested.' },
      { title: '3.2.P.8.4 Statistical Analysis', body: 'Statistical analysis of stability data per ICH Q1E. Method: regression analysis with 95% confidence limits. Batch poolability assessed. Shelf life estimation: time at which 95% lower confidence bound intersects acceptance criterion.' },
      { title: '3.2.P.8.5 Conclusions & Shelf Life', body: 'Based on the data presented, the proposed shelf life is supported by long-term and accelerated stability data. Storage recommendations: store at controlled room temperature (25°C). Protect from light and moisture. Container closure: HDPE bottle with induction seal.' },
    ],
  },
  fmea: {
    sections: [
      { title: '1. Process Map & Flowchart', body: 'The stability assessment process is mapped from material receipt through testing, data analysis, and report generation. Each process step is documented with inputs, outputs, and potential failure points.' },
      { title: '2. Failure Mode Identification', body: 'Potential failure modes identified for each process step: (a) Incorrect storage conditions, (b) Sample handling errors, (c) Analytical method variability, (d) Data transcription errors, (e) Calibration drift, (f) Environmental excursions.' },
      { title: '3. Severity Rating (1–10)', body: 'Severity ratings assigned based on impact on product quality and patient safety: Incorrect storage conditions (9), Analytical method variability (7), Data transcription errors (6), Calibration drift (8), Environmental excursions (9).' },
      { title: '4. Occurrence Rating (1–10)', body: 'Occurrence ratings based on historical data and process controls: Incorrect storage conditions (3), Analytical method variability (5), Data transcription errors (4), Calibration drift (2), Environmental excursions (3).' },
      { title: '5. Detection Rating (1–10)', body: 'Detection ratings based on current monitoring and control mechanisms: Incorrect storage conditions (2 — continuous monitoring), Analytical method variability (4 — system suitability), Data transcription errors (3 — double check), Calibration drift (2 — scheduled verification), Environmental excursions (2 — automated alerts).' },
      { title: '6. RPN Calculation & Ranking', body: 'Risk Priority Number (RPN) = Severity × Occurrence × Detection. Top risks by RPN: Environmental excursions (RPN=54), Analytical method variability (RPN=140), Incorrect storage conditions (RPN=54). Recommended action threshold: RPN ≥ 100.' },
      { title: '7. Recommended Actions', body: 'For analytical method variability (RPN=140): Implement robust system suitability criteria, perform method validation per ICH Q2(R1). For environmental excursions (RPN=54): Install redundant temperature/humidity monitoring with automated alerts. For storage conditions (RPN=54): Implement SOP for chamber qualification per IQ/OQ/PQ.' },
    ],
  },
  doe: {
    sections: [
      { title: '1. Factor Selection', body: 'Factors identified for optimization of stability conditions: Temperature (25°C, 30°C, 40°C), Humidity (60% RH, 75% RH), Light exposure (protected, exposed), Container type (glass, HDPE), pH (5.5, 7.0, 8.5), Excipient concentration (0%, 1%, 5%).' },
      { title: '2. Level Definition', body: 'Each factor is defined at two or three levels based on preliminary data and regulatory guidance. High and low levels are selected to challenge the product while remaining within realistic boundaries per ICH guidelines.' },
      { title: '3. Design Matrix', body: 'Full factorial design for 4 factors at 2 levels requires 16 experimental runs. A fractional factorial (2^(4-1)) design with 8 runs plus 3 center points (11 total) is recommended to balance resolution with resource constraints. Resolution IV design confounds 2-factor interactions.' },
      { title: '4. Response Variable Definition', body: 'Primary response: Percent label claim (assay) at end of study period. Secondary responses: Total degradation products, dissolution rate, appearance score, moisture content. Acceptance: assay ≥90%, degradants ≤2%, dissolution Q≥80%.' },
      { title: '5. Randomization Plan', body: 'All experimental runs shall be randomized within each block. Block factors: storage chamber (to control for potential chamber-to-chamber variation). Randomization performed using validated statistical software. Run order documented in batch records.' },
      { title: '6. Statistical Analysis Method', body: 'Analysis of variance (ANOVA) for main effects and interactions. Response surface methodology for optimization. Model validation via residual analysis and lack-of-fit test. Confidence intervals at 95% level per ICH Q1E guidance.' },
      { title: '7. Expected Outcomes', body: 'Expected outcomes include: identification of critical factors affecting stability, optimization of storage conditions, quantification of factor interactions, prediction of shelf life under various conditions, and establishment of design space for regulatory filing per ICH Q8(R2).' },
    ],
  },
  validation_protocol: {
    sections: [
      { title: '1. Installation Qualification (IQ)', body: 'IQ verifies that the stability chamber and all associated equipment are installed per manufacturer specifications and design requirements. Verification includes: electrical connections, calibration certificates, software version, environmental monitoring system integration, and documentation of serial numbers and location.' },
      { title: '2. Operational Qualification (OQ)', body: 'OQ demonstrates that the equipment operates consistently per operational specifications throughout all anticipated operating ranges. Testing includes: temperature uniformity mapping (±2°C), humidity uniformity mapping (±5% RH), recovery time after door opening, alarm function verification, and continuous monitoring system validation.' },
      { title: '3. Performance Qualification (PQ)', body: 'PQ demonstrates that the equipment performs reliably and reproducibly under actual operating conditions over an extended period. Three consecutive successful runs required. Performance criteria: temperature stability within ±2°C for 72 hours, humidity stability within ±5% RH, no excursions during loaded conditions.' },
      { title: '4. Acceptance Criteria', body: 'All IQ, OQ, and PQ test parameters must meet predefined acceptance criteria. Any deviation shall be documented, investigated, and resolved before proceeding. Critical parameters: temperature accuracy ±0.5°C, humidity accuracy ±3% RH, uniformity ±2°C / ±5% RH, recovery time ≤15 minutes.' },
      { title: '5. Deviation Handling', body: 'Any deviation observed during qualification shall be documented on a deviation form, assigned a classification (minor, major, critical), investigated for root cause, and corrective/preventive actions (CAPA) shall be implemented. Major and critical deviations require requalification.' },
      { title: '6. Final Report Template', body: 'The validation final report shall include: executive summary, protocol reference, equipment description, test results with pass/fail status, deviation summary, conclusion statement, approval signatures (QA, Engineering, Operations). Report retention: minimum 7 years per 21 CFR Part 11.' },
    ],
  },
}

// ── Icon map for report types ───────────────────────────────────────────────
const TYPE_ICON_MAP: Record<string, React.ElementType> = {
  ich_q1a: FileCheck,
  ctd_module: BookOpen,
  fmea: AlertTriangle,
  doe: GraduationCap,
  validation_protocol: Scale,
}

interface PrintReportViewProps {
  report: ReportData
  study?: StudyData | null
}

export function PrintReportView({ report, study }: PrintReportViewProps) {
  const [fetchedStudy, setFetchedStudy] = useState<StudyData | null>(study ?? null)
  const [loadingStudy, setLoadingStudy] = useState(!study)

  useEffect(() => {
    if (study) return
    let cancelled = false
    const fetchStudy = async () => {
      try {
        const res = await fetch('/api/studies?limit=100')
        if (res.ok && !cancelled) {
          const data = await res.json()
          const studies = data.studies || []
          if (studies.length > 0 && !cancelled) {
            // Use the first study as representative context
            setFetchedStudy({
              id: studies[0].id,
              studyCode: studies[0].studyCode || '',
              substanceName: studies[0].substanceName || '',
              studyType: studies[0].studyType || 'long_term',
              temperatureC: studies[0].temperatureC || 25,
              humidityPercent: studies[0].humidityPercent,
              durationMonths: studies[0].durationMonths || 24,
              predictedShelfLifeMonths: studies[0].predictedShelfLifeMonths,
              status: studies[0].status || 'draft',
              ph: studies[0].ph,
            })
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoadingStudy(false)
    }
    fetchStudy()
    return () => { cancelled = true }
  }, [study])

  const typeInfo = REPORT_TYPES.find(t => t.type === report.reportType)
  const Icon = TYPE_ICON_MAP[report.reportType] || FileText
  const content = REPORT_CONTENT[report.reportType]
  const reportTypeLabel = typeInfo?.title || report.reportType
  const statusLabel = (report.status || 'draft').replace(/_/g, ' ')
  const now = new Date()
  const docId = `CS-${report.id}-${now.getFullYear()}`

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="print-report-container">
      {/* ── Professional Header ─────────────────────────────────────────────── */}
      <div className="print-header border-b-3 border-emerald-600 pb-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* ChemStab Logo/Branding */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                CS
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-gray-900">ChemStab Industrial Corp.</h1>
                <p className="text-xs text-gray-500">Chemical Stability Assessment Platform</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-medium">Document ID</p>
            <p className="text-sm font-mono font-semibold text-gray-800">{docId}</p>
          </div>
        </div>

        {/* Report Title & Meta */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Icon className="size-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{report.title}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="font-medium">Type: <span className="text-gray-900">{reportTypeLabel}</span></span>
            <span className="font-medium">Status: <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${statusColors[report.status] || 'bg-gray-100 text-gray-700'}`}>{statusLabel}</span></span>
            <span className="font-medium">Created: <span className="text-gray-900">{report.createdAt}</span></span>
          </div>
        </div>
      </div>

      {/* ── Compliance Notice ──────────────────────────────────────────────── */}
      <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 mb-6 rounded-r-lg">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="size-4 text-emerald-700" />
          <span className="text-sm font-semibold text-emerald-800">Compliance Notice</span>
        </div>
        <p className="text-xs text-emerald-700">
          This report follows <strong>ICH Q1A(R2)</strong> guidelines for stability testing and <strong>FDA 21 CFR Part 11</strong> requirements for electronic records and signatures.
          Audit trail retention: 7 years. Electronic signature authority: validated per Part 11 requirements.
        </p>
      </div>

      {/* ── Study Details (if linked) ─────────────────────────────────────── */}
      {loadingStudy ? (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">Loading study details...</div>
      ) : fetchedStudy ? (
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 border-l-4 border-teal-500 pl-3 mb-3">Study Information</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Study Code', value: fetchedStudy.studyCode },
              { label: 'Substance', value: fetchedStudy.substanceName },
              { label: 'Study Type', value: (fetchedStudy.studyType || '').replace(/_/g, ' ') },
              { label: 'Status', value: (fetchedStudy.status || '').replace(/_/g, ' ') },
              { label: 'Temperature', value: `${fetchedStudy.temperatureC}°C` },
              { label: 'Humidity', value: `${fetchedStudy.humidityPercent ?? 'N/A'}% RH` },
              { label: 'Duration', value: `${fetchedStudy.durationMonths} months` },
              { label: 'Predicted Shelf Life', value: `${fetchedStudy.predictedShelfLifeMonths ?? 'TBD'} months` },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-500 border border-gray-200">
          No linked study data available.
        </div>
      )}

      <Separator className="my-6" />

      {/* ── Content Sections ──────────────────────────────────────────────── */}
      {content?.sections.map((section, idx) => (
        <div key={idx} className={`mb-6 ${idx > 0 ? 'print-page-break' : ''}`}>
          <h3 className="text-base font-semibold text-gray-900 border-l-4 border-emerald-600 pl-3 mb-2">
            {section.title}
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            {section.body}
          </p>
        </div>
      ))}

      {/* ── Methodology Table ────────────────────────────────────────────── */}
      {fetchedStudy && (
        <div className="mb-6 print-page-break">
          <h3 className="text-base font-semibold text-gray-900 border-l-4 border-emerald-600 pl-3 mb-2">
            Methodology Parameters
          </h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Parameter</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Specification</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Acceptance Criteria</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-3 py-1.5">Storage Condition</td>
                <td className="border border-gray-300 px-3 py-1.5">{fetchedStudy.temperatureC}°C / {fetchedStudy.humidityPercent ?? 60}% RH</td>
                <td className="border border-gray-300 px-3 py-1.5">ICH Q1A long-term condition</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-1.5">Testing Frequency</td>
                <td className="border border-gray-300 px-3 py-1.5">0, 3, 6, 9, 12, 18, 24 months</td>
                <td className="border border-gray-300 px-3 py-1.5">Per ICH Q1A guidance</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-1.5">Container Closure</td>
                <td className="border border-gray-300 px-3 py-1.5">HDPE bottle with induction seal</td>
                <td className="border border-gray-300 px-3 py-1.5">Simulates marketed package</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-1.5">Light Protection</td>
                <td className="border border-gray-300 px-3 py-1.5">{fetchedStudy.studyType === 'stress' ? 'Exposed per ICH Q1B' : 'Protected from light'}</td>
                <td className="border border-gray-300 px-3 py-1.5">ICH Q1B photostability</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-1.5">pH Range</td>
                <td className="border border-gray-300 px-3 py-1.5">{fetchedStudy.ph ?? 'N/A'}</td>
                <td className="border border-gray-300 px-3 py-1.5">Formulation target ± 0.5</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Acceptance Criteria Table ────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 border-l-4 border-emerald-600 pl-3 mb-2">
          Acceptance Criteria
        </h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Test</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Specification</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Rationale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-1.5">Assay</td>
              <td className="border border-gray-300 px-3 py-1.5">90.0% – 110.0% of label claim</td>
              <td className="border border-gray-300 px-3 py-1.5">Potency throughout shelf life</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-1.5">Degradation Products</td>
              <td className="border border-gray-300 px-3 py-1.5">Each ≤ 0.5%; Total ≤ 2.0%</td>
              <td className="border border-gray-300 px-3 py-1.5">Safety and efficacy</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-1.5">Dissolution</td>
              <td className="border border-gray-300 px-3 py-1.5">Q ≥ 80% in 30 minutes</td>
              <td className="border border-gray-300 px-3 py-1.5">Bioavailability</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-1.5">Appearance</td>
              <td className="border border-gray-300 px-3 py-1.5">Conforms to specification</td>
              <td className="border border-gray-300 px-3 py-1.5">Physical stability</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Conclusion ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 border-l-4 border-emerald-600 pl-3 mb-2">
          Conclusion
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Based on the analytical data obtained throughout the stability study, the substance meets the predefined
          acceptance criteria. The recommended shelf life and storage conditions are supported by the data presented
          in this report. All testing was conducted in accordance with ICH Q1A(R2) and applicable regulatory requirements.
        </p>
      </div>

      {/* ── Signature Block ─────────────────────────────────────────────── */}
      <div className="mb-8 print-page-break">
        <h3 className="text-base font-semibold text-gray-900 border-l-4 border-emerald-600 pl-3 mb-4">
          Approval Signatures
        </h3>
        <div className="grid grid-cols-3 gap-6">
          {[
            { name: 'Dr. Sarah Chen', role: 'Analyst', dept: 'Quality Control' },
            { name: 'Dr. Wei Chen', role: 'Org Admin', dept: 'Quality Assurance' },
            { name: 'Aiko Tanaka', role: 'Project Manager', dept: 'Regulatory Affairs' },
          ].map((sig) => (
            <div key={sig.role} className="border-t-2 border-gray-800 pt-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{sig.role}</p>
              <p className="text-sm font-semibold text-gray-900">{sig.name}</p>
              <p className="text-xs text-gray-600">{sig.dept}</p>
              <p className="text-xs text-gray-500 mt-1">Date: {now.toLocaleDateString()}</p>
              <p className="text-xs text-gray-500">Electronic Signature — 21 CFR Part 11 Compliant</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Compliance Footer ────────────────────────────────────────────── */}
      <div className="border-t-2 border-gray-300 pt-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="size-3.5 text-emerald-700" />
          <span className="text-xs font-semibold text-gray-700">Regulatory Compliance</span>
        </div>
        <p className="text-xs text-gray-600">
          ICH Q1A(R2) · ICH Q1B · ICH Q1E · FDA 21 CFR Part 11 · GxP
        </p>
        <p className="text-xs text-gray-500 mt-2">
          ChemStab Industrial Corp. · Confidential · FDA 21 CFR Part 11 Compliant Electronic Record
        </p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            Generated: {now.toLocaleString()}
          </span>
          <span>Report ID: <span className="font-mono">{report.id}</span></span>
          <span>Document ID: <span className="font-mono">{docId}</span></span>
        </div>
      </div>

      {/* ── Print Button (hidden during printing) ───────────────────────── */}
      <div className="mt-6 flex justify-center no-print">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          onClick={handlePrint}
        >
          <Printer className="size-4" />
          Print Report
        </Button>
      </div>
    </div>
  )
}
