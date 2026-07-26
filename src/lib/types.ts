// ── Types ──────────────────────────────────────────────────────────────────

export type PageId = 'dashboard' | 'molecules' | 'simulator' | 'studies' | 'reports' | 'analytics' | 'degradation' | 'admin' | 'compliance'

export interface MoleculeData {
  id: string
  name: string
  casNumber: string
  smiles: string
  formula: string
  molarMass: number
  logP: number
  stabilityScore: number
  riskLevel: string
  dataSource: string
  description: string
  meltingPoint: number | null
  boilingPoint: number | null
}

export interface StudyData {
  id: string
  studyCode: string
  substanceName: string
  studyType: string
  temperatureC: number
  humidityPercent: number | null
  durationMonths: number
  predictedShelfLifeMonths: number | null
  status: string
  ph: number | null
}

export interface ReportData {
  id: string
  title: string
  reportType: string
  status: string
  createdAt: string
}

export interface UserData {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLogin: string
}

export interface AuditEntry {
  id: string
  action: string
  tableName: string
  recordId: string
  details: string
  userName: string
  createdAt: string
}
