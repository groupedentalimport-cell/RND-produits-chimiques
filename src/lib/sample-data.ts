import {
  LayoutDashboard, Atom, Beaker, Microscope, FlaskConical, FileText, BarChart3, ShieldCheck,
  FileCheck, BookOpen, AlertTriangle, GraduationCap, Scale,
  Plus, RefreshCw, Trash2, CheckCircle2, Shield, XCircle,
  Cpu, ClipboardCheck, GitCompareArrows,
} from 'lucide-react'
import type { PageId, MoleculeData, StudyData, ReportData, UserData, AuditEntry } from '@/lib/types'

// ── Sample Data ────────────────────────────────────────────────────────────

// QSPR Model Performance (hardcoded realistic values)
export const QSPR_MODEL_PERFORMANCE = [
  { model: 'Solubility', r2: 0.82, rmse: 0.54, mae: 0.41, fill: '#10b981' },
  { model: 'logD', r2: 0.78, rmse: 0.61, mae: 0.47, fill: '#14b8a6' },
  { model: 'Hydration', r2: 0.75, rmse: 0.72, mae: 0.55, fill: '#06b6d4' },
]

export const SAMPLE_MOLECULES: MoleculeData[] = [
  { id: 'mol-1', name: 'Aspirin', casNumber: '50-78-2', smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O', formula: 'C₉H₈O₄', molarMass: 180.16, logP: 1.19, stabilityScore: 72, riskLevel: 'low', dataSource: 'PubChem', description: 'Acetylsalicylic acid, a common NSAID and antiplatelet agent. Sensitive to moisture and hydrolysis.', meltingPoint: 135, boilingPoint: null },
  { id: 'mol-2', name: 'Benzene', casNumber: '71-43-2', smiles: 'C1=CC=CC=C1', formula: 'C₆H₆', molarMass: 78.11, logP: 2.13, stabilityScore: 45, riskLevel: 'moderate', dataSource: 'ChEMBL', description: 'Aromatic hydrocarbon. Known carcinogen. Relatively stable under normal conditions but poses significant health risks.', meltingPoint: 5.5, boilingPoint: 80.1 },
  { id: 'mol-3', name: 'Caffeine', casNumber: '58-08-2', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', formula: 'C₈H₁₀N₄O₂', molarMass: 194.19, logP: -0.07, stabilityScore: 88, riskLevel: 'low', dataSource: 'PubChem', description: '1,3,7-trimethylxanthine. Very stable compound, widely consumed stimulant.', meltingPoint: 238, boilingPoint: null },
  { id: 'mol-4', name: 'Acetaminophen', casNumber: '103-90-2', smiles: 'CC(=O)NC1=CC=C(O)C=C1', formula: 'C₈H₉NO₂', molarMass: 151.16, logP: 0.46, stabilityScore: 65, riskLevel: 'low', dataSource: 'PubChem', description: 'Paracetamol. Analgesic and antipyretic. Can degrade under humid conditions via hydrolysis.', meltingPoint: 169, boilingPoint: null },
  { id: 'mol-5', name: 'Ibuprofen', casNumber: '15687-27-1', smiles: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O', formula: 'C₁₃H₁₈O₂', molarMass: 206.28, logP: 3.97, stabilityScore: 70, riskLevel: 'low', dataSource: 'ChEMBL', description: 'Propionic acid derivative NSAID. Stable under normal storage conditions.', meltingPoint: 76, boilingPoint: null },
  { id: 'mol-6', name: 'Ethanol', casNumber: '64-17-5', smiles: 'CCO', formula: 'C₂H₆O', molarMass: 46.07, logP: -0.31, stabilityScore: 92, riskLevel: 'low', dataSource: 'PubChem', description: 'Simple alcohol. Highly stable, volatile. Used as solvent and disinfectant.', meltingPoint: -114.1, boilingPoint: 78.37 },
  { id: 'mol-7', name: 'Methanol', casNumber: '67-56-1', smiles: 'CO', formula: 'CH₄O', molarMass: 32.04, logP: -0.74, stabilityScore: 80, riskLevel: 'low', dataSource: 'PubChem', description: 'Simple alcohol. Toxic if ingested. Stable compound but highly flammable.', meltingPoint: -97.6, boilingPoint: 64.7 },
  { id: 'mol-8', name: 'Sodium Chloride', casNumber: '7647-14-5', smiles: 'NaCl', formula: 'NaCl', molarMass: 58.44, logP: null, stabilityScore: 99, riskLevel: 'low', dataSource: 'Manual', description: 'Common salt. Exceptionally stable. No significant degradation pathways under normal conditions.', meltingPoint: 801, boilingPoint: 1413 },
  { id: 'mol-9', name: 'Acetic Acid', casNumber: '64-19-7', smiles: 'CC(=O)O', formula: 'C₂H₄O₂', molarMass: 60.05, logP: -0.17, stabilityScore: 85, riskLevel: 'low', dataSource: 'PubChem', description: 'Simple carboxylic acid. Stable under normal conditions. Corrosive at high concentrations.', meltingPoint: 16.6, boilingPoint: 117.9 },
  { id: 'mol-10', name: 'Hydrogen Peroxide', casNumber: '7722-84-1', smiles: 'OO', formula: 'H₂O₂', molarMass: 34.01, logP: null, stabilityScore: 25, riskLevel: 'critical', dataSource: 'ChEMBL', description: 'Strong oxidizer. Rapidly degrades, especially in presence of light, heat, or contaminants. Requires careful storage.', meltingPoint: -0.43, boilingPoint: 150.2 },
  { id: 'mol-11', name: 'Glucose', casNumber: '50-99-7', smiles: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O', formula: 'C₆H₁₂O₆', molarMass: 180.16, logP: -3.24, stabilityScore: 78, riskLevel: 'low', dataSource: 'PubChem', description: 'Simple sugar. Relatively stable but can degrade via Maillard reaction and caramelization at elevated temperatures.', meltingPoint: 146, boilingPoint: null },
  { id: 'mol-12', name: 'Formaldehyde', casNumber: '50-00-0', smiles: 'C=O', formula: 'CH₂O', molarMass: 30.03, logP: 0.35, stabilityScore: 35, riskLevel: 'high', dataSource: 'ChEMBL', description: 'Simple aldehyde. Toxic, carcinogenic. Polymerizes readily. Requires stabilization with methanol.', meltingPoint: -92, boilingPoint: -19 },
]

export const SAMPLE_STUDIES: StudyData[] = [
  { id: 'std-1', studyCode: 'STB-2024-001', substanceName: 'Aspirin', studyType: 'long_term', temperatureC: 25, humidityPercent: 60, durationMonths: 24, predictedShelfLifeMonths: 36, status: 'completed', ph: 6.5 },
  { id: 'std-2', studyCode: 'STB-2024-002', substanceName: 'Acetaminophen', studyType: 'accelerated', temperatureC: 40, humidityPercent: 75, durationMonths: 6, predictedShelfLifeMonths: 48, status: 'in_progress', ph: 5.8 },
  { id: 'std-3', studyCode: 'STB-2024-003', substanceName: 'Ibuprofen', studyType: 'stress', temperatureC: 60, humidityPercent: null, durationMonths: 3, predictedShelfLifeMonths: null, status: 'draft', ph: 7.0 },
  { id: 'std-4', studyCode: 'STB-2024-004', substanceName: 'Caffeine', studyType: 'intermediate', temperatureC: 30, humidityPercent: 65, durationMonths: 12, predictedShelfLifeMonths: 60, status: 'under_review', ph: null },
  { id: 'std-5', studyCode: 'STB-2024-005', substanceName: 'Hydrogen Peroxide', studyType: 'accelerated', temperatureC: 40, humidityPercent: null, durationMonths: 3, predictedShelfLifeMonths: 6, status: 'completed', ph: 4.5 },
]

export const SAMPLE_USERS: UserData[] = [
  { id: 'usr-1', name: 'Dr. Sarah Chen', email: 'sarah.chen@chemstab.io', role: 'org_admin', isActive: true, lastLogin: '2024-03-15 09:23' },
  { id: 'usr-2', name: 'James Rodriguez', email: 'james.r@chemstab.io', role: 'analyst', isActive: true, lastLogin: '2024-03-14 16:45' },
  { id: 'usr-3', name: 'Aiko Tanaka', email: 'aiko.t@chemstab.io', role: 'project_manager', isActive: true, lastLogin: '2024-03-13 11:30' },
  { id: 'usr-4', name: 'Mark Thompson', email: 'mark.t@chemstab.io', role: 'viewer', isActive: false, lastLogin: '2024-02-28 08:15' },
  { id: 'usr-5', name: 'Dr. Elena Volkov', email: 'elena.v@chemstab.io', role: 'analyst', isActive: true, lastLogin: '2024-03-15 14:10' },
]

export const SAMPLE_AUDIT: AuditEntry[] = [
  { id: 'aud-1', action: 'create', tableName: 'StabilityStudy', recordId: 'STB-2024-002', details: 'Created accelerated study for Acetaminophen', userName: 'James Rodriguez', createdAt: '2024-03-15 09:23' },
  { id: 'aud-2', action: 'update', tableName: 'Molecule', recordId: 'mol-10', details: 'Updated risk level from high to critical for Hydrogen Peroxide', userName: 'Dr. Sarah Chen', createdAt: '2024-03-14 14:45' },
  { id: 'aud-3', action: 'approve', tableName: 'StabilityStudy', recordId: 'STB-2024-001', details: 'Approved long-term stability study for Aspirin', userName: 'Aiko Tanaka', createdAt: '2024-03-13 16:30' },
  { id: 'aud-4', action: 'sign', tableName: 'ElectronicSignature', recordId: 'STB-2024-005', details: 'Electronically signed H₂O₂ accelerated study results', userName: 'Dr. Elena Volkov', createdAt: '2024-03-12 11:15' },
  { id: 'aud-5', action: 'delete', tableName: 'TimePoint', recordId: 'tp-old-001', details: 'Removed outlier time point data from study STB-2024-003', userName: 'James Rodriguez', createdAt: '2024-03-11 09:45' },
  { id: 'aud-6', action: 'create', tableName: 'Report', recordId: 'rpt-ich-001', details: 'Generated ICH Q1A stability protocol report', userName: 'Dr. Sarah Chen', createdAt: '2024-03-10 15:20' },
]

export const STABILITY_TRENDS_DATA = [
  { month: 'Jan', aspirin: 72, acetaminophen: 65, caffeine: 88, overall: 75 },
  { month: 'Feb', aspirin: 71, acetaminophen: 64, caffeine: 87, overall: 74 },
  { month: 'Mar', aspirin: 70, acetaminophen: 62, caffeine: 88, overall: 73 },
  { month: 'Apr', aspirin: 69, acetaminophen: 61, caffeine: 87, overall: 72 },
  { month: 'May', aspirin: 68, acetaminophen: 60, caffeine: 86, overall: 71 },
  { month: 'Jun', aspirin: 67, acetaminophen: 59, caffeine: 85, overall: 70 },
  { month: 'Jul', aspirin: 66, acetaminophen: 58, caffeine: 84, overall: 69 },
  { month: 'Aug', aspirin: 65, acetaminophen: 57, caffeine: 83, overall: 68 },
]

export const RISK_DISTRIBUTION_DATA = [
  { level: 'Low', count: 8, fill: '#10b981' },
  { level: 'Moderate', count: 2, fill: '#f59e0b' },
  { level: 'High', count: 1, fill: '#ef4444' },
  { level: 'Critical', count: 1, fill: '#dc2626' },
]

export const REPORT_TYPES = [
  { type: 'ich_q1a', title: 'ICH Q1A Stability Protocol', icon: FileCheck, description: 'Comprehensive stability testing protocol per ICH guidelines', color: 'emerald' },
  { type: 'ctd_module', title: 'CTD Module 3.2.P.8', icon: BookOpen, description: 'Stability data for regulatory submission in CTD format', color: 'teal' },
  { type: 'fmea', title: 'FMEA Risk Assessment', icon: AlertTriangle, description: 'Failure Mode and Effects Analysis for stability risks', color: 'amber' },
  { type: 'doe', title: 'DoE Design', icon: GraduationCap, description: 'Design of Experiments for optimization of stability conditions', color: 'cyan' },
  { type: 'validation_protocol', title: 'Validation Protocol IQ/OQ/PQ', icon: Scale, description: 'Equipment and process validation protocols for stability labs', color: 'rose' },
]

export const SAMPLE_REPORTS: ReportData[] = [
  { id: 'rpt-1', title: 'ICH Q1A - Aspirin Long-Term Stability', reportType: 'ich_q1a', status: 'completed', createdAt: '2024-03-12' },
  { id: 'rpt-2', title: 'CTD Module 3.2.P.8 - Acetaminophen', reportType: 'ctd_module', status: 'draft', createdAt: '2024-03-14' },
  { id: 'rpt-3', title: 'FMEA Risk Assessment - H₂O₂', reportType: 'fmea', status: 'under_review', createdAt: '2024-03-10' },
  { id: 'rpt-4', title: 'DoE Optimization - Ibuprofen Formulation', reportType: 'doe', status: 'completed', createdAt: '2024-03-08' },
  { id: 'rpt-5', title: 'IQ/OQ/PQ Validation - Stability Chamber SC-04', reportType: 'validation_protocol', status: 'in_progress', createdAt: '2024-03-06' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

export const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const riskColors: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  critical: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200',
}

export const studyTypeLabels: Record<string, string> = {
  long_term: 'Long-Term',
  accelerated: 'Accelerated',
  intermediate: 'Intermediate',
  stress: 'Stress Testing',
}

export const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  project_manager: 'Project Manager',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-teal-600 dark:text-teal-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ── Shared Global Style/Icon Maps ─────────────────────────────────────────

export const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
  cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
}

export const COLOR_MAP_TEXT: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400', teal: 'text-teal-600 dark:text-teal-400',
  cyan: 'text-cyan-600 dark:text-cyan-400', amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400', rose: 'text-rose-600 dark:text-rose-400',
}

export const GRADIENT_TOP_BAR: Record<string, string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500', teal: 'bg-gradient-to-r from-teal-500 to-cyan-500',
  cyan: 'bg-gradient-to-r from-cyan-500 to-sky-500', amber: 'bg-gradient-to-r from-amber-500 to-orange-500',
  red: 'bg-gradient-to-r from-red-500 to-rose-500',
}

export const PROGRESS_BAR_MAP: Record<string, string> = {
  emerald: '[&>div]:bg-emerald-500', teal: '[&>div]:bg-teal-500',
  cyan: '[&>div]:bg-cyan-500', amber: '[&>div]:bg-amber-500', red: '[&>div]:bg-red-500',
}

export const ACTION_ICON_MAP: Record<string, React.ElementType> = {
  create: Plus, update: RefreshCw, delete: Trash2, approve: CheckCircle2, sign: Shield, reject: XCircle,
}

export const ACTION_COLOR_MAP: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  update: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  delete: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  approve: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
  sign: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
  reject: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

export const ACTION_TEXT_MAP: Record<string, string> = {
  create: 'text-emerald-600 dark:text-emerald-400', update: 'text-amber-600 dark:text-amber-400',
  delete: 'text-red-600 dark:text-red-400', approve: 'text-teal-600 dark:text-teal-400',
  sign: 'text-cyan-600 dark:text-cyan-400', reject: 'text-red-600 dark:text-red-400',
}

export const HAZARD_BORDER_MAP: Record<string, string> = { low: 'border-l-emerald-500', moderate: 'border-l-amber-500', high: 'border-l-red-500', critical: 'border-l-rose-500' }
export const HAZARD_BAR_MAP: Record<string, string> = { low: 'from-emerald-400 to-teal-500', moderate: 'from-amber-400 to-orange-500', high: 'from-red-400 to-red-600', critical: 'from-rose-400 to-rose-600' }
export const HAZARD_OUTLINE_MAP: Record<string, string> = { low: 'border-emerald-500 text-emerald-600', moderate: 'border-amber-500 text-amber-600', high: 'border-red-500 text-red-600' }

export const RISK_PILL_ACTIVE: Record<string, string> = { low: 'bg-emerald-600 text-white', moderate: 'bg-amber-600 text-white hover:bg-amber-700', high: 'bg-red-600 text-white hover:bg-red-700', critical: 'bg-rose-600 text-white hover:bg-rose-700' }
export const RISK_PILL_OUTLINE: Record<string, string> = { critical: 'border-red-500 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20', high: 'border-orange-500 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20', moderate: 'border-amber-500 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20' }

export const REPORT_GRADIENT: Record<string, string> = { ich_q1a: 'bg-gradient-to-r from-emerald-500 to-teal-500', ctd_module: 'bg-gradient-to-r from-teal-500 to-cyan-500', fmea: 'bg-gradient-to-r from-amber-500 to-orange-500', doe: 'bg-gradient-to-r from-cyan-500 to-sky-500', validation_protocol: 'bg-gradient-to-r from-rose-500 to-pink-500' }
export const REPORT_ICON_BG: Record<string, string> = { ich_q1a: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400', ctd_module: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400', fmea: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', doe: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400', validation_protocol: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' }

export const HAZARD_CLASS_MAP: Record<string, string> = { critical: 'Severe Hazard', high: 'Significant Hazard', moderate: 'Moderate Hazard', low: 'Low Hazard' }
export const RISK_BG_MAP: Record<string, string> = {
  critical: 'bg-red-50/50 dark:bg-red-900/10 border-red-500', high: 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-500',
  moderate: 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-500', low: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500',
}

export const roleAvatarColors: Record<string, string> = {
  super_admin: 'from-rose-500 to-red-600', org_admin: 'from-emerald-500 to-teal-600',
  project_manager: 'from-cyan-500 to-blue-600', analyst: 'from-amber-500 to-orange-600', viewer: 'from-slate-400 to-slate-500',
}

// ── Sidebar Navigation ────────────────────────────────────────────────────

export const NAV_ITEMS: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'molecules', label: 'Molecules', icon: Atom },
  { id: 'simulator', label: 'Simulator', icon: Beaker },
  { id: 'studies', label: 'Studies', icon: Microscope },
  { id: 'degradation', label: 'Degradation', icon: FlaskConical },
  { id: 'interactions', label: 'Interactions', icon: GitCompareArrows },
  { id: 'compliance', label: 'Compliance', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
]

// ── Transformers ──────────────────────────────────────────────────────────

export function transformMolecule(m: any): MoleculeData {
  return {
    id: m.id, name: m.name, casNumber: m.casNumber || '', smiles: m.smiles || '',
    formula: m.formula || '', molarMass: m.molarMass ?? 0, logP: m.logP ?? 0,
    stabilityScore: m.predictedStabilityScore ?? 0, riskLevel: m.riskLevel || 'low',
    dataSource: m.dataSource || 'Manual', description: m.description || '',
    meltingPoint: m.meltingPoint ?? null, boilingPoint: m.boilingPoint ?? null,
  }
}

export function transformStudy(s: any): StudyData {
  return {
    id: s.id, studyCode: s.studyCode || '', substanceName: s.substanceName || '',
    studyType: s.studyType || 'long_term', temperatureC: s.temperatureC || 25,
    humidityPercent: s.humidityPercent, durationMonths: s.durationMonths || 24,
    predictedShelfLifeMonths: s.predictedShelfLifeMonths, status: s.status || 'draft', ph: s.ph,
  }
}

// ── CSV Export helper ────────────────────────────────────────────────────

export function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csvLines = [headers.join(',')]
  for (const row of data) {
    const values = headers.map((h) => {
      const v = row[h] ?? ''
      const s = String(v).replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    })
    csvLines.push(values.join(','))
  }
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Format a number for CSV output (null -> empty string)
export function fmtNum(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

// ── Chemical formula subscript formatter ──────────────────────────────
// Converts "C9H8O4" → "C₉H₈O₄", "H2O2" → "H₂O₂", "NaCl" stays "NaCl"
export const SUBSCRIPT_DIGITS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
}
export function formatFormula(formula: string | null | undefined): string {
  if (!formula) return '—'
  // If already contains unicode subscripts, leave as-is
  if (/[₀-₉]/.test(formula)) return formula
  // Replace any digit that follows a letter (or another digit) with subscript
  return formula.replace(/(\d+)/g, (m) =>
    m.split('').map((d) => SUBSCRIPT_DIGITS[d] ?? d).join('')
  )
}

// ── Notifications ───────────────────────────────────────────────────────────

export type NotificationCategory = 'study' | 'molecule' | 'report' | 'system' | 'alert'
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface AppNotification {
  id: string
  title: string
  message: string
  category: NotificationCategory
  severity: NotificationSeverity
  timestamp: string  // ISO date
  read: boolean
  actionLabel?: string  // e.g. "View Study"
  actionPage?: PageId   // page to navigate to when action clicked
}

// Category → lucide icon component (used by NotificationsButton)
export const NOTIF_CATEGORY_ICON: Record<NotificationCategory, React.ElementType> = {
  study: Microscope,
  molecule: Atom,
  report: FileText,
  system: Cpu,
  alert: AlertTriangle,
}

// Category → display label (used by filter pills)
export const NOTIF_CATEGORY_LABEL: Record<NotificationCategory, string> = {
  study: 'Studies',
  molecule: 'Molecules',
  report: 'Reports',
  system: 'System',
  alert: 'Alerts',
}

// Severity → background / text color for the category icon chip
export const NOTIF_SEVERITY_BG: Record<NotificationSeverity, string> = {
  info: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300',
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
}

// Helper: format an ISO timestamp into a relative-time string ("2h ago", "Yesterday", "3d ago")
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = now - then
  const sec = Math.max(0, Math.floor(diffMs / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'Yesterday'
  if (day < 7) return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk}w ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(day / 365)}y ago`
}

// ── Notifications are now loaded from the database via /api/notifications ──
// The old SAMPLE_NOTIFICATIONS hardcoded array has been removed.
// Notifications are seeded via /api/seed and managed by the Notification store.

// ── Degradation Pathways (interactive pathway tree) ────────────────────────

export type DegradationCondition = 'Hydrolysis' | 'Oxidation' | 'Photolysis' | 'Thermal'
export type HazardLevel = 'low' | 'moderate' | 'high'

export interface DegradationPathwayProduct {
  name: string
  smiles: string
  percentage: number
  hazardLevel: HazardLevel
  condition: DegradationCondition
  description?: string
}

export interface DegradationPathway {
  moleculeName: string
  smiles: string
  casNumber?: string
  formula?: string
  products: DegradationPathwayProduct[]
}

/**
 * Predefined degradation pathways for common pharmaceutical / chemical molecules.
 *
 * Each entry pairs a parent molecule (name + SMILES) with the degradation products
 * it tends to form under a specific stress condition (hydrolysis, oxidation,
 * photolysis, or thermal stress). Percentages are approximate literature values
 * used for didactic visualization; hazardLevel reflects the relative safety
 * concern of each degradant.
 */
export const DEGRADATION_PATHWAYS: DegradationPathway[] = [
  {
    moleculeName: 'Aspirin',
    smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
    casNumber: '50-78-2',
    formula: 'C₉H₈O₄',
    products: [
      {
        name: 'Salicylic Acid',
        smiles: 'OC1=CC=CC=C1C(=O)O',
        percentage: 65,
        hazardLevel: 'moderate',
        condition: 'Hydrolysis',
        description: 'Primary hydrolysis degradant of acetylsalicylic acid. Causes gastric irritation; controlled under ICH Q1A.',
      },
      {
        name: 'Acetic Acid',
        smiles: 'CC(=O)O',
        percentage: 35,
        hazardLevel: 'low',
        condition: 'Hydrolysis',
        description: 'Co-product of ester hydrolysis. Readily volatilized; characteristic vinegar odor.',
      },
    ],
  },
  {
    moleculeName: 'Ibuprofen',
    smiles: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O',
    casNumber: '15687-27-1',
    formula: 'C₁₃H₁₈O₂',
    products: [
      {
        name: 'Hydroxyibuprofen',
        smiles: 'CC(C)CC1=CC=C(C=C1)C(O)(C)C(=O)O',
        percentage: 42,
        hazardLevel: 'low',
        condition: 'Oxidation',
        description: 'Major oxidative metabolite; pharmacologically active and monitored under ICH Q3B.',
      },
      {
        name: 'Isobutylphenol',
        smiles: 'CC(C)CC1=CC=C(O)C=C1',
        percentage: 18,
        hazardLevel: 'moderate',
        condition: 'Thermal',
        description: 'Thermal decarboxylation product; can form at elevated temperatures during processing.',
      },
    ],
  },
  {
    moleculeName: 'Acetaminophen',
    smiles: 'CC(=O)NC1=CC=C(O)C=C1',
    casNumber: '103-90-2',
    formula: 'C₈H₉NO₂',
    products: [
      {
        name: 'NAPQI',
        smiles: 'CC(=O)N=C1C=CC(=O)C=C1',
        percentage: 12,
        hazardLevel: 'high',
        condition: 'Oxidation',
        description: 'N-acetyl-p-benzoquinone imine — highly reactive hepatotoxin formed via CYP450 oxidation.',
      },
      {
        name: 'p-Aminophenol',
        smiles: 'NC1=CC=C(O)C=C1',
        percentage: 28,
        hazardLevel: 'moderate',
        condition: 'Hydrolysis',
        description: 'Hydrolytic degradant; monitored as a related substance under pharmacopeial limits.',
      },
    ],
  },
  {
    moleculeName: 'Hydrogen Peroxide',
    smiles: 'OO',
    casNumber: '7722-84-1',
    formula: 'H₂O₂',
    products: [
      {
        name: 'Water',
        smiles: 'O',
        percentage: 50,
        hazardLevel: 'low',
        condition: 'Photolysis',
        description: 'Photolytic decomposition product; light-catalyzed O–O bond homolysis.',
      },
      {
        name: 'Oxygen',
        smiles: 'O=O',
        percentage: 50,
        hazardLevel: 'low',
        condition: 'Photolysis',
        description: 'Co-product of photolytic disproportionation; pressure-buildup hazard in sealed containers.',
      },
      {
        name: 'Water',
        smiles: 'O',
        percentage: 50,
        hazardLevel: 'low',
        condition: 'Thermal',
        description: 'Thermal disproportionation product; favored above 60 °C or in presence of catalysts.',
      },
      {
        name: 'Oxygen',
        smiles: 'O=O',
        percentage: 50,
        hazardLevel: 'low',
        condition: 'Thermal',
        description: 'Co-product of thermal disproportionation; oxygen evolution drives rapid pressure rise.',
      },
    ],
  },
  {
    moleculeName: 'Caffeine',
    smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
    casNumber: '58-08-2',
    formula: 'C₈H₁₀N₄O₂',
    products: [
      {
        name: 'Dimethylparabanic Acid',
        smiles: 'CN1C(=O)N(C)C(=O)C1=O',
        percentage: 22,
        hazardLevel: 'moderate',
        condition: 'Photolysis',
        description: 'Major photodegradant of caffeine; formed by oxidative ring opening under UV exposure.',
      },
    ],
  },
]

/** Color tokens for each degradation condition (used by the pathway tree). */
export const DEGRADATION_CONDITION_STYLES: Record<DegradationCondition, {
  badge: string
  dot: string
  stroke: string
  label: string
}> = {
  Hydrolysis: {
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    dot: 'bg-teal-500',
    stroke: '#14b8a6',
    label: 'Hydrolysis',
  },
  Oxidation: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
    stroke: '#f59e0b',
    label: 'Oxidation',
  },
  Photolysis: {
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    dot: 'bg-cyan-500',
    stroke: '#06b6d4',
    label: 'Photolysis',
  },
  Thermal: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
    stroke: '#ef4444',
    label: 'Thermal',
  },
}

/** Color tokens for each hazard level (used by product cards). */
export const HAZARD_BADGE_STYLES: Record<HazardLevel, string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/60',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300/60 dark:border-amber-700/60',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300/60 dark:border-red-700/60',
}

/** Helper: find a predefined pathway for a molecule name (case-insensitive). */
export function findPathwayForMolecule(name: string): DegradationPathway | undefined {
  if (!name) return undefined
  const q = name.trim().toLowerCase()
  return DEGRADATION_PATHWAYS.find((p) => p.moleculeName.toLowerCase() === q)
}

// ── ICH Q1A (R2) Compliance Rule Definitions ──────────────────────────────

export type ComplianceStatus = 'pass' | 'warning' | 'fail' | 'not_applicable'
export type ComplianceCategory =
  | 'study_design'
  | 'storage_conditions'
  | 'duration'
  | 'batch_requirements'
  | 'container_closure'
  | 'testing_frequency'
  | 'statistical_evaluation'
  | 'documentation'
  | 'risk_management'

export interface ComplianceRule {
  id: string
  category: ComplianceCategory
  title: string
  description: string
  guideline: string // e.g. "ICH Q1A(R2) §2.1"
  weight: number // 1-10, importance for overall score
}

export const ICH_Q1A_RULES: ComplianceRule[] = [
  {
    id: 'LT-001',
    category: 'study_design',
    title: 'Long-term study duration',
    description: 'Long-term studies should cover a minimum of 12 months at the time of submission, and continue for enough time to cover the proposed shelf life.',
    guideline: 'ICH Q1A(R2) §2.1.1',
    weight: 10,
  },
  {
    id: 'AC-001',
    category: 'study_design',
    title: 'Accelerated study conditions',
    description: 'Accelerated studies must be conducted at 40°C ± 2°C / 75% RH ± 5% RH for 6 months.',
    guideline: 'ICH Q1A(R2) §2.1.3',
    weight: 9,
  },
  {
    id: 'IN-001',
    category: 'study_design',
    title: 'Intermediate study conditions',
    description: 'Intermediate studies should be conducted at 30°C ± 2°C / 65% RH ± 5% RH for 12 months (required when significant change at accelerated).',
    guideline: 'ICH Q1A(R2) §2.1.2',
    weight: 8,
  },
  {
    id: 'ST-001',
    category: 'storage_conditions',
    title: 'Temperature tolerance',
    description: 'Storage temperature must remain within ±2°C of the specified set point throughout the study.',
    guideline: 'ICH Q1A(R2) §2.4',
    weight: 8,
  },
  {
    id: 'ST-002',
    category: 'storage_conditions',
    title: 'Humidity tolerance',
    description: 'Relative humidity must remain within ±5% RH of the set point throughout the study.',
    guideline: 'ICH Q1A(R2) §2.4',
    weight: 7,
  },
  {
    id: 'DU-001',
    category: 'duration',
    title: 'Timepoint coverage',
    description: 'Studies must include timepoints at 0, 3, 6, 9, 12 months (long-term) and 0, 3, 6 months (accelerated).',
    guideline: 'ICH Q1A(R2) §2.2.1',
    weight: 9,
  },
  {
    id: 'BA-001',
    category: 'batch_requirements',
    title: 'Minimum batch count',
    description: 'Stability data must be generated on at least 3 primary batches of the drug substance/product.',
    guideline: 'ICH Q1A(R2) §2.2.3',
    weight: 10,
  },
  {
    id: 'BA-002',
    category: 'batch_requirements',
    title: 'Batch size representative',
    description: 'At least 2 of the 3 batches should be at pilot scale (minimum 1/10 of commercial scale).',
    guideline: 'ICH Q1A(R2) §2.2.3',
    weight: 7,
  },
  {
    id: 'CC-001',
    category: 'container_closure',
    title: 'Container closure simulation',
    description: 'Stability studies must use the same container-closure system proposed for storage and distribution.',
    guideline: 'ICH Q1A(R2) §2.2.4',
    weight: 7,
  },
  {
    id: 'TF-001',
    category: 'testing_frequency',
    title: 'Long-term testing frequency',
    description: 'Long-term testing at 0, 3, 6, 9, 12, 18, 24, 36 months and annually thereafter.',
    guideline: 'ICH Q1A(R2) §2.2.1',
    weight: 8,
  },
  {
    id: 'SE-001',
    category: 'statistical_evaluation',
    title: 'Statistical analysis of data',
    description: 'Quantitative data should be evaluated by statistical methods to determine the stability profile and shelf life.',
    guideline: 'ICH Q1A(R2) §2.4',
    weight: 8,
  },
  {
    id: 'SE-002',
    category: 'statistical_evaluation',
    title: 'Out-of-specification handling',
    description: 'Any OOS result must be investigated and the impact on stability assessed per 21 CFR Part 211.192.',
    guideline: 'ICH Q1A(R2) §2.4 / 21 CFR 211.192',
    weight: 9,
  },
  {
    id: 'DO-001',
    category: 'documentation',
    title: 'Electronic signatures (21 CFR Part 11)',
    description: 'All stability data must be signed electronically by qualified personnel per 21 CFR Part 11.',
    guideline: '21 CFR Part 11',
    weight: 9,
  },
  {
    id: 'DO-002',
    category: 'documentation',
    title: 'Audit trail integrity',
    description: 'An audit trail capturing all data modifications must be maintained for at least 7 years.',
    guideline: '21 CFR Part 11.10(e)',
    weight: 7,
  },
  {
    id: 'RM-001',
    category: 'risk_management',
    title: 'ICH Q9 risk assessment',
    description: 'A formal risk assessment (ICH Q9) should be performed for any significant deviation or OOS event.',
    guideline: 'ICH Q9',
    weight: 6,
  },
  {
    id: 'RM-002',
    category: 'risk_management',
    title: 'Photostability testing (ICH Q1B)',
    description: 'Photostability testing per ICH Q1B Option 1 or Option 2 must be completed before submission.',
    guideline: 'ICH Q1B',
    weight: 7,
  },
]

export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  study_design: 'Study Design',
  storage_conditions: 'Storage Conditions',
  duration: 'Duration & Timepoints',
  batch_requirements: 'Batch Requirements',
  container_closure: 'Container Closure',
  testing_frequency: 'Testing Frequency',
  statistical_evaluation: 'Statistical Evaluation',
  documentation: 'Documentation & Signatures',
  risk_management: 'Risk Management',
}

export const COMPLIANCE_CATEGORY_COLORS: Record<ComplianceCategory, string> = {
  study_design: '#10b981',
  storage_conditions: '#14b8a6',
  duration: '#06b6d4',
  batch_requirements: '#0d9488',
  container_closure: '#0891b2',
  testing_frequency: '#059669',
  statistical_evaluation: '#0d9488',
  documentation: '#14b8a6',
  risk_management: '#06b6d4',
}

