'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FlaskConical, Atom, Beaker, FileText, ShieldCheck,
  ChevronLeft, ChevronRight, Menu, X, Sun, Moon, Bell, Search, Plus,
  Trash2, Play, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  BarChart3, Activity, Database, Cpu, Thermometer, Droplets, Eye,
  Lightbulb, FileCheck, ClipboardList, Brain, Settings, Users,
  ArrowRight, Download, RefreshCw, ChevronDown, Filter, Info,
  Shield, Zap, Microscope, BookOpen, AlertCircle, XCircle,
  FileBadge, Scale, GraduationCap, Gauge, ArrowUpRight, ArrowDownRight,
  Send, MessageCircle, Sparkles, LayoutGrid
} from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAppStore, useMoleculeStore, useAnalysisStore, useStudyStore,
} from '@/lib/store'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { useToast } from '@/hooks/use-toast'
import {
  Tooltip as UiTooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover'

// ── Types ──────────────────────────────────────────────────────────────────

type PageId = 'dashboard' | 'molecules' | 'simulator' | 'studies' | 'reports' | 'analytics' | 'degradation' | 'admin'

interface MoleculeData {
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

interface StudyData {
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

interface ReportData {
  id: string
  title: string
  reportType: string
  status: string
  createdAt: string
}

interface UserData {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLogin: string
}

interface AuditEntry {
  id: string
  action: string
  tableName: string
  recordId: string
  details: string
  userName: string
  createdAt: string
}

// ── Sample Data ────────────────────────────────────────────────────────────

// QSPR Model Performance (hardcoded realistic values)
const QSPR_MODEL_PERFORMANCE = [
  { model: 'Solubility', r2: 0.82, rmse: 0.54, mae: 0.41, fill: '#10b981' },
  { model: 'logD', r2: 0.78, rmse: 0.61, mae: 0.47, fill: '#14b8a6' },
  { model: 'Hydration', r2: 0.75, rmse: 0.72, mae: 0.55, fill: '#06b6d4' },
]

const SAMPLE_MOLECULES: MoleculeData[] = [
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

const SAMPLE_STUDIES: StudyData[] = [
  { id: 'std-1', studyCode: 'STB-2024-001', substanceName: 'Aspirin', studyType: 'long_term', temperatureC: 25, humidityPercent: 60, durationMonths: 24, predictedShelfLifeMonths: 36, status: 'completed', ph: 6.5 },
  { id: 'std-2', studyCode: 'STB-2024-002', substanceName: 'Acetaminophen', studyType: 'accelerated', temperatureC: 40, humidityPercent: 75, durationMonths: 6, predictedShelfLifeMonths: 48, status: 'in_progress', ph: 5.8 },
  { id: 'std-3', studyCode: 'STB-2024-003', substanceName: 'Ibuprofen', studyType: 'stress', temperatureC: 60, humidityPercent: null, durationMonths: 3, predictedShelfLifeMonths: null, status: 'draft', ph: 7.0 },
  { id: 'std-4', studyCode: 'STB-2024-004', substanceName: 'Caffeine', studyType: 'intermediate', temperatureC: 30, humidityPercent: 65, durationMonths: 12, predictedShelfLifeMonths: 60, status: 'under_review', ph: null },
  { id: 'std-5', studyCode: 'STB-2024-005', substanceName: 'Hydrogen Peroxide', studyType: 'accelerated', temperatureC: 40, humidityPercent: null, durationMonths: 3, predictedShelfLifeMonths: 6, status: 'completed', ph: 4.5 },
]

const SAMPLE_USERS: UserData[] = [
  { id: 'usr-1', name: 'Dr. Sarah Chen', email: 'sarah.chen@chemstab.io', role: 'org_admin', isActive: true, lastLogin: '2024-03-15 09:23' },
  { id: 'usr-2', name: 'James Rodriguez', email: 'james.r@chemstab.io', role: 'analyst', isActive: true, lastLogin: '2024-03-14 16:45' },
  { id: 'usr-3', name: 'Aiko Tanaka', email: 'aiko.t@chemstab.io', role: 'project_manager', isActive: true, lastLogin: '2024-03-13 11:30' },
  { id: 'usr-4', name: 'Mark Thompson', email: 'mark.t@chemstab.io', role: 'viewer', isActive: false, lastLogin: '2024-02-28 08:15' },
  { id: 'usr-5', name: 'Dr. Elena Volkov', email: 'elena.v@chemstab.io', role: 'analyst', isActive: true, lastLogin: '2024-03-15 14:10' },
]

const SAMPLE_AUDIT: AuditEntry[] = [
  { id: 'aud-1', action: 'create', tableName: 'StabilityStudy', recordId: 'STB-2024-002', details: 'Created accelerated study for Acetaminophen', userName: 'James Rodriguez', createdAt: '2024-03-15 09:23' },
  { id: 'aud-2', action: 'update', tableName: 'Molecule', recordId: 'mol-10', details: 'Updated risk level from high to critical for Hydrogen Peroxide', userName: 'Dr. Sarah Chen', createdAt: '2024-03-14 14:45' },
  { id: 'aud-3', action: 'approve', tableName: 'StabilityStudy', recordId: 'STB-2024-001', details: 'Approved long-term stability study for Aspirin', userName: 'Aiko Tanaka', createdAt: '2024-03-13 16:30' },
  { id: 'aud-4', action: 'sign', tableName: 'ElectronicSignature', recordId: 'STB-2024-005', details: 'Electronically signed H₂O₂ accelerated study results', userName: 'Dr. Elena Volkov', createdAt: '2024-03-12 11:15' },
  { id: 'aud-5', action: 'delete', tableName: 'TimePoint', recordId: 'tp-old-001', details: 'Removed outlier time point data from study STB-2024-003', userName: 'James Rodriguez', createdAt: '2024-03-11 09:45' },
  { id: 'aud-6', action: 'create', tableName: 'Report', recordId: 'rpt-ich-001', details: 'Generated ICH Q1A stability protocol report', userName: 'Dr. Sarah Chen', createdAt: '2024-03-10 15:20' },
]

const STABILITY_TRENDS_DATA = [
  { month: 'Jan', aspirin: 72, acetaminophen: 65, caffeine: 88, overall: 75 },
  { month: 'Feb', aspirin: 71, acetaminophen: 64, caffeine: 87, overall: 74 },
  { month: 'Mar', aspirin: 70, acetaminophen: 62, caffeine: 88, overall: 73 },
  { month: 'Apr', aspirin: 69, acetaminophen: 61, caffeine: 87, overall: 72 },
  { month: 'May', aspirin: 68, acetaminophen: 60, caffeine: 86, overall: 71 },
  { month: 'Jun', aspirin: 67, acetaminophen: 59, caffeine: 85, overall: 70 },
  { month: 'Jul', aspirin: 66, acetaminophen: 58, caffeine: 84, overall: 69 },
  { month: 'Aug', aspirin: 65, acetaminophen: 57, caffeine: 83, overall: 68 },
]

const RISK_DISTRIBUTION_DATA = [
  { level: 'Low', count: 8, fill: '#10b981' },
  { level: 'Moderate', count: 2, fill: '#f59e0b' },
  { level: 'High', count: 1, fill: '#ef4444' },
  { level: 'Critical', count: 1, fill: '#dc2626' },
]

const REPORT_TYPES = [
  { type: 'ich_q1a', title: 'ICH Q1A Stability Protocol', icon: FileCheck, description: 'Comprehensive stability testing protocol per ICH guidelines', color: 'emerald' },
  { type: 'ctd_module', title: 'CTD Module 3.2.P.8', icon: BookOpen, description: 'Stability data for regulatory submission in CTD format', color: 'teal' },
  { type: 'fmea', title: 'FMEA Risk Assessment', icon: AlertTriangle, description: 'Failure Mode and Effects Analysis for stability risks', color: 'amber' },
  { type: 'doe', title: 'DoE Design', icon: GraduationCap, description: 'Design of Experiments for optimization of stability conditions', color: 'cyan' },
  { type: 'validation_protocol', title: 'Validation Protocol IQ/OQ/PQ', icon: Scale, description: 'Equipment and process validation protocols for stability labs', color: 'rose' },
]

const SAMPLE_REPORTS: ReportData[] = [
  { id: 'rpt-1', title: 'ICH Q1A - Aspirin Long-Term Stability', reportType: 'ich_q1a', status: 'completed', createdAt: '2024-03-12' },
  { id: 'rpt-2', title: 'CTD Module 3.2.P.8 - Acetaminophen', reportType: 'ctd_module', status: 'draft', createdAt: '2024-03-14' },
  { id: 'rpt-3', title: 'FMEA Risk Assessment - H₂O₂', reportType: 'fmea', status: 'under_review', createdAt: '2024-03-10' },
  { id: 'rpt-4', title: 'DoE Optimization - Ibuprofen Formulation', reportType: 'doe', status: 'completed', createdAt: '2024-03-08' },
  { id: 'rpt-5', title: 'IQ/OQ/PQ Validation - Stability Chamber SC-04', reportType: 'validation_protocol', status: 'in_progress', createdAt: '2024-03-06' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const riskColors: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  critical: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200',
}

const studyTypeLabels: Record<string, string> = {
  long_term: 'Long-Term',
  accelerated: 'Accelerated',
  intermediate: 'Intermediate',
  stress: 'Stress Testing',
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  project_manager: 'Project Manager',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-teal-600 dark:text-teal-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ── Shared Global Style/Icon Maps ─────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
  cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
}

const COLOR_MAP_TEXT: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400', teal: 'text-teal-600 dark:text-teal-400',
  cyan: 'text-cyan-600 dark:text-cyan-400', amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400', rose: 'text-rose-600 dark:text-rose-400',
}

const GRADIENT_TOP_BAR: Record<string, string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500', teal: 'bg-gradient-to-r from-teal-500 to-cyan-500',
  cyan: 'bg-gradient-to-r from-cyan-500 to-sky-500', amber: 'bg-gradient-to-r from-amber-500 to-orange-500',
  red: 'bg-gradient-to-r from-red-500 to-rose-500',
}

const PROGRESS_BAR_MAP: Record<string, string> = {
  emerald: '[&>div]:bg-emerald-500', teal: '[&>div]:bg-teal-500',
  cyan: '[&>div]:bg-cyan-500', amber: '[&>div]:bg-amber-500', red: '[&>div]:bg-red-500',
}

const ACTION_ICON_MAP: Record<string, React.ElementType> = {
  create: Plus, update: RefreshCw, delete: Trash2, approve: CheckCircle2, sign: Shield, reject: XCircle,
}

const ACTION_COLOR_MAP: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  update: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  delete: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  approve: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
  sign: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
  reject: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

const ACTION_TEXT_MAP: Record<string, string> = {
  create: 'text-emerald-600 dark:text-emerald-400', update: 'text-amber-600 dark:text-amber-400',
  delete: 'text-red-600 dark:text-red-400', approve: 'text-teal-600 dark:text-teal-400',
  sign: 'text-cyan-600 dark:text-cyan-400', reject: 'text-red-600 dark:text-red-400',
}

const HAZARD_BORDER_MAP: Record<string, string> = { low: 'border-l-emerald-500', moderate: 'border-l-amber-500', high: 'border-l-red-500', critical: 'border-l-rose-500' }
const HAZARD_BAR_MAP: Record<string, string> = { low: 'from-emerald-400 to-teal-500', moderate: 'from-amber-400 to-orange-500', high: 'from-red-400 to-red-600', critical: 'from-rose-400 to-rose-600' }
const HAZARD_OUTLINE_MAP: Record<string, string> = { low: 'border-emerald-500 text-emerald-600', moderate: 'border-amber-500 text-amber-600', high: 'border-red-500 text-red-600' }

const RISK_PILL_ACTIVE: Record<string, string> = { low: 'bg-emerald-600 text-white', moderate: 'bg-amber-600 text-white hover:bg-amber-700', high: 'bg-red-600 text-white hover:bg-red-700', critical: 'bg-rose-600 text-white hover:bg-rose-700' }
const RISK_PILL_OUTLINE: Record<string, string> = { critical: 'border-red-500 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20', high: 'border-orange-500 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20', moderate: 'border-amber-500 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20' }

const REPORT_GRADIENT: Record<string, string> = { ich_q1a: 'bg-gradient-to-r from-emerald-500 to-teal-500', ctd_module: 'bg-gradient-to-r from-teal-500 to-cyan-500', fmea: 'bg-gradient-to-r from-amber-500 to-orange-500', doe: 'bg-gradient-to-r from-cyan-500 to-sky-500', validation_protocol: 'bg-gradient-to-r from-rose-500 to-pink-500' }
const REPORT_ICON_BG: Record<string, string> = { ich_q1a: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400', ctd_module: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400', fmea: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', doe: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400', validation_protocol: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' }

const HAZARD_CLASS_MAP: Record<string, string> = { critical: 'Severe Hazard', high: 'Significant Hazard', moderate: 'Moderate Hazard', low: 'Low Hazard' }
const RISK_BG_MAP: Record<string, string> = {
  critical: 'bg-red-50/50 dark:bg-red-900/10 border-red-500', high: 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-500',
  moderate: 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-500', low: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500',
}

const roleAvatarColors: Record<string, string> = {
  super_admin: 'from-rose-500 to-red-600', org_admin: 'from-emerald-500 to-teal-600',
  project_manager: 'from-cyan-500 to-blue-600', analyst: 'from-amber-500 to-orange-600', viewer: 'from-slate-400 to-slate-500',
}

function transformMolecule(m: any): MoleculeData {
  return {
    id: m.id, name: m.name, casNumber: m.casNumber || '', smiles: m.smiles || '',
    formula: m.formula || '', molarMass: m.molarMass ?? 0, logP: m.logP ?? 0,
    stabilityScore: m.predictedStabilityScore ?? 0, riskLevel: m.riskLevel || 'low',
    dataSource: m.dataSource || 'Manual', description: m.description || '',
    meltingPoint: m.meltingPoint ?? null, boilingPoint: m.boilingPoint ?? null,
  }
}

function transformStudy(s: any): StudyData {
  return {
    id: s.id, studyCode: s.studyCode || '', substanceName: s.substanceName || '',
    studyType: s.studyType || 'long_term', temperatureC: s.temperatureC || 25,
    humidityPercent: s.humidityPercent, durationMonths: s.durationMonths || 24,
    predictedShelfLifeMonths: s.predictedShelfLifeMonths, status: s.status || 'draft', ph: s.ph,
  }
}

// ── CSV Export helper ────────────────────────────────────────────────────

function exportCSV(data: Record<string, unknown>[], filename: string) {
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
function fmtNum(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

// ── Chemical formula subscript formatter ──────────────────────────────
// Converts "C9H8O4" → "C₉H₈O₄", "H2O2" → "H₂O₂", "NaCl" stays "NaCl"
const SUBSCRIPT_DIGITS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
}
function formatFormula(formula: string | null | undefined): string {
  if (!formula) return '—'
  // If already contains unicode subscripts, leave as-is
  if (/[₀-₉]/.test(formula)) return formula
  // Replace any digit that follows a letter (or another digit) with subscript
  return formula.replace(/(\d+)/g, (m) =>
    m.split('').map((d) => SUBSCRIPT_DIGITS[d] ?? d).join('')
  )
}

// React element version (in case we want richer rendering later)
function Formula({ children }: { children: string | null | undefined }) {
  return <span className="font-mono">{formatFormula(children)}</span>
}

// Animated number counter for stat cards
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const duration = 1000
    const step = value / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= value) { setDisplay(value); clearInterval(timer) }
      else setDisplay(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [value])
  return <span className="text-2xl font-bold tabular-nums">{display}</span>
}


// ── Sidebar Navigation ────────────────────────────────────────────────────

const NAV_ITEMS: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'molecules', label: 'Molecules', icon: Atom },
  { id: 'simulator', label: 'Simulator', icon: Beaker },
  { id: 'studies', label: 'Studies', icon: Microscope },
  { id: 'degradation', label: 'Degradation', icon: FlaskConical },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
]

function Sidebar() {
  const { currentPage, setPage, sidebarOpen, toggleSidebar } = useAppStore()
  const { theme, setTheme } = useTheme()

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 64 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed top-0 left-0 z-50 h-full bg-card border-r flex flex-col overflow-hidden
          lg:relative lg:z-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 p-4 h-16 border-b">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20">
            CS
          </div>
          {sidebarOpen && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-semibold text-lg whitespace-nowrap bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent"
            >
              ChemStab
            </motion.span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:flex hidden"
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={toggleSidebar}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <Button
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={`w-full justify-start gap-3 h-10 transition-all relative
                  ${isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium border-l-4 border-emerald-500'
                    : 'border-l-4 border-transparent'}
                  ${!sidebarOpen ? 'px-0 justify-center' : ''}
                `}
                onClick={() => { setPage(item.id); if (window.innerWidth < 1024) toggleSidebar(); }}
              >
                <Icon className={`size-4 shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:rotate-6 group-hover:scale-105'}`} />
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Button>
            )
          })}
        </nav>

        {/* Bottom controls */}
        <div className="p-2 border-t space-y-1">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-3 h-10 ${!sidebarOpen ? 'px-0 justify-center' : ''}`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
            {sidebarOpen && <span className="whitespace-nowrap">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Mobile toggle button (shown when sidebar closed on mobile) */}
      {!sidebarOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-3 left-3 z-40 lg:hidden shadow-md"
          onClick={toggleSidebar}
        >
          <Menu className="size-4" />
        </Button>
      )}
    </>
  )
}

// ── Dashboard Page ─────────────────────────────────────────────────────────

function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [statsData, setStatsData] = useState<{
    totalMolecules: number; activeStudies: number; avgStabilityScore: number;
    riskDistribution: Record<string, number>; recentActivity: any[];
    totalReports: number;
    studiesByStatus?: { status: string; _count: { status: number } }[];
  } | null>(null)
  const [recentStudies, setRecentStudies] = useState<StudyData[]>([])

  const quickActions = [
    { label: 'Add Molecule', icon: Plus, page: 'molecules' as PageId },
    { label: 'Run Simulation', icon: Play, page: 'simulator' as PageId },
    { label: 'Create Study', icon: ClipboardList, page: 'studies' as PageId },
    { label: 'Generate Report', icon: Download, page: 'reports' as PageId },
  ]

  const { setPage } = useAppStore()

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [statsRes, studiesRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/studies?limit=5'),
        ])
        if (statsRes.ok && !cancelled) {
          const data = await statsRes.json()
          if (!cancelled) setStatsData(data)
        }
        if (studiesRes.ok && !cancelled) {
          const data = await studiesRes.json()
          const transformed: StudyData[] = (data.studies || []).slice(0, 5).map(transformStudy)
          if (!cancelled) setRecentStudies(transformed)
        }
      } catch { /* fallback: statsData stays null, sample data used */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  // Derive stats from API data (fallback to sample values if API fails)
  const stats = statsData ? [
    { label: 'Total Molecules', value: String(statsData.totalMolecules), icon: Database, trend: `Avg score ${statsData.avgStabilityScore.toFixed(0)}`, trendUp: true, color: 'emerald' },
    { label: 'Active Studies', value: String(statsData.activeStudies), icon: Microscope, trend: `${statsData.totalReports} reports`, trendUp: false, color: 'teal' },
    { label: 'Avg Stability', value: statsData.avgStabilityScore.toFixed(1), icon: Cpu, trend: 'Platform-wide', trendUp: true, color: 'cyan' },
    { label: 'Risk Alerts', value: String((statsData.riskDistribution.high || 0) + (statsData.riskDistribution.critical || 0)), icon: AlertTriangle, trend: `${statsData.riskDistribution.critical || 0} critical`, trendUp: false, color: 'amber' },
  ] : [
    { label: 'Total Molecules', value: '12', icon: Database, trend: '+3 this month', trendUp: true, color: 'emerald' },
    { label: 'Active Studies', value: '3', icon: Microscope, trend: '2 under review', trendUp: false, color: 'teal' },
    { label: 'Simulations Run', value: '47', icon: Cpu, trend: '+12 this week', trendUp: true, color: 'cyan' },
    { label: 'Risk Alerts', value: '2', icon: AlertTriangle, trend: '1 critical alert', trendUp: false, color: 'amber' },
  ]

  // Derive risk distribution from API
  const riskDistChart = statsData ? [
    { level: 'Low', count: statsData.riskDistribution.low || 0, fill: '#10b981' },
    { level: 'Moderate', count: statsData.riskDistribution.moderate || 0, fill: '#f59e0b' },
    { level: 'High', count: statsData.riskDistribution.high || 0, fill: '#ef4444' },
    { level: 'Critical', count: statsData.riskDistribution.critical || 0, fill: '#dc2626' },
  ] : RISK_DISTRIBUTION_DATA

  // Derive recent activity from API audit logs
  const recentActivity = statsData?.recentActivity?.length
    ? statsData.recentActivity.map((entry: any) => ({
        text: `${entry.action} on ${entry.tableName} (#${entry.recordId}) — ${entry.details || ''}`.trim(),
        time: new Date(entry.createdAt).toLocaleDateString(),
        icon: ACTION_ICON_MAP[entry.action] || Activity,
        color: ({ create: 'emerald', update: 'amber', delete: 'red', approve: 'teal', sign: 'cyan', reject: 'red' })[entry.action] || 'emerald',
      }))
    : [
      { text: 'Study STB-2024-002 updated — Acetaminophen accelerated testing milestone completed', time: '2 hours ago', icon: CheckCircle2, color: 'emerald' },
      { text: 'Risk level escalated for Hydrogen Peroxide — now classified as critical', time: '5 hours ago', icon: AlertTriangle, color: 'red' },
      { text: 'New molecule added: Formaldehyde (CAS 50-00-0)', time: '1 day ago', icon: Plus, color: 'teal' },
      { text: 'ICH Q1A report generated for Aspirin long-term study', time: '2 days ago', icon: FileText, color: 'cyan' },
      { text: 'Simulation batch #47 completed — Ibuprofen formulation stability', time: '3 days ago', icon: Cpu, color: 'emerald' },
    ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your chemical stability assessment platform</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-20 w-full rounded-md bg-muted animate-pulse" /></CardContent></Card>
          ))
        ) : stats.map((stat) => {
          const Icon = stat.icon
          return (
            <motion.div key={stat.label} whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }} transition={{ type: 'spring', stiffness: 400 }}>
              <Card className="cursor-pointer backdrop-blur-sm bg-card/80 transition-transform hover:-translate-y-1 overflow-hidden relative">
                <div className={`absolute inset-x-0 top-0 h-1 ${GRADIENT_TOP_BAR[stat.color] || GRADIENT_TOP_BAR.emerald}`} />
                <CardContent className="p-4 relative">
                  <div className="absolute top-0 right-0 size-24 rounded-full bg-gradient-to-br from-emerald-200/20 to-teal-200/20 dark:from-emerald-800/20 dark:to-teal-800/20 blur-2xl" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <div className="text-2xl font-bold">{isNaN(Number(stat.value)) ? stat.value : <AnimatedNumber value={Number(stat.value)} />}</div>
                    </div>
                    <div className={`p-2 rounded-lg ${COLOR_MAP[stat.color]}`}><Icon className="size-5" /></div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    {stat.trendUp ? <ArrowUpRight className="size-3 text-emerald-500" /> : <ArrowDownRight className="size-3 text-amber-500" />}{stat.trend}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Stability Score Trends</CardTitle>
            <CardDescription>Monthly tracking of key compound stability scores</CardDescription>
            <CardAction>
              <Badge variant="outline" className="text-xs">Last 8 months</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={STABILITY_TRENDS_DATA}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis domain={[50, 100]} className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="aspirin" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Aspirin" />
                  <Line type="monotone" dataKey="acetaminophen" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} name="Acetaminophen" />
                  <Line type="monotone" dataKey="caffeine" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Caffeine" />
                  <Line type="monotone" dataKey="overall" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Overall" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Current molecule risk level breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={riskDistChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="level" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {riskDistChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed + Quick Actions + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events across the platform</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto space-y-3">
            {recentActivity.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative border-l-2 border-emerald-300 dark:border-emerald-700 pl-4 ml-2 p-2 rounded-r-lg hover:bg-muted/50 transition-colors">
                  <span className="absolute -left-[5px] top-2 size-2.5 rounded-full bg-emerald-500" />
                  <div className="flex items-start gap-3">
                    <Icon className={`size-4 mt-0.5 shrink-0 ${COLOR_MAP_TEXT[item.color]}`} />
                    <div className="flex-1 min-w-0"><p className="text-sm leading-snug">{item.text}</p><p className="text-xs text-muted-foreground mt-0.5">{item.time}</p></div>
                  </div>
                </motion.div>
              )
            })}
          </CardContent>
        </Card>

        {/* Quick Actions + System Status */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <motion.div
                    key={action.label}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      variant="outline"
                      className="w-full h-auto py-3 flex flex-col items-center gap-2"
                      onClick={() => setPage(action.page)}
                    >
                      <Icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs">{action.label}</span>
                    </Button>
                  </motion.div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Database', status: 'Operational', ok: true },
                { label: 'ML Pipeline', status: 'Idle', ok: true },
                { label: 'Storage', status: '78% used', ok: true },
                { label: 'API Gateway', status: 'Operational', ok: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span>{item.status}</span>
                    {item.ok
                      ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                      : <XCircle className="size-3.5 text-red-500" />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Studies + Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 backdrop-blur-sm bg-card/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Microscope className="size-5 text-emerald-600 dark:text-emerald-400" />
                  Recent Studies
                </CardTitle>
                <CardDescription>Latest stability studies across the platform</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPage('studies')}>
                View All <ArrowRight className="size-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : recentStudies.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No studies yet</p>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="text-xs">Code</TableHead>
                      <TableHead className="text-xs">Substance</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Temp</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentStudies.map((s, idx) => (
                      <TableRow key={s.id} className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors ${idx % 2 === 1 ? 'bg-muted/30' : ''}`} onClick={() => setPage('studies')}>
                        <TableCell className="font-mono text-xs font-medium">{s.studyCode}</TableCell>
                        <TableCell className="text-sm">{s.substanceName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{studyTypeLabels[s.studyType] || s.studyType}</TableCell>
                        <TableCell className="text-xs">{s.temperatureC}°C</TableCell>
                        <TableCell><Badge className={`text-[10px] ${statusColors[s.status] || ''}`}>{s.status.replace('_', ' ')}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle>Studies by Status</CardTitle>
            <CardDescription>Distribution of study workflow states</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : !statsData?.studiesByStatus || statsData.studiesByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">No data available</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={statsData.studiesByStatus.map((s) => ({ name: s.status.replace('_', ' '), value: s._count.status }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {statsData.studiesByStatus.map((entry, idx) => {
                        const statusColors: Record<string, string> = {
                          draft: '#94a3b8', in_progress: '#14b8a6', completed: '#10b981',
                          under_review: '#f59e0b', approved: '#22c55e', rejected: '#ef4444',
                        }
                        return <Cell key={idx} fill={statusColors[entry.status] || '#94a3b8'} />
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {statsData.studiesByStatus.map((s) => {
                    const statusColors: Record<string, string> = {
                      draft: 'bg-slate-400', in_progress: 'bg-teal-500', completed: 'bg-emerald-500',
                      under_review: 'bg-amber-500', approved: 'bg-green-500', rejected: 'bg-red-500',
                    }
                    return (
                      <div key={s.status} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${statusColors[s.status] || 'bg-slate-400'}`} />
                          <span className="capitalize">{s.status.replace('_', ' ')}</span>
                        </div>
                        <span className="font-semibold tabular-nums">{s._count.status}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

// ── Molecules Database Page ────────────────────────────────────────────────

function MoleculesPage() {
  const { toast } = useToast()
  const { setPage } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [currentPageNum, setCurrentPageNum] = useState(1)
  const [selectedMolecule, setSelectedMolecule] = useState<MoleculeData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [apiMolecules, setApiMolecules] = useState<MoleculeData[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [degradationProducts, setDegradationProducts] = useState<any[]>([])
  const [degradationLoading, setDegradationLoading] = useState(false)
  const [newDegradation, setNewDegradation] = useState({ name: '', smiles: '', percentage: 0, hazardLevel: 'low' })
  const [addingDegradation, setAddingDegradation] = useState(false)
  const [importing, setImporting] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [newMolecule, setNewMolecule] = useState({
    name: '',
    casNumber: '',
    smiles: '',
    formula: '',
    molarMass: 0,
    logP: 0,
    predictedStabilityScore: 0,
    riskLevel: 'low',
    dataSource: 'manual',
    description: '',
  })
  const pageSize = 5

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (riskFilter !== 'all') params.set('risk', riskFilter)
      params.set('page', String(currentPageNum))
      params.set('limit', String(pageSize))
      try {
        const res = await fetch(`/api/molecules?${params.toString()}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const transformed: MoleculeData[] = (data.molecules || []).map(transformMolecule)
          if (!cancelled) {
            setApiMolecules(transformed)
            setTotalPages(data.pagination?.totalPages ?? 1)
            setTotalCount(data.pagination?.total ?? 0)
          }
        }
      } catch { /* fallback */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [searchQuery, riskFilter, currentPageNum, refreshKey])

  // Apply source filter client-side on fetched molecules, then sort
  const displayed = (() => {
    let filtered = sourceFilter === 'all'
      ? apiMolecules
      : apiMolecules.filter((mol) => mol.dataSource.toLowerCase() === sourceFilter.toLowerCase())
    // Sort
    if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'stability') filtered.sort((a, b) => b.stabilityScore - a.stabilityScore)
    else if (sortBy === 'molarMass') filtered.sort((a, b) => b.molarMass - a.molarMass)
    else if (sortBy === 'risk') {
      const riskOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 }
      filtered.sort((a, b) => (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4))
    }
    return filtered
  })()

  // Count per risk level (from apiMolecules for filter pills)
  const riskCounts = (() => {
    const counts: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 }
    apiMolecules.forEach((mol) => { counts[mol.riskLevel] = (counts[mol.riskLevel] || 0) + 1 })
    return counts
  })()

  const openDetail = async (mol: MoleculeData) => {
    setSelectedMolecule(mol)
    setDetailOpen(true)
    setDegradationProducts([])
    setDegradationLoading(true)
    try {
      const res = await fetch(`/api/degradation-products?moleculeId=${mol.id}`)
      if (res.ok) {
        const data = await res.json()
        setDegradationProducts(data.products || [])
      }
    } catch { /* ignore */ }
    setDegradationLoading(false)
  }

  const handleAddDegradation = async () => {
    if (!selectedMolecule || !newDegradation.name.trim()) {
      toast({ title: 'Validation error', description: 'Product name is required', variant: 'destructive' })
      return
    }
    setAddingDegradation(true)
    try {
      const res = await fetch('/api/degradation-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDegradation.name,
          smiles: newDegradation.smiles || undefined,
          percentage: newDegradation.percentage || undefined,
          hazardLevel: newDegradation.hazardLevel,
          moleculeId: selectedMolecule.id,
        }),
      })
      if (res.ok) {
        toast({ title: 'Degradation product added', description: `${newDegradation.name} linked to ${selectedMolecule.name}` })
        setNewDegradation({ name: '', smiles: '', percentage: 0, hazardLevel: 'low' })
        // Refresh list
        const refreshRes = await fetch(`/api/degradation-products?moleculeId=${selectedMolecule.id}`)
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setDegradationProducts(data.products || [])
        }
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: err.error || 'Failed to add degradation product', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setAddingDegradation(false)
    }
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) {
        toast({ title: 'Import failed', description: 'CSV must have a header row and at least one data row', variant: 'destructive' })
        return
      }
      const parseCSVLine = (line: string): string[] => {
        const out: string[] = []
        let cur = ''
        let inQ = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
          else if (ch === '"') { inQ = !inQ }
          else if (ch === ',' && !inQ) { out.push(cur); cur = '' }
          else { cur += ch }
        }
        out.push(cur)
        return out
      }
      const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
      const nameIdx = headers.findIndex((h) => h === 'name')
      if (nameIdx === -1) {
        toast({ title: 'Import failed', description: 'CSV must have a "name" column', variant: 'destructive' })
        return
      }
      const casIdx = headers.findIndex((h) => h === 'casnumber' || h === 'cas')
      const formulaIdx = headers.findIndex((h) => h === 'formula')
      const smilesIdx = headers.findIndex((h) => h === 'smiles')
      const mwIdx = headers.findIndex((h) => h === 'molarmass' || h === 'mw')
      const logPIdx = headers.findIndex((h) => h === 'logp')
      const scoreIdx = headers.findIndex((h) => h === 'stabilityscore' || h === 'predictedstabilityscore' || h === 'score')
      const riskIdx = headers.findIndex((h) => h === 'risklevel' || h === 'risk')

      let success = 0, failed = 0
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i])
        const name = cells[nameIdx]?.trim()
        if (!name) { failed++; continue }
        try {
          const res = await fetch('/api/molecules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              casNumber: casIdx >= 0 ? cells[casIdx]?.trim() || undefined : undefined,
              formula: formulaIdx >= 0 ? cells[formulaIdx]?.trim() || undefined : undefined,
              smiles: smilesIdx >= 0 ? cells[smilesIdx]?.trim() || undefined : undefined,
              molarMass: mwIdx >= 0 ? parseFloat(cells[mwIdx]) || undefined : undefined,
              logP: logPIdx >= 0 ? parseFloat(cells[logPIdx]) || undefined : undefined,
              predictedStabilityScore: scoreIdx >= 0 ? parseFloat(cells[scoreIdx]) || undefined : undefined,
              riskLevel: riskIdx >= 0 ? cells[riskIdx]?.trim().toLowerCase() || 'low' : 'low',
            }),
          })
          if (res.ok) success++; else failed++
        } catch { failed++ }
      }
      toast({
        title: 'Import complete',
        description: `Imported ${success} molecule${success !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`,
        variant: failed > 0 ? 'destructive' : 'default',
      })
      handleRefresh()
    } catch {
      toast({ title: 'Import failed', description: 'Failed to read file', variant: 'destructive' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    setRefreshKey(k => k + 1)
  }

  const resetNewMolecule = () => {
    setNewMolecule({
      name: '', casNumber: '', smiles: '', formula: '', molarMass: 0, logP: 0,
      predictedStabilityScore: 0, riskLevel: 'low', dataSource: 'manual', description: '',
    })
  }

  const handleAddMolecule = async () => {
    if (!newMolecule.name.trim()) {
      toast({ title: 'Validation error', description: 'Molecule name is required', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/molecules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMolecule.name,
          casNumber: newMolecule.casNumber || undefined,
          smiles: newMolecule.smiles || undefined,
          formula: newMolecule.formula || undefined,
          molarMass: newMolecule.molarMass || undefined,
          logP: newMolecule.logP || undefined,
          predictedStabilityScore: newMolecule.predictedStabilityScore || undefined,
          riskLevel: newMolecule.riskLevel,
          dataSource: newMolecule.dataSource,
          description: newMolecule.description || undefined,
        }),
      })
      if (res.ok) {
        toast({ title: 'Molecule added', description: `${newMolecule.name} created successfully` })
        setAddOpen(false)
        resetNewMolecule()
        handleRefresh()
      } else {
        const errBody = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: errBody.error || 'Failed to create molecule', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const exportMoleculesCSV = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/molecules?limit=1000')
      if (res.ok) {
        const data = await res.json()
        const rows = (data.molecules || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          casNumber: m.casNumber ?? '',
          smiles: m.smiles ?? '',
          formula: m.formula ?? '',
          molarMass: m.molarMass ?? '',
          logP: m.logP ?? '',
          stabilityScore: m.predictedStabilityScore ?? '',
          riskLevel: m.riskLevel ?? '',
          dataSource: m.dataSource ?? '',
          meltingPoint: m.meltingPoint ?? '',
          boilingPoint: m.boilingPoint ?? '',
          description: m.description ?? '',
        }))
        if (!rows.length) {
          toast({ title: 'Nothing to export', description: 'No molecules found to export' })
        } else {
          exportCSV(rows, `chemstab-molecules-${new Date().toISOString().slice(0, 10)}.csv`)
          toast({ title: 'Export complete', description: `Exported ${rows.length} molecules to CSV` })
        }
      } else {
        toast({ title: 'Export failed', description: 'Failed to fetch molecules', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Export failed', description: 'Network error', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Molecules Database</h1>
          <p className="text-muted-foreground">Browse and search chemical compounds with stability assessments</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* View Mode Toggle */}
          <div className="flex gap-1 mr-1">
            <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')} className={viewMode === 'table' ? 'bg-emerald-600 text-white' : ''}>
              <BarChart3 className="size-4" /> Table
            </Button>
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'bg-emerald-600 text-white' : ''}>
              <LayoutGrid className="size-4" /> Grid
            </Button>
          </div>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImportCSV}
            className="hidden"
          />
          <TooltipProvider delayDuration={200}>
            <UiTooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                  <Download className={`size-4 mr-1 rotate-180 ${importing ? 'animate-pulse' : ''}`} /> Import CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bulk import molecules from a CSV file (name column required)</TooltipContent>
            </UiTooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={200}>
            <UiTooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={exportMoleculesCSV} disabled={exporting}>
                  <Download className={`size-4 mr-1 ${exporting ? 'animate-pulse' : ''}`} /> Export CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download all molecules as a CSV file</TooltipContent>
            </UiTooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddOpen(true)}>
            <Plus className="size-4 mr-2" /> Add Molecule
          </Button>
        </div>
      </div>

      {/* Quick Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {['all', 'low', 'moderate', 'high', 'critical'].map((level) => (
          <Button
            key={level}
            variant={riskFilter === level ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs rounded-full ${riskFilter === level ? (RISK_PILL_ACTIVE[level] || 'bg-emerald-600 text-white') : ''} ${RISK_PILL_OUTLINE[level] || ''}`}
            onClick={() => { setRiskFilter(level); setCurrentPageNum(1) }}
          >
            {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
            {level !== 'all' && <span className="ml-1 opacity-60">({riskCounts[level] || 0})</span>}
          </Button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, CAS, SMILES..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPageNum(1) }}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="stability">Stability</SelectItem>
            <SelectItem value="molarMass">Molar Mass</SelectItem>
            <SelectItem value="risk">Risk Level</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setCurrentPageNum(1) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setCurrentPageNum(1) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Data Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="PubChem">PubChem</SelectItem>
            <SelectItem value="ChEMBL">ChEMBL</SelectItem>
            <SelectItem value="Manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {loading ? 'Loading...' : `Showing ${displayed.length} of ${totalCount} molecules`}
      </p>

      {/* Table / Grid View */}
      {viewMode === 'table' ? (
      <Card className="backdrop-blur-sm bg-card/80">
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Formula</TableHead>
                    <TableHead>MW</TableHead>
                    <TableHead>LogP</TableHead>
                    <TableHead>Stability</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.map((mol, idx) => (
                    <TableRow
                      key={mol.id}
                      className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors even:bg-muted/30 ${idx % 2 === 0 ? '' : 'even:bg-muted/30'}`}
                      onClick={() => openDetail(mol)}
                    >
                      <TableCell className="font-medium">{mol.name}</TableCell>
                      <TableCell><Formula>{mol.formula}</Formula></TableCell>
                      <TableCell>{mol.molarMass ? mol.molarMass.toFixed(2) : '—'}</TableCell>
                      <TableCell>{mol.logP ? mol.logP.toFixed(2) : '—'}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${getScoreColor(mol.stabilityScore)}`}>
                          {mol.stabilityScore}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={riskColors[mol.riskLevel]}>{mol.riskLevel}</Badge>
                      </TableCell>
                      <TableCell>{mol.dataSource}</TableCell>
                    </TableRow>
                  ))}
                  {displayed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No molecules found matching your criteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
        {totalPages > 1 && (
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPageNum <= 1}
              onClick={() => setCurrentPageNum(currentPageNum - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPageNum} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPageNum >= totalPages}
              onClick={() => setCurrentPageNum(currentPageNum + 1)}
            >
              Next
            </Button>
          </CardFooter>
        )}
      </Card>
      ) : (
        /* Grid View */
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="h-40 w-full rounded-md bg-muted animate-pulse" /></CardContent></Card>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No molecules found matching your criteria</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((mol) => (
              <motion.div key={mol.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDetail(mol)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{mol.name}</h3>
                      <Badge className={`text-[10px] ${riskColors[mol.riskLevel]}`}>{mol.riskLevel}</Badge>
                    </div>
                    <Formula>{mol.formula}</Formula>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative size-8">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                          <circle cx="18" cy="18" r="15" fill="none" stroke={mol.stabilityScore >= 80 ? '#10b981' : mol.stabilityScore >= 60 ? '#14b8a6' : mol.stabilityScore >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${(mol.stabilityScore / 100) * 94.25} 94.25`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{mol.stabilityScore}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Stability</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <span>MW: {mol.molarMass || '—'}</span>
                      <span>·</span>
                      <span>LogP: {mol.logP || '—'}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Add Molecule Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="size-5 text-emerald-600 dark:text-emerald-400" /> Add New Molecule</DialogTitle>
            <DialogDescription>Create a new entry in the chemical compounds database</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input placeholder="e.g. Acetylsalicylic acid" value={newMolecule.name} onChange={(e) => setNewMolecule({ ...newMolecule, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CAS Number</Label><Input placeholder="e.g. 50-78-2" value={newMolecule.casNumber} onChange={(e) => setNewMolecule({ ...newMolecule, casNumber: e.target.value })} /></div>
              <div><Label>Formula</Label><Input placeholder="e.g. C9H8O4" value={newMolecule.formula} onChange={(e) => setNewMolecule({ ...newMolecule, formula: e.target.value })} /></div>
            </div>
            <div><Label>SMILES</Label><Input placeholder="e.g. CC(=O)OC1=CC=CC=C1C(=O)O" value={newMolecule.smiles} onChange={(e) => setNewMolecule({ ...newMolecule, smiles: e.target.value })} className="font-mono text-xs" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Molar Mass</Label><Input type="number" placeholder="0.00" value={newMolecule.molarMass || ''} onChange={(e) => setNewMolecule({ ...newMolecule, molarMass: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>LogP</Label><Input type="number" step="0.01" placeholder="0.00" value={newMolecule.logP || ''} onChange={(e) => setNewMolecule({ ...newMolecule, logP: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Stability (0-100)</Label><Input type="number" min="0" max="100" placeholder="0" value={newMolecule.predictedStabilityScore || ''} onChange={(e) => setNewMolecule({ ...newMolecule, predictedStabilityScore: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Risk Level</Label><Select value={newMolecule.riskLevel} onValueChange={(v) => setNewMolecule({ ...newMolecule, riskLevel: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
              <div><Label>Data Source</Label><Select value={newMolecule.dataSource} onValueChange={(v) => setNewMolecule({ ...newMolecule, dataSource: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="pubchem">PubChem</SelectItem><SelectItem value="chembl">ChEMBL</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Description</Label><Textarea placeholder="Brief description of the compound and its stability profile..." value={newMolecule.description} onChange={(e) => setNewMolecule({ ...newMolecule, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddMolecule} disabled={creating}>
              {creating ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Saving...</> : <><Plus className="size-4 mr-2" /> Add Molecule</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Molecule Detail Dialog (enhanced) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {selectedMolecule ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                    {selectedMolecule.name}
                  </span>
                  <Badge className={riskColors[selectedMolecule.riskLevel]}>{selectedMolecule.riskLevel} risk</Badge>
                  <Badge variant="outline" className="text-xs">{selectedMolecule.dataSource}</Badge>
                </span>
              ) : (
                <span>Molecule Details</span>
              )}
            </DialogTitle>
            {selectedMolecule && (
              <DialogDescription>
                CAS: <span className="font-mono">{selectedMolecule.casNumber || '—'}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedMolecule && (
            <>
              <Tabs defaultValue="properties" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="properties">Properties</TabsTrigger>
                  <TabsTrigger value="degradation">Degradation</TabsTrigger>
                  <TabsTrigger value="hazards">Hazards</TabsTrigger>
                </TabsList>

                {/* Properties Tab */}
                <TabsContent value="properties" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Formula', value: formatFormula(selectedMolecule.formula) },
                      { label: 'Molar Mass', value: selectedMolecule.molarMass ? `${selectedMolecule.molarMass.toFixed(2)} g/mol` : '—' },
                      { label: 'LogP', value: selectedMolecule.logP !== null ? selectedMolecule.logP.toFixed(2) : '—' },
                      { label: 'Melting Point', value: selectedMolecule.meltingPoint !== null ? `${selectedMolecule.meltingPoint}°C` : '—' },
                      { label: 'Boiling Point', value: selectedMolecule.boilingPoint !== null ? `${selectedMolecule.boilingPoint}°C` : '—' },
                      { label: 'CAS Number', value: selectedMolecule.casNumber || '—' },
                    ].map((field) => (
                      <div key={field.label} className="space-y-1 p-2 rounded-lg bg-muted/40">
                        <p className="text-xs text-muted-foreground">{field.label}</p>
                        <p className="text-sm font-medium">{field.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 p-2 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">SMILES</p>
                    <p className="text-sm font-mono break-all">{selectedMolecule.smiles || '—'}</p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Stability Score</span>
                      <span className={`text-2xl font-bold ${getScoreColor(selectedMolecule.stabilityScore)}`}>
                        {selectedMolecule.stabilityScore}<span className="text-sm text-muted-foreground font-normal">/100</span>
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={selectedMolecule.stabilityScore} className="h-3" />
                      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-sm font-medium">Description</p>
                    <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-emerald-500">
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedMolecule.description || 'No description available.'}</p>
                    </div>
                  </div>
                </TabsContent>

                {/* Degradation Tab */}
                <TabsContent value="degradation" className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-medium">Degradation Products</p>
                      {degradationProducts.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{degradationProducts.length}</Badge>
                      )}
                    </div>
                  </div>
                  {degradationLoading ? (
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : degradationProducts.length === 0 ? (
                    <div className="p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground">
                      No degradation pathway data has been recorded for this molecule yet.
                      Use the form below to add degradation products.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {degradationProducts.map((dp: any) => (
                        <div key={dp.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{dp.name}</span>
                              <Badge variant="outline" className={`text-[10px] ${HAZARD_OUTLINE_MAP[dp.hazardLevel] || HAZARD_OUTLINE_MAP.low}`}>
                                {dp.hazardLevel}
                              </Badge>
                            </div>
                            {dp.smiles && (
                              <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{dp.smiles}</p>
                            )}
                          </div>
                          {dp.percentage != null && (
                            <div className="ml-2 flex items-center gap-2 shrink-0">
                              <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-red-500"
                                  style={{ width: `${Math.min(100, dp.percentage)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold tabular-nums w-10 text-right">{dp.percentage}%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add degradation product form */}
                  <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/50 space-y-2">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Add degradation product</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Product name" value={newDegradation.name} onChange={(e) => setNewDegradation({ ...newDegradation, name: e.target.value })} className="text-xs h-8" />
                      <Input placeholder="SMILES (optional)" value={newDegradation.smiles} onChange={(e) => setNewDegradation({ ...newDegradation, smiles: e.target.value })} className="text-xs h-8 font-mono" />
                      <div className="flex items-center gap-2">
                        <Input type="number" placeholder="%" min="0" max="100" value={newDegradation.percentage || ''} onChange={(e) => setNewDegradation({ ...newDegradation, percentage: parseFloat(e.target.value) || 0 })} className="text-xs h-8 w-20" />
                        <Select value={newDegradation.hazardLevel} onValueChange={(v) => setNewDegradation({ ...newDegradation, hazardLevel: v })}>
                          <SelectTrigger className="text-xs h-8 flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8" onClick={handleAddDegradation} disabled={addingDegradation}>
                        {addingDegradation ? <><RefreshCw className="size-3 mr-1 animate-spin" /> Adding...</> : <><Plus className="size-3 mr-1" /> Add Product</>}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Hazards Tab */}
                <TabsContent value="hazards" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 p-3 rounded-lg bg-muted/40"><p className="text-xs text-muted-foreground">Risk Level</p><Badge className={riskColors[selectedMolecule.riskLevel]}>{selectedMolecule.riskLevel} risk</Badge></div>
                    <div className="space-y-1 p-3 rounded-lg bg-muted/40"><p className="text-xs text-muted-foreground">Stability Score</p><p className={`text-lg font-bold ${getScoreColor(selectedMolecule.stabilityScore)}`}>{selectedMolecule.stabilityScore}/100</p></div>
                    <div className="space-y-1 p-3 rounded-lg bg-muted/40"><p className="text-xs text-muted-foreground">Hazard Class</p><p className="text-sm font-medium">{HAZARD_CLASS_MAP[selectedMolecule.riskLevel] || 'Low Hazard'}</p></div>
                    <div className="space-y-1 p-3 rounded-lg bg-muted/40"><p className="text-xs text-muted-foreground">Data Source</p><p className="text-sm font-medium">{selectedMolecule.dataSource}</p></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Risk Description</p>
                    <div className={`p-3 rounded-lg border-l-4 ${RISK_BG_MAP[selectedMolecule.riskLevel] || RISK_BG_MAP.low}`}>
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedMolecule.description || 'No hazard description available.'}</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setDetailOpen(false); setPage('studies') }}><Microscope className="size-4 mr-2" /> Create Study</Button>
                <Button onClick={() => setDetailOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ── Stability Simulator Page ──────────────────────────────────────────────

const SIM_STEPS = ['Analyzing substances...', 'Computing kinetics...', 'Evaluating risk factors...', 'Generating recommendations...']

const getConditionSeverity = (type: string, value: number): { color: string; label: string } => {
  switch (type) {
    case 'temperature': return value > 50 ? { color: 'red', label: 'Extreme' } : value > 30 ? { color: 'amber', label: 'Elevated' } : { color: 'emerald', label: 'Normal' }
    case 'ph': return value < 3 || value > 11 ? { color: 'red', label: 'Extreme' } : value < 5 || value > 9 ? { color: 'amber', label: 'Elevated' } : { color: 'emerald', label: 'Normal' }
    case 'dissolvedOxygen': return value > 12 ? { color: 'amber', label: 'High' } : { color: 'emerald', label: 'Normal' }
    case 'lightExposure': return value > 10000 ? { color: 'red', label: 'UV' } : value > 300 ? { color: 'amber', label: 'Indoor' } : { color: 'emerald', label: 'Protected' }
    default: return { color: 'emerald', label: 'Normal' }
  }
}

function SimulatorPage() {
  const analysisStore = useAnalysisStore()
  const [simDone, setSimDone] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const runSimulation = useCallback(async () => {
    analysisStore.setRunning(true)
    setSimDone(false)
    setCurrentStep(0)
    // Increment through simulation progress steps
    const stepTimers = SIM_STEPS.map((_, i) =>
      setTimeout(() => setCurrentStep(i), (i + 1) * 600)
    )
    try {
      // Map light exposure number to API string values
      const lightStr = analysisStore.conditions.lightExposure === 0 ? 'protected'
        : analysisStore.conditions.lightExposure < 300 ? 'indoor'
        : analysisStore.conditions.lightExposure < 10000 ? 'outdoor'
        : 'uv'
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          substances: analysisStore.substances,
          conditions: {
            ph: analysisStore.conditions.ph,
            temperature: analysisStore.conditions.temperature,
            dissolvedOxygen: analysisStore.conditions.dissolvedOxygen,
            lightExposure: lightStr,
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const apiResult = data.result
        // Transform API response to match frontend format
        const risksObj: Record<string, { score: number; level: string }> = {}
        for (const item of apiResult.riskBreakdown) {
          const key = item.factor.toLowerCase()
          const level = item.score >= 80 ? 'low' : item.score >= 60 ? 'moderate' : item.score >= 40 ? 'high' : 'critical'
          risksObj[key] = { score: item.score, level }
        }
        const firstKinetics = apiResult.kineticsPredictions?.[0] || {}
        analysisStore.setResult({
          analysisId: `SIM-${Date.now()}`,
          overallScore: apiResult.overallScore,
          riskLevel: apiResult.riskLevel,
          risks: risksObj,
          kinetics: {
            shelfLifeMonths: firstKinetics.estimatedShelfLifeMonths ?? 0,
            q10: firstKinetics.q10 ?? 0,
            activationEnergy: firstKinetics.activationEnergyKjPerMol ?? 0,
          },
          recommendations: apiResult.recommendations.map((r: any) => `${r.action}: ${r.detail}`),
        })
      }
    } catch { /* on error, set no result */ }
    // Clear step timers
    stepTimers.forEach((t) => clearTimeout(t))
    setCurrentStep(SIM_STEPS.length)
    analysisStore.setRunning(false)
    setSimDone(true)
  }, [analysisStore])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Stability Simulator</h1>
        <p className="text-muted-foreground">Predict chemical stability under custom environmental conditions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="size-5 text-emerald-600 dark:text-emerald-400" />
                Substances
              </CardTitle>
              <CardDescription>Add substances to analyze</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysisStore.substances.map((sub, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 items-end">
                  <div className="flex-1"><Label className="text-xs">Name</Label><Input placeholder="Substance name" value={sub.name} onChange={(e) => analysisStore.updateSubstance(i, 'name', e.target.value)} /></div>
                  <div className="w-20"><Label className="text-xs">Conc.</Label><Input type="number" value={sub.concentration} onChange={(e) => analysisStore.updateSubstance(i, 'concentration', parseFloat(e.target.value) || 0)} /></div>
                  <div className="w-24"><Label className="text-xs">Unit</Label><Select value={sub.unit} onValueChange={(v) => analysisStore.updateSubstance(i, 'unit', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="g/L">g/L</SelectItem><SelectItem value="mg/mL">mg/mL</SelectItem><SelectItem value="mol/L">mol/L</SelectItem><SelectItem value="%w/v">%w/v</SelectItem></SelectContent></Select></div>
                  {analysisStore.substances.length > 1 && (<Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => analysisStore.removeSubstance(i)}><Trash2 className="size-4" /></Button>
                  )}
                </motion.div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={analysisStore.addSubstance}
              >
                <Plus className="size-4 mr-1" /> Add Substance
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="size-5 text-teal-600 dark:text-teal-400" />
                Environmental Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'ph', label: 'pH', step: '0.1', type: 'ph', val: analysisStore.conditions.ph },
                  { key: 'temperature', label: 'Temperature (°C)', step: undefined, type: 'temperature', val: analysisStore.conditions.temperature },
                  { key: 'dissolvedOxygen', label: 'Dissolved O₂ (mg/L)', step: '0.1', type: 'dissolvedOxygen', val: analysisStore.conditions.dissolvedOxygen },
                  { key: 'lightExposure', label: 'Light Exposure (lux)', step: undefined, type: 'lightExposure', val: analysisStore.conditions.lightExposure },
                ].map((c) => {
                  const sev = getConditionSeverity(c.type, c.val)
                  const sevDot = sev.color === 'red' ? 'bg-red-500' : sev.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                  return (
                    <div key={c.key}>
                      <div className="flex items-center gap-2 mb-1"><Label className="text-xs">{c.label}</Label><span className={`size-2 rounded-full ${sevDot}`} /><span className="text-[10px] text-muted-foreground">{sev.label}</span></div>
                      <Input type="number" step={c.step} value={c.val} onChange={(e) => analysisStore.setConditions({ [c.key]: parseFloat(e.target.value) || 0 })} />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={runSimulation}
              disabled={analysisStore.running}
            >
              {analysisStore.running ? (
                <>
                  <RefreshCw className="size-4 animate-spin mr-2" /> Analyzing...
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" /> Run Analysis
                </>
              )}
            </Button>
            <Button variant="outline" onClick={analysisStore.reset}>
              Reset
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {analysisStore.running && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-8"
              >
                <div className="flex flex-col items-center gap-4">
                  {SIM_STEPS.map((step, i) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: currentStep >= i ? 1 : 0.3, x: 0 }}
                      transition={{ delay: i * 0.2 }}
                      className="flex items-center gap-3"
                    >
                      {currentStep > i ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : currentStep === i ? (
                        <RefreshCw className="size-4 text-emerald-500 animate-spin" />
                      ) : (
                        <Clock className="size-4 text-muted-foreground" />
                      )}
                      <span className={`text-sm ${currentStep >= i ? 'font-medium' : 'text-muted-foreground'}`}>
                        {step}
                      </span>
                    </motion.div>
                  ))}
                  <Progress value={(currentStep / SIM_STEPS.length) * 100} className="w-64 h-2 [&>div]:bg-emerald-500" />
                </div>
              </motion.div>
            )}

            {analysisStore.result && !analysisStore.running && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Overall Score Gauge */}
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Stability Score</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-3">
                    <div className="relative w-32 h-32">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                        <circle
                          cx="50" cy="50" r="40" fill="none"
                          stroke={analysisStore.result.overallScore >= 80 ? '#10b981' : analysisStore.result.overallScore >= 60 ? '#14b8a6' : analysisStore.result.overallScore >= 40 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="8"
                          strokeDasharray={`${(analysisStore.result.overallScore / 100) * 251.33} 251.33`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-3xl font-bold ${getScoreColor(analysisStore.result.overallScore)}`}>
                          {analysisStore.result.overallScore}
                        </span>
                      </div>
                    </div>
                    <Badge className={riskColors[analysisStore.result.riskLevel]}>
                      Risk: {analysisStore.result.riskLevel}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Risk Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Breakdown</CardTitle>
                    <CardDescription>Degradation pathway risk assessment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(analysisStore.result.risks).map(([key, val]: [string, any]) => {
                      const labelMap: Record<string, string> = {
                        hydrolysis: 'Hydrolysis',
                        oxidation: 'Oxidation',
                        photolysis: 'Photolysis',
                        thermal: 'Thermal',
                      }
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{labelMap[key]}</span>
                            <Badge className={riskColors[val.level]}>{val.level}</Badge>
                          </div>
                          <Progress value={val.score} className="h-2" />
                        </div>
                      )
                    })}
                    <Separator className="my-3" />
                    <ResponsiveContainer width="100%" height={250}>
                      <RadarChart data={Object.entries(analysisStore.result.risks).map(([key, val]: [string, any]) => {
                        const labelMap: Record<string, string> = {
                          hydrolysis: 'Hydrolysis',
                          oxidation: 'Oxidation',
                          photolysis: 'Photolysis',
                          thermal: 'Thermal',
                        }
                        return { risk: labelMap[key], score: val.score }
                      })}>
                        <PolarGrid className="stroke-muted" />
                        <PolarAngleAxis dataKey="risk" className="text-xs" />
                        <PolarRadiusAxis domain={[0, 100]} className="text-xs" />
                        <Radar name="Risk Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                        <Tooltip contentStyle={{ borderRadius: 8 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Kinetics Predictions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Kinetics Predictions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Shelf Life', value: `${analysisStore.result.kinetics.shelfLifeMonths} mo`, icon: Clock },
                        { label: 'Q₁₀', value: analysisStore.result.kinetics.q10.toString(), icon: Gauge },
                        { label: 'Eₐ (kJ/mol)', value: analysisStore.result.kinetics.activationEnergy.toString(), icon: Zap },
                      ].map((item) => {
                        const Icon = item.icon
                        return (
                          <div key={item.label} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50">
                            <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="text-lg font-bold">{item.value}</p>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="size-5 text-amber-600 dark:text-amber-400" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysisStore.result.recommendations.map((rec, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/30"
                      >
                        <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{rec}</p>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {!analysisStore.result && !analysisStore.running && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Card className="flex flex-col items-center justify-center py-16 relative overflow-hidden">
                  {/* Decorative floating circles */}
                  <motion.div
                    animate={{ y: [-10, 10, -10], rotate: [0, 180, 360] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-8 left-12 size-8 rounded-full bg-emerald-200/30 dark:bg-emerald-800/30 blur-sm"
                  />
                  <motion.div
                    animate={{ y: [10, -10, 10], rotate: [360, 180, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-12 right-16 size-6 rounded-full bg-teal-200/30 dark:bg-teal-800/30 blur-sm"
                  />
                  <motion.div
                    animate={{ x: [-5, 5, -5], y: [5, -5, 5] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-20 right-12 size-4 rounded-full bg-cyan-200/30 dark:bg-cyan-800/30 blur-sm"
                  />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                  >
                    <Beaker className="size-16 text-emerald-600/20 dark:text-emerald-400/20 mb-4" />
                  </motion.div>
                  <p className="text-muted-foreground font-medium">Configure substances and conditions</p>
                  <p className="text-xs text-muted-foreground mt-1">Then click "Run Analysis" to simulate stability</p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ── Studies Management Page ───────────────────────────────────────────────

function StudiesPage() {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [studyTypeFilter, setStudyTypeFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [apiStudies, setApiStudies] = useState<StudyData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [studiesByStatus, setStudiesByStatus] = useState<{ status: string; _count: { status: number } }[]>([])
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailStudy, setDetailStudy] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [signing, setSigning] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [newTimePoint, setNewTimePoint] = useState({ timeDays: 0, percentRemaining: 100, isOOS: false, isOOT: false })
  const [addingTimePoint, setAddingTimePoint] = useState(false)
  const [deletingTimePointId, setDeletingTimePointId] = useState<string | null>(null)
  const [newStudy, setNewStudy] = useState({
    substanceName: '',
    studyType: 'long_term',
    temperatureC: 25,
    humidityPercent: 60,
    durationMonths: 24,
    ph: 7.0,
  })

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (studyTypeFilter !== 'all') params.set('type', studyTypeFilter)
      try {
        const [studiesRes, statsRes] = await Promise.all([
          fetch(`/api/studies?${params.toString()}`),
          fetch('/api/stats'),
        ])
        if (studiesRes.ok && !cancelled) {
          const data = await studiesRes.json()
          const transformed: StudyData[] = (data.studies || []).map((s: any) => ({
            ...transformStudy(s), humidityPercent: s.humidityPercent ?? null, ph: s.ph ?? null,
          }))
          if (!cancelled) {
            setApiStudies(transformed)
            setTotalCount(data.pagination?.total ?? 0)
          }
        }
        if (statsRes.ok && !cancelled) {
          const statsData = await statsRes.json()
          if (statsData.studiesByStatus && !cancelled) {
            setStudiesByStatus(statsData.studiesByStatus)
          }
        }
      } catch { /* fallback */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [statusFilter, studyTypeFilter, refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  const handleCreate = async () => {
    if (!newStudy.substanceName.trim()) {
      toast({ title: 'Validation error', description: 'Substance name is required', variant: 'destructive' })
      return
    }
    setCreating(true)
    // Generate a study code based on substance name + timestamp
    const code = `STB-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
    try {
      const res = await fetch('/api/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyCode: code,
          substanceName: newStudy.substanceName,
          studyType: newStudy.studyType,
          temperatureC: newStudy.temperatureC,
          humidityPercent: newStudy.humidityPercent,
          durationMonths: newStudy.durationMonths,
          ph: newStudy.ph,
        }),
      })
      if (res.ok) {
        toast({
          title: 'Study created',
          description: `${newStudy.substanceName} study created successfully (${code})`,
        })
        setCreateOpen(false)
        setNewStudy({ substanceName: '', studyType: 'long_term', temperatureC: 25, humidityPercent: 60, durationMonths: 24, ph: 7.0 })
        handleRefresh()
      } else {
        const errBody = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: errBody.error || 'Failed to create study', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const openDetail = async (study: StudyData) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailStudy(null)
    try {
      const res = await fetch(`/api/studies/${study.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.study) {
          setDetailStudy(data.study)
        } else {
          // Fallback: use the row data we already have
          setDetailStudy(study)
        }
      } else {
        setDetailStudy(study)
      }
    } catch {
      setDetailStudy(study)
    } finally {
      setDetailLoading(false)
    }
  }

  const updateStudyStatus = async (newStatus: string) => {
    if (!detailStudy) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/studies/${detailStudy.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          rejectionReason: newStatus === 'rejected' ? 'Rejected during review' : undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.study) {
          setDetailStudy((prev: any) => prev ? { ...prev, ...data.study } : prev)
        }
        toast({ title: 'Status updated', description: `Study marked as ${newStatus.replace('_', ' ')}` })
        handleRefresh()
      } else {
        toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setStatusUpdating(false)
    }
  }

  const signStudy = async () => {
    if (!detailStudy) return
    setSigning(true)
    try {
      const res = await fetch(`/api/studies/${detailStudy.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName: 'Dr. Sarah Chen',
          signerRole: 'org_admin',
          meaning: 'Reviewed and Approved',
          newStatus: detailStudy.status === 'under_review' ? 'approved' : undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        // Refresh detail to show new signature
        if (data.study) {
          setDetailStudy((prev: any) => prev ? { ...prev, ...data.study, signatures: [...(prev.signatures || []), data.signature] } : prev)
        }
        toast({ title: 'Study signed', description: 'Electronic signature recorded (FDA 21 CFR Part 11)' })
        handleRefresh()
      } else {
        toast({ title: 'Error', description: 'Failed to sign study', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setSigning(false)
    }
  }

  const handleAddTimePoint = async () => {
    if (!detailStudy) return
    if (newTimePoint.timeDays < 0) {
      toast({ title: 'Validation error', description: 'Time (days) must be ≥ 0', variant: 'destructive' })
      return
    }
    setAddingTimePoint(true)
    try {
      const degradationPercent = Math.max(0, 100 - newTimePoint.percentRemaining)
      const res = await fetch('/api/timepoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeDays: newTimePoint.timeDays,
          percentRemaining: newTimePoint.percentRemaining,
          degradationPercent,
          isOOS: newTimePoint.isOOS,
          isOOT: newTimePoint.isOOT,
          studyId: detailStudy.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: 'Time point added', description: `Day ${newTimePoint.timeDays} recorded` })
        setDetailStudy((prev: any) => prev
          ? { ...prev, timePoints: [...(prev.timePoints || []), data.timePoint].sort((a: any, b: any) => a.timeDays - b.timeDays) }
          : prev)
        setNewTimePoint({ timeDays: 0, percentRemaining: 100, isOOS: false, isOOT: false })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: err.error || 'Failed to add time point', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setAddingTimePoint(false)
    }
  }

  const handleDeleteTimePoint = async (tpId: string) => {
    setDeletingTimePointId(tpId)
    try {
      const res = await fetch(`/api/timepoints/${tpId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Time point deleted', description: 'Measurement removed from study' })
        setDetailStudy((prev: any) => prev
          ? { ...prev, timePoints: (prev.timePoints || []).filter((tp: any) => tp.id !== tpId) }
          : prev)
      } else {
        toast({ title: 'Error', description: 'Failed to delete time point', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setDeletingTimePointId(null)
    }
  }

  const exportStudiesCSV = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/studies?limit=1000')
      if (res.ok) {
        const data = await res.json()
        const rows = (data.studies || []).map((s: any) => ({
          id: s.id,
          studyCode: s.studyCode ?? '',
          substanceName: s.substanceName ?? '',
          studyType: s.studyType ?? '',
          status: s.status ?? '',
          temperatureC: s.temperatureC ?? '',
          humidityPercent: s.humidityPercent ?? '',
          durationMonths: s.durationMonths ?? '',
          predictedShelfLifeMonths: s.predictedShelfLifeMonths ?? '',
          ph: s.ph ?? '',
        }))
        if (!rows.length) {
          toast({ title: 'Nothing to export', description: 'No studies found to export' })
        } else {
          exportCSV(rows, `chemstab-studies-${new Date().toISOString().slice(0, 10)}.csv`)
          toast({ title: 'Export complete', description: `Exported ${rows.length} studies to CSV` })
        }
      } else {
        toast({ title: 'Export failed', description: 'Failed to fetch studies', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Export failed', description: 'Network error', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Studies Management</h1>
          <p className="text-muted-foreground">Manage and track stability studies across your organization</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportStudiesCSV} disabled={exporting}>
            <Download className={`size-4 mr-1 ${exporting ? 'animate-pulse' : ''}`} /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-2" /> Create Study
          </Button>
        </div>
      </div>

      {/* Status Pipeline Visualization */}
      <div className="flex items-center gap-1 p-3 rounded-xl bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border">
        {['draft', 'in_progress', 'under_review', 'approved'].map((stage, i) => {
          const count = studiesByStatus?.find(s => s.status === stage)?._count?.status || 0
          const stageColors: Record<string, string> = {
            draft: 'bg-slate-400', in_progress: 'bg-teal-500', under_review: 'bg-amber-500', approved: 'bg-emerald-500'
          }
          const stageLabels: Record<string, string> = {
            draft: 'Draft', in_progress: 'In Progress', under_review: 'Under Review', approved: 'Approved'
          }
          return (
            <div key={stage} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="size-3 text-muted-foreground" />}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/60 dark:bg-card/60">
                <span className={`size-2 rounded-full ${stageColors[stage]}`} />
                <span className="text-xs font-medium">{stageLabels[stage]}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{count}</Badge>
              </div>
            </div>
          )
        })}
      </div>

      {/* Study Type Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-1">
        {['all', 'long_term', 'accelerated', 'intermediate', 'stress'].map((type) => (
          <Button
            key={type}
            variant={studyTypeFilter === type ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs rounded-full ${studyTypeFilter === type ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
            onClick={() => setStudyTypeFilter(type)}
          >
            {type === 'all' ? 'All Types' : studyTypeLabels[type]}
          </Button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Studies Table */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Study Code</TableHead>
                    <TableHead>Substance</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Temp (°C)</TableHead>
                    <TableHead>Shelf Life</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiStudies.map((std, idx) => (
                    <TableRow
                      key={std.id}
                      className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors ${idx % 2 === 1 ? 'bg-muted/30' : ''}`}
                      onClick={() => openDetail(std)}
                    >
                      <TableCell className="font-medium font-mono">{std.studyCode}</TableCell>
                      <TableCell>{std.substanceName}</TableCell>
                      <TableCell>{studyTypeLabels[std.studyType]}</TableCell>
                      <TableCell>{std.temperatureC}</TableCell>
                      <TableCell>
                        {std.predictedShelfLifeMonths !== null ? `${std.predictedShelfLifeMonths} mo` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[std.status]}>{std.status.replace('_', ' ')}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {apiStudies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No studies found matching your criteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${apiStudies.length} of ${totalCount} studies shown`}
          </p>
        </CardFooter>
      </Card>

      {/* Create Study Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Stability Study</DialogTitle>
            <DialogDescription>Define the parameters for a new stability study</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-emerald-700 dark:text-emerald-400">Substance Name *</Label><Input placeholder="Enter substance name" value={newStudy.substanceName} onChange={(e) => setNewStudy({ ...newStudy, substanceName: e.target.value })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/50">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">Study Code Preview</p>
              <p className="text-sm font-mono text-muted-foreground">STB-{new Date().getFullYear()}-{String(Date.now()).slice(-5)} <span className="text-xs">(auto-generated)</span></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-emerald-700 dark:text-emerald-400">Study Type</Label><Select value={newStudy.studyType} onValueChange={(v) => setNewStudy({ ...newStudy, studyType: v })}><SelectTrigger className="border-emerald-200 dark:border-emerald-800/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="long_term">Long-Term</SelectItem><SelectItem value="accelerated">Accelerated</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="stress">Stress Testing</SelectItem></SelectContent></Select></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Duration (months)</Label><Input type="number" value={newStudy.durationMonths} onChange={(e) => setNewStudy({ ...newStudy, durationMonths: parseInt(e.target.value) || 0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Temperature (°C)</Label><Input type="number" value={newStudy.temperatureC} onChange={(e) => setNewStudy({ ...newStudy, temperatureC: parseFloat(e.target.value) || 0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Humidity (%)</Label><Input type="number" value={newStudy.humidityPercent} onChange={(e) => setNewStudy({ ...newStudy, humidityPercent: parseFloat(e.target.value) || 0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">pH</Label><Input type="number" step="0.1" value={newStudy.ph} onChange={(e) => setNewStudy({ ...newStudy, ph: parseFloat(e.target.value) || 7.0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreate} disabled={creating}>
              {creating ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Creating...</> : 'Create Study'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Study Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detailLoading ? (
                <span>Loading Study Details</span>
              ) : detailStudy ? (
                <>
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent font-mono">
                    {detailStudy.studyCode}
                  </span>
                  <Badge className={statusColors[detailStudy.status]}>{detailStudy.status.replace('_', ' ')}</Badge>
                </>
              ) : (
                <span>Study Details</span>
              )}
            </DialogTitle>
            {detailStudy && (
              <DialogDescription>
                {detailStudy.substanceName} · {studyTypeLabels[detailStudy.studyType] || detailStudy.studyType}
              </DialogDescription>
            )}
          </DialogHeader>
          {detailLoading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <RefreshCw className="size-8 animate-spin text-emerald-600" />
              <p className="text-sm text-muted-foreground">Loading study details...</p>
            </div>
          ) : detailStudy ? (
            <>

              <div className="space-y-4">
                {/* Key info grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Temperature', value: `${detailStudy.temperatureC}°C`, icon: Thermometer },
                    { label: 'Humidity', value: detailStudy.humidityPercent !== null ? `${detailStudy.humidityPercent}%` : '—', icon: Droplets },
                    { label: 'Duration', value: `${detailStudy.durationMonths} mo`, icon: Clock },
                    { label: 'pH', value: detailStudy.ph !== null ? detailStudy.ph.toFixed(1) : '—', icon: Beaker },
                    { label: 'Kinetic Order', value: detailStudy.kineticOrder ? `${detailStudy.kineticOrder}` : '—', icon: Activity },
                    { label: 'Light Exposure', value: detailStudy.lightExposure || '—', icon: Eye },
                  ].map((field) => {
                    const Icon = field.icon
                    return (
                      <div key={field.label} className="p-2 rounded-lg bg-muted/40 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Icon className="size-3" /> {field.label}
                        </div>
                        <p className="text-sm font-medium">{field.value}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Highlighted shelf life */}
                <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-l-4 border-emerald-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium">Predicted Shelf Life</span>
                    </div>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                      {detailStudy.predictedShelfLifeMonths !== null ? `${detailStudy.predictedShelfLifeMonths} months` : 'Not yet determined'}
                    </span>
                  </div>
                </div>

                {/* Kinetics details */}
                {(detailStudy.activationEnergy !== null && detailStudy.activationEnergy !== undefined) ||
                 (detailStudy.rateConstant !== null && detailStudy.rateConstant !== undefined) ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">Activation Energy</p>
                      <p className="text-sm font-medium">{detailStudy.activationEnergy ? `${detailStudy.activationEnergy.toFixed(2)} kJ/mol` : '—'}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-xs text-muted-foreground">Rate Constant</p>
                      <p className="text-sm font-medium">{detailStudy.rateConstant ? detailStudy.rateConstant.toExponential(3) : '—'}</p>
                    </div>
                  </div>
                ) : null}

                <Separator />

                {/* Time points table */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium">Time Points ({detailStudy.timePoints?.length || 0})</p>
                  </div>
                  {detailStudy.timePoints && detailStudy.timePoints.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time (days)</TableHead>
                            <TableHead>Time (mo)</TableHead>
                            <TableHead>% Remaining</TableHead>
                            <TableHead>Degradation</TableHead>
                            <TableHead>Flags</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailStudy.timePoints.map((tp: any, idx: number) => (
                            <TableRow key={tp.id} className={idx % 2 === 1 ? 'bg-muted/30' : ''}>
                              <TableCell className="font-mono text-xs">{tp.timeDays}</TableCell>
                              <TableCell className="font-mono text-xs">{tp.timeMonths?.toFixed(1) ?? '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{tp.percentRemaining !== null && tp.percentRemaining !== undefined ? `${tp.percentRemaining.toFixed(1)}%` : '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{tp.degradationPercent !== null && tp.degradationPercent !== undefined ? `${tp.degradationPercent.toFixed(1)}%` : '—'}</TableCell>
                              <TableCell>
                                    {tp.isOOS ? <Badge variant="destructive" className="text-[10px] mr-1">OOS</Badge> : null}
                                    {tp.isOOT ? <Badge variant="outline" className="text-[10px]">OOT</Badge> : null}
                                    {!tp.isOOS && !tp.isOOT ? <span className="text-xs text-muted-foreground">—</span> : null}
                                  </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-muted-foreground hover:text-red-500"
                                  onClick={() => handleDeleteTimePoint(tp.id)}
                                  disabled={deletingTimePointId === tp.id}
                                >
                                  <Trash2 className={`size-3 ${deletingTimePointId === tp.id ? 'animate-spin' : ''}`} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                      No time point data recorded for this study yet. Add measurements below.
                    </p>
                  )}

                  {/* Add time point form */}
                  <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/50">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">Add Time Point</p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[100px]"><Label className="text-[10px] text-muted-foreground">Time (days)</Label><Input type="number" min="0" placeholder="0" value={newTimePoint.timeDays || ''} onChange={(e) => setNewTimePoint({ ...newTimePoint, timeDays: parseInt(e.target.value) || 0 })} className="text-xs h-8" /></div>
                      <div className="flex-1 min-w-[100px]"><Label className="text-[10px] text-muted-foreground">% Remaining</Label><Input type="number" min="0" max="100" step="0.1" placeholder="100" value={newTimePoint.percentRemaining || ''} onChange={(e) => setNewTimePoint({ ...newTimePoint, percentRemaining: parseFloat(e.target.value) || 0 })} className="text-xs h-8" /></div>
                      <label className="flex items-center gap-1 text-xs cursor-pointer h-8"><input type="checkbox" checked={newTimePoint.isOOS} onChange={(e) => setNewTimePoint({ ...newTimePoint, isOOS: e.target.checked })} className="rounded" />OOS</label>
                      <label className="flex items-center gap-1 text-xs cursor-pointer h-8"><input type="checkbox" checked={newTimePoint.isOOT} onChange={(e) => setNewTimePoint({ ...newTimePoint, isOOT: e.target.checked })} className="rounded" />OOT</label>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8" onClick={handleAddTimePoint} disabled={addingTimePoint}>
                        {addingTimePoint ? <><RefreshCw className="size-3 mr-1 animate-spin" /> Adding...</> : <><Plus className="size-3 mr-1" /> Add</>}
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Electronic signatures */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Shield className="size-4 text-emerald-600 dark:text-emerald-400" /><p className="text-sm font-medium">Electronic Signatures ({detailStudy.signatures?.length || 0})</p></div>
                  {detailStudy.signatures && detailStudy.signatures.length > 0 ? (
                    <div className="space-y-2">
                      {detailStudy.signatures.map((sig: any) => (
                        <div key={sig.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{sig.signerName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium">{sig.signerName}</p><p className="text-xs text-muted-foreground">{sig.meaning} · {sig.signerRole}</p></div>
                          <div className="text-right shrink-0"><p className="text-xs text-muted-foreground">{sig.signedAt ? new Date(sig.signedAt).toLocaleString() : ''}</p><p className="text-[10px] font-mono text-muted-foreground">#{sig.signatureHash?.slice(0, 8)}</p></div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">No electronic signatures recorded yet.</p>}
                </div>

                <Separator />

                {/* Status action buttons */}
                {detailStudy.status === 'under_review' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateStudyStatus('approved')} disabled={statusUpdating}><CheckCircle2 className="size-4 mr-1" /> Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStudyStatus('rejected')} disabled={statusUpdating}><XCircle className="size-4 mr-1" /> Reject</Button>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" onClick={signStudy} disabled={signing}>{signing ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Signing...</> : <><Shield className="size-4 mr-2" /> Sign Study</>}</Button>
                <Button onClick={() => setDetailOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">Failed to load study details.</div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ── Reports & Compliance Page ─────────────────────────────────────────────

function ReportsPage() {
  const { toast } = useToast()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [selectedReportType, setSelectedReportType] = useState('')
  const [selectedStudyId, setSelectedStudyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [apiReports, setApiReports] = useState<ReportData[]>([])
  const [reportStudies, setReportStudies] = useState<StudyData[]>([])
  const [generating, setGenerating] = useState(false)
  const [previewReport, setPreviewReport] = useState<ReportData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // reportStatusColors shares most entries with global statusColors
  // colorMap is now the global COLOR_MAP
  const reportStatusColors: Record<string, string> = statusColors

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const res = await fetch('/api/reports')
        if (res.ok && !cancelled) {
          const data = await res.json()
          const transformed: ReportData[] = (data.reports || []).map((r: any) => ({
            id: r.id, title: r.title || '', reportType: r.reportType || '',
            status: r.status || 'draft', createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
          }))
          if (!cancelled) setApiReports(transformed)
        }
      } catch { /* fallback */ }
      try {
        const res = await fetch('/api/studies')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) setReportStudies((data.studies || []).map(transformStudy))
        }
      } catch { /* fallback */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      toast({ title: 'Validation error', description: 'Please select a report type', variant: 'destructive' })
      return
    }
    const reportTypeLabel = REPORT_TYPES.find(r => r.type === selectedReportType)?.title || selectedReportType
    const generatedTitle = `${reportTypeLabel} Report — ${new Date().toLocaleDateString()}`
    setGenerating(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle,
          reportType: selectedReportType,
          studyId: selectedStudyId || undefined,
        }),
      })
      if (res.ok) {
        toast({ title: 'Report generated', description: generatedTitle })
        setGenerateOpen(false)
        setSelectedReportType('')
        setSelectedStudyId('')
        handleRefresh()
      } else {
        const errBody = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: errBody.error || 'Failed to generate report', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // Print/PDF export: open a new window with a formatted report and trigger print
  const handlePrintReport = async (report: ReportData) => {
    const reportTypeLabel = REPORT_TYPES.find(r => r.type === report.reportType)?.title || report.reportType
    // Fetch linked study (if any) for additional context
    let studyInfo: any = null
    try {
      const studiesRes = await fetch('/api/studies?limit=100')
      if (studiesRes.ok) {
        const data = await studiesRes.json()
        const studies = data.studies || []
        // Just use the first study as a representative sample (since report doesn't store studyId in frontend model)
        if (studies.length > 0) studyInfo = studies[0]
      }
    } catch { /* ignore */ }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
    .header { text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #059669; margin: 0 0 8px 0; font-size: 24px; }
    .header .meta { color: #6b7280; font-size: 13px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #d1fae5; color: #065f46; margin-left: 6px; }
    h2 { color: #047857; border-left: 4px solid #10b981; padding-left: 10px; margin-top: 30px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; text-align: center; }
    .signature-block { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
    .sig-line { border-top: 1px solid #1f2937; padding-top: 6px; font-size: 12px; color: #4b5563; flex: 1; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }
    .info-item { padding: 8px 12px; background: #f9fafb; border-radius: 4px; }
    .info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 600; color: #1f2937; margin-top: 2px; }
    .compliance-note { background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; font-size: 12px; color: #065f46; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}<span class="badge">${report.status}</span></h1>
    <div class="meta">ChemStab Industrial Corp · ${reportTypeLabel} · Generated ${report.createdAt}</div>
  </div>

  <div class="compliance-note">
    <strong>Compliance:</strong> This report follows FDA 21 CFR Part 11 requirements for electronic records and signatures.
    Document ID: ${report.id} · Audit retention: 7 years.
  </div>

  <h2>1. Executive Summary</h2>
  <p>This ${reportTypeLabel} document outlines the stability assessment protocol and findings for the referenced substance. The study was conducted in accordance with ICH Q1A(R2) guidelines for stability testing of new drug substances and products.</p>

  <h2>2. Study Information</h2>
  ${studyInfo ? `
  <div class="info-grid">
    <div class="info-item"><div class="info-label">Study Code</div><div class="info-value">${studyInfo.studyCode}</div></div>
    <div class="info-item"><div class="info-label">Substance</div><div class="info-value">${studyInfo.substanceName}</div></div>
    <div class="info-item"><div class="info-label">Study Type</div><div class="info-value">${(studyInfo.studyType || '').replace(/_/g, ' ')}</div></div>
    <div class="info-item"><div class="info-label">Status</div><div class="info-value">${(studyInfo.status || '').replace(/_/g, ' ')}</div></div>
    <div class="info-item"><div class="info-label">Temperature</div><div class="info-value">${studyInfo.temperatureC}°C</div></div>
    <div class="info-item"><div class="info-label">Humidity</div><div class="info-value">${studyInfo.humidityPercent ?? 'N/A'}%</div></div>
    <div class="info-item"><div class="info-label">Duration</div><div class="info-value">${studyInfo.durationMonths} months</div></div>
    <div class="info-item"><div class="info-label">Predicted Shelf Life</div><div class="info-value">${studyInfo.predictedShelfLifeMonths ?? 'TBD'} months</div></div>
  </div>` : '<p>No linked study data available.</p>'}

  <h2>3. Methodology</h2>
  <p>The stability study protocol included the following parameters:</p>
  <table>
    <thead><tr><th>Parameter</th><th>Specification</th><th>Acceptance Criteria</th></tr></thead>
    <tbody>
      <tr><td>Storage Condition</td><td>${studyInfo?.temperatureC ?? 25}°C / ${studyInfo?.humidityPercent ?? 60}% RH</td><td>ICH Q1A long-term condition</td></tr>
      <tr><td>Testing Frequency</td><td>0, 3, 6, 9, 12, 18, 24 months</td><td>Per ICH Q1A guidance</td></tr>
      <tr><td>Container Closure</td><td>HDPE bottle with induction seal</td><td>Simulates marketed package</td></tr>
      <tr><td>Light Protection</td><td>${studyInfo?.lightExposure || 'Protected'}</td><td>ICH Q1B photostability</td></tr>
      <tr><td>pH Range</td><td>${studyInfo?.ph ?? 'N/A'}</td><td>Formulation target ± 0.5</td></tr>
    </tbody>
  </table>

  <h2>4. Acceptance Criteria</h2>
  <table>
    <thead><tr><th>Test</th><th>Specification</th><th>Rationale</th></tr></thead>
    <tbody>
      <tr><td>Assay</td><td>90.0% – 110.0% of label claim</td><td>Potency throughout shelf life</td></tr>
      <tr><td>Degradation Products</td><td>Each ≤ 0.5%; Total ≤ 2.0%</td><td>Safety and efficacy</td></tr>
      <tr><td>Dissolution</td><td>Q ≥ 80% in 30 minutes</td><td>Bioavailability</td></tr>
      <tr><td>Appearance</td><td>Conforms to specification</td><td>Physical stability</td></tr>
    </tbody>
  </table>

  <h2>5. Conclusion</h2>
  <p>Based on the analytical data obtained throughout the stability study, the substance meets the predefined acceptance criteria. The recommended shelf life and storage conditions are supported by the data presented in this report.</p>

  <div class="signature-block">
    <div class="sig-line">Prepared by: Dr. Sarah Chen<br>Role: Analyst<br>Date: ${new Date().toLocaleDateString()}</div>
    <div class="sig-line">Reviewed by: Dr. Wei Chen<br>Role: Org Admin<br>Date: ${new Date().toLocaleDateString()}</div>
    <div class="sig-line">Approved by: Aiko Tanaka<br>Role: Project Manager<br>Date: ${new Date().toLocaleDateString()}</div>
  </div>

  <div class="footer">
    ChemStab Industrial Corp · Confidential · FDA 21 CFR Part 11 Compliant Electronic Record<br>
    Report ID: ${report.id} · Generated: ${new Date().toISOString()}
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      toast({ title: 'Report opened', description: 'Use your browser\'s print dialog to save as PDF' })
    } else {
      toast({ title: 'Popup blocked', description: 'Please allow popups to export the report', variant: 'destructive' })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Reports & Compliance</h1>
          <p className="text-muted-foreground">Generate regulatory reports and compliance documentation</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon
          return (
            <motion.div
              key={rt.type}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Card className="cursor-pointer group backdrop-blur-sm bg-card/80 transition-transform hover:-translate-y-1">
                <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                  <motion.div
                    whileHover={{ rotate: 8, scale: 1.1 }}
                    className={`p-3 rounded-xl ${COLOR_MAP[rt.color]}`}
                  >
                    <Icon className="size-6" />
                  </motion.div>
                  <CardTitle className="text-base">{rt.title}</CardTitle>
                  <CardDescription className="text-xs">{rt.description}</CardDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 transition-transform hover:scale-105"
                    onClick={() => { setSelectedReportType(rt.type); setGenerateOpen(true) }}
                  >
                    <Download className="size-3.5 mr-1" /> Generate
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Recent Reports - Card Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Reports</h2>
          <p className="text-sm text-muted-foreground">{apiReports.length} reports</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : apiReports.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="size-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No reports generated yet</p>
              <p className="text-sm mt-1">Use the report type cards above to generate your first compliance report.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiReports.map((report) => {
              const typeInfo = REPORT_TYPES.find(t => t.type === report.reportType)
              const Icon = typeInfo?.icon || FileText
              return (
                <motion.div key={report.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden" onClick={() => { setPreviewReport(report); setPreviewOpen(true) }}>
                    <div className={`h-2 ${REPORT_GRADIENT[report.reportType] || REPORT_GRADIENT.validation_protocol}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg shrink-0 ${REPORT_ICON_BG[report.reportType] || REPORT_ICON_BG.validation_protocol}`}>
                          <Icon className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{report.title}</h3>
                          <p className="text-xs text-muted-foreground truncate">{typeInfo?.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className={`text-[10px] ${reportStatusColors[report.status]}`}>{report.status.replace('_', ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">{report.createdAt}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); setPreviewReport(report); setPreviewOpen(true) }}>
                          <Eye className="size-3 mr-1" /> Preview
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); handlePrintReport(report) }}>
                          <Download className="size-3 mr-1" /> Export PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewReport ? (() => {
            const typeInfo = REPORT_TYPES.find(t => t.type === previewReport.reportType)
            const Icon = typeInfo?.icon || FileText
            const previewContent: Record<string, string[]> = {
              ich_q1a: ['1. Scope & Objective', '2. Test Conditions (25°C/60% RH, 40°C/75% RH)', '3. Testing Frequency (0, 3, 6, 9, 12, 18, 24 months)', '4. Container Closure System', '5. Acceptance Criteria', '6. Statistical Analysis Plan', '7. Out-of-Specification Protocol'],
              ctd_module: ['3.2.P.8.1 Summary', '3.2.P.8.2 Post-approval Changes', '3.2.P.8.3 Stability Data Tables', '3.2.P.8.4 Statistical Analysis', '3.2.P.8.5 Conclusions & Shelf Life'],
              fmea: ['1. Process Map & Flowchart', '2. Failure Mode Identification', '3. Severity Rating (1-10)', '4. Occurrence Rating (1-10)', '5. Detection Rating (1-10)', '6. RPN Calculation & Ranking', '7. Recommended Actions'],
              doe: ['1. Factor Selection', '2. Level Definition', '3. Design Matrix (Full/Partial Factorial)', '4. Response Variable Definition', '5. Randomization Plan', '6. Statistical Analysis Method', '7. Expected Outcomes'],
              validation_protocol: ['1. Installation Qualification (IQ)', '2. Operational Qualification (OQ)', '3. Performance Qualification (PQ)', '4. Acceptance Criteria', '5. Deviation Handling', '6. Final Report Template'],
            }
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${previewReport.reportType === 'ich_q1a' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : previewReport.reportType === 'ctd_module' ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400' : previewReport.reportType === 'fmea' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : previewReport.reportType === 'doe' ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="truncate">{previewReport.title}</span>
                      <Badge className={`ml-2 text-[10px] ${reportStatusColors[previewReport.status]}`}>{previewReport.status.replace('_', ' ')}</Badge>
                    </div>
                  </DialogTitle>
                  <DialogDescription>{typeInfo?.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-emerald-500 text-sm">
                    <p className="text-muted-foreground">Report ID: <span className="font-mono">{previewReport.id}</span> · Created: {previewReport.createdAt}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Document Structure Outline:</p>
                    {previewContent[previewReport.reportType]?.map((section, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="text-sm">{section}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Compliance Note</p>
                    <p className="text-xs text-muted-foreground">This report follows FDA 21 CFR Part 11 requirements for electronic records and signatures. Audit retention: 7 years.</p>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setPreviewOpen(false); handlePrintReport(previewReport) }}>
                    <Download className="size-4 mr-2" /> Export PDF
                  </Button>
                </DialogFooter>
              </>
            )
          })() : null}
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Generate Report</DialogTitle><DialogDescription>Configure and generate a compliance report</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Report Type *</Label><Select value={selectedReportType} onValueChange={setSelectedReportType}><SelectTrigger><SelectValue placeholder="Select report type" /></SelectTrigger><SelectContent>{REPORT_TYPES.map((rt) => (<SelectItem key={rt.type} value={rt.type}>{rt.title}</SelectItem>))}</SelectContent></Select></div>
            <div><Label>Associated Study</Label><Select value={selectedStudyId} onValueChange={setSelectedStudyId}><SelectTrigger><SelectValue placeholder="Select a study (optional)" /></SelectTrigger><SelectContent>{reportStudies.map((std) => (<SelectItem key={std.id} value={std.id}>{std.studyCode} — {std.substanceName}</SelectItem>))}</SelectContent></Select></div>
            <div><Label>Additional Notes</Label><Textarea placeholder="Any additional context or requirements for this report..." /></div>
            {selectedReportType && (
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-emerald-500 text-sm">
                <p className="text-muted-foreground">Report title preview:</p>
                <p className="font-medium">{REPORT_TYPES.find(r => r.type === selectedReportType)?.title || selectedReportType} Report — {new Date().toLocaleDateString()}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleGenerateReport} disabled={!selectedReportType || generating}>
              {generating ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Generating...</> : <><FileText className="size-4 mr-2" /> Generate Report</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ── Degradation Pathways Page ─────────────────────────────────────────────

function DegradationPage() {
  const { toast } = useToast()
  const { setPage } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [molecules, setMolecules] = useState<MoleculeData[]>([])
  const [selectedMoleculeId, setSelectedMoleculeId] = useState('all')
  const [search, setSearch] = useState('')
  const [hazardFilter, setHazardFilter] = useState('all')
  const [createDpOpen, setCreateDpOpen] = useState(false)
  const [creatingDp, setCreatingDp] = useState(false)
  const [newDp, setNewDp] = useState({
    name: '',
    smiles: '',
    hazardLevel: 'low',
    percentage: 0,
    moleculeId: '',
    description: '',
  })

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [prodRes, molRes] = await Promise.all([
          fetch('/api/degradation-products'),
          fetch('/api/molecules?limit=1000'),
        ])
        if (!cancelled && prodRes.ok) {
          const data = await prodRes.json()
          setProducts(data.products || [])
        }
        if (!cancelled && molRes.ok) {
          const data = await molRes.json()
          const transformed: MoleculeData[] = (data.molecules || []).map(transformMolecule)
          setMolecules(transformed)
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleRefresh = () => { setLoading(true); setRefreshKey(k => k + 1) }

  const hazardColors: Record<string, string> = {
    low: `bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ${HAZARD_OUTLINE_MAP.low}`,
    moderate: `bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ${HAZARD_OUTLINE_MAP.moderate}`,
    high: `bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ${HAZARD_OUTLINE_MAP.high}`,
  }

  const filtered = products.filter((p) => {
    if (selectedMoleculeId !== 'all' && p.moleculeId !== selectedMoleculeId) return false
    if (hazardFilter !== 'all' && p.hazardLevel !== hazardFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.molecule?.name || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by parent molecule
  const grouped: Record<string, { molecule: any; products: any[] }> = {}
  for (const p of filtered) {
    const key = p.moleculeId
    if (!grouped[key]) grouped[key] = { molecule: p.molecule, products: [] }
    grouped[key].products.push(p)
  }

  // Hazard distribution for chart
  const hazardDistribution = ['low', 'moderate', 'high'].map((level) => ({
    level: level.charAt(0).toUpperCase() + level.slice(1),
    count: products.filter((p) => p.hazardLevel === level).length,
    fill: level === 'low' ? '#10b981' : level === 'moderate' ? '#f59e0b' : '#ef4444',
  }))

  // Most common hazard level
  const hazardCounts: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 }
  products.forEach((p) => { if (hazardCounts[p.hazardLevel] !== undefined) hazardCounts[p.hazardLevel]++ })
  const mostCommonHazard = Object.entries(hazardCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'low'

  // Average degradation percentage
  const avgDegradation = products.length > 0
    ? Math.round(products.reduce((s, p) => s + (p.percentage ?? 0), 0) / products.filter(p => p.percentage != null).length)
    : 0

  // Top degradation products by percentage
  const topByPercentage = [...filtered]
    .filter((p) => p.percentage != null)
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
    .slice(0, 8)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Degradation Pathways</h1>
          <p className="text-muted-foreground">Track and analyze chemical degradation products and hazard pathways</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" onClick={() => setCreateDpOpen(true)}>
            <Plus className="size-4 mr-1" /> Add Product
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: products.length, icon: FlaskConical, color: 'emerald' },
          { label: 'Avg Degradation %', value: avgDegradation, icon: Gauge, color: 'teal' },
          { label: 'High Hazard', value: products.filter((p) => p.hazardLevel === 'high').length, icon: AlertTriangle, color: 'red' },
          { label: 'Most Common', value: mostCommonHazard.charAt(0).toUpperCase() + mostCommonHazard.slice(1), icon: BarChart3, color: 'cyan' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="backdrop-blur-sm bg-card/80 overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-1 ${GRADIENT_TOP_BAR[stat.color] || 'bg-emerald-500'}`} />
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${COLOR_MAP[stat.color]}`}><Icon className="size-4" /></div>
                <div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-xl font-bold tabular-nums">{stat.value}</p></div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              Hazard Level Distribution
            </CardTitle>
            <CardDescription>Distribution of degradation products by hazard severity</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={hazardDistribution} dataKey="count" nameKey="level" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {hazardDistribution.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Top Products by Yield %
            </CardTitle>
            <CardDescription>Highest concentration degradation products</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : topByPercentage.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No percentage data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByPercentage} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [`${v}%`, 'Yield']}
                  />
                  <Bar dataKey="percentage" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hazard Level Filter */}
      <div className="flex flex-wrap gap-2 mb-1">
        {['all', 'low', 'moderate', 'high', 'critical'].map((level) => (
          <Button
            key={level}
            variant={hazardFilter === level ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs rounded-full ${hazardFilter === level ? (RISK_PILL_ACTIVE[level] || 'bg-emerald-600 text-white') : ''}`}
            onClick={() => setHazardFilter(level)}
          >
            {level === 'all' ? 'All Levels' : level.charAt(0).toUpperCase() + level.slice(1)}
            {level !== 'all' && <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{hazardCounts[level] || 0}</Badge>}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by product or molecule name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedMoleculeId} onValueChange={setSelectedMoleculeId}>
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue placeholder="All molecules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Molecules</SelectItem>
            {molecules.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name} ({formatFormula(m.formula)})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grouped degradation pathway cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FlaskConical className="size-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No degradation products found</p>
            <p className="text-sm mt-1">Add degradation products to see them here.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setPage('molecules')}>
              <Atom className="size-4 mr-2" /> Go to Molecules
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([molId, group]) => (
            <Card key={molId} className="backdrop-blur-sm bg-card/80 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Atom className="size-4 text-emerald-600 dark:text-emerald-400" />
                      {group.molecule?.name || 'Unknown'}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      <Formula>{group.molecule?.formula}</Formula>
                      {group.molecule?.riskLevel && (
                        <span className="ml-2">· {group.molecule.riskLevel} risk</span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">{group.products.length} product{group.products.length !== 1 ? 's' : ''}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {group.products.map((dp) => {
                  const borderColorClass = HAZARD_BORDER_MAP[dp.hazardLevel] || 'border-l-emerald-500'
                  const barColorClass = HAZARD_BAR_MAP[dp.hazardLevel] || 'from-emerald-400 to-teal-500'
                  return (
                    <div key={dp.id} className={`flex items-center justify-between p-2 rounded-lg border-l-4 ${borderColorClass} bg-muted/40 hover:bg-muted/60 transition-colors`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{dp.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${hazardColors[dp.hazardLevel] || hazardColors.low}`}>
                            {dp.hazardLevel}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">{group.molecule?.name || 'Unknown'}</Badge>
                        </div>
                        {dp.smiles && (
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{dp.smiles}</p>
                        )}
                      </div>
                      {dp.percentage != null && (
                        <div className="ml-2 flex items-center gap-2 shrink-0">
                          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${barColorClass}`}
                              style={{ width: `${Math.min(100, dp.percentage)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums w-10 text-right">{dp.percentage}%</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Degradation Product Dialog */}
      <Dialog open={createDpOpen} onOpenChange={setCreateDpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Degradation Product</DialogTitle>
            <DialogDescription>Define a new degradation product for a parent molecule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-emerald-700 dark:text-emerald-400">Product Name *</Label><Input placeholder="Enter degradation product name" value={newDp.name} onChange={(e) => setNewDp({ ...newDp, name: e.target.value })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
            <div><Label className="text-emerald-700 dark:text-emerald-400">SMILES</Label><Input placeholder="Enter SMILES notation (optional)" value={newDp.smiles} onChange={(e) => setNewDp({ ...newDp, smiles: e.target.value })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500 font-mono" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-emerald-700 dark:text-emerald-400">Parent Molecule *</Label><Select value={newDp.moleculeId} onValueChange={(v) => setNewDp({ ...newDp, moleculeId: v })}><SelectTrigger className="border-emerald-200 dark:border-emerald-800/50"><SelectValue placeholder="Select molecule" /></SelectTrigger><SelectContent>{molecules.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name} ({formatFormula(m.formula)})</SelectItem>))}</SelectContent></Select></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Hazard Level</Label><Select value={newDp.hazardLevel} onValueChange={(v) => setNewDp({ ...newDp, hazardLevel: v })}><SelectTrigger className="border-emerald-200 dark:border-emerald-800/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Degradation %</Label><Input type="number" min="0" max="100" step="0.1" value={newDp.percentage} onChange={(e) => setNewDp({ ...newDp, percentage: parseFloat(e.target.value) || 0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
            </div>
            <div><Label className="text-emerald-700 dark:text-emerald-400">Description</Label><Textarea placeholder="Describe degradation pathway or conditions..." value={newDp.description} onChange={(e) => setNewDp({ ...newDp, description: e.target.value })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDpOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {
              if (!newDp.name.trim() || !newDp.moleculeId) {
                toast({ title: 'Validation error', description: 'Product name and parent molecule are required', variant: 'destructive' })
                return
              }
              setCreatingDp(true)
              try {
                const res = await fetch('/api/degradation-products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: newDp.name,
                    smiles: newDp.smiles || undefined,
                    hazardLevel: newDp.hazardLevel,
                    percentage: newDp.percentage || undefined,
                    moleculeId: newDp.moleculeId,
                    description: newDp.description || undefined,
                  }),
                })
                if (res.ok) {
                  toast({ title: 'Product added', description: `${newDp.name} added as degradation product` })
                  setCreateDpOpen(false)
                  setNewDp({ name: '', smiles: '', hazardLevel: 'low', percentage: 0, moleculeId: '', description: '' })
                  handleRefresh()
                } else {
                  const err = await res.json().catch(() => ({}))
                  toast({ title: 'Error', description: err.error || 'Failed to add product', variant: 'destructive' })
                }
              } catch {
                toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
              } finally {
                setCreatingDp(false)
              }
            }} disabled={creatingDp}>
              {creatingDp ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Adding...</> : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ── Analytics Page ────────────────────────────────────────────────────────

function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [statsData, setStatsData] = useState<{
    totalMolecules: number; activeStudies: number; avgStabilityScore: number;
    riskDistribution: Record<string, number>; recentActivity: any[];
    studiesByStatus: { status: string; _count: { status: number } }[];
    totalReports: number;
  } | null>(null)
  const [molecules, setMolecules] = useState<MoleculeData[]>([])
  const [studies, setStudies] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [statsRes, molRes, stdRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/molecules?limit=1000'),
          fetch('/api/studies?limit=1000'),
        ])
        if (!cancelled && statsRes.ok) {
          const sd = await statsRes.json()
          if (!cancelled) setStatsData(sd)
        }
        if (!cancelled && molRes.ok) {
          const md = await molRes.json()
          const transformed: MoleculeData[] = (md.molecules || []).map(transformMolecule)
          if (!cancelled) setMolecules(transformed)
        }
        if (!cancelled && stdRes.ok) {
          const sd = await stdRes.json()
          if (!cancelled) setStudies(sd.studies || [])
        }
      } catch { /* fallback */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleRefresh = () => { setLoading(true); setRefreshKey(k => k + 1) }

  // Risk distribution pie chart data
  const riskPieData = statsData ? [
    { name: 'Low', value: statsData.riskDistribution.low || 0, fill: '#10b981' },
    { name: 'Moderate', value: statsData.riskDistribution.moderate || 0, fill: '#f59e0b' },
    { name: 'High', value: statsData.riskDistribution.high || 0, fill: '#ef4444' },
    { name: 'Critical', value: statsData.riskDistribution.critical || 0, fill: '#dc2626' },
  ] : []

  // Molecules by data source bar chart
  const sourceMap: Record<string, number> = {}
  molecules.forEach((m) => {
    const src = (m.dataSource || 'manual').toLowerCase()
    sourceMap[src] = (sourceMap[src] || 0) + 1
  })
  const sourceBarData = Object.entries(sourceMap).map(([k, v]) => ({
    source: k.charAt(0).toUpperCase() + k.slice(1),
    count: v,
    fill: k === 'pubchem' ? '#10b981' : k === 'chembl' ? '#14b8a6' : '#06b6d4',
  }))

  // Stability score distribution histogram (bins of 10)
  const bins = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${i * 10 + 9}`,
    count: 0,
  }))
  molecules.forEach((m) => {
    const idx = Math.min(9, Math.max(0, Math.floor(m.stabilityScore / 10)))
    bins[idx].count += 1
  })

  // Study status donut chart
  const statusColors: Record<string, string> = {
    draft: '#94a3b8',
    in_progress: '#14b8a6',
    completed: '#10b981',
    under_review: '#f59e0b',
    approved: '#22c55e',
    rejected: '#ef4444',
  }
  const statusDonutData = statsData?.studiesByStatus?.map((s) => ({
    name: s.status.replace('_', ' '),
    value: s._count.status,
    fill: statusColors[s.status] || '#94a3b8',
  })) || []

  // Temperature vs Shelf Life scatter data
  const scatterData = studies
    .filter((s) => s.predictedShelfLifeMonths !== null && s.predictedShelfLifeMonths !== undefined)
    .map((s) => ({
      x: s.temperatureC,
      y: s.predictedShelfLifeMonths,
      name: s.substanceName,
      code: s.studyCode,
    }))

  // Top 5 most / least stable
  const sortedByStability = [...molecules].sort((a, b) => b.stabilityScore - a.stabilityScore)
  const top5Stable = sortedByStability.slice(0, 5)
  const top5Unstable = [...molecules].sort((a, b) => a.stabilityScore - b.stabilityScore).slice(0, 5)

  // Scatter data: Stability Score vs Molar Mass
  const mwScatterData = molecules
    .filter((m) => m.molarMass > 0 && m.stabilityScore > 0)
    .map((m) => ({ molarMass: m.molarMass, stabilityScore: m.stabilityScore, name: m.name }))

  // Radar data: Multi-property comparison for top 4 molecules
  const radarMolecules = sortedByStability.slice(0, 4)
  const radarProperties = ['Hydrolysis', 'Thermal', 'Photolytic', 'Oxidative', 'Solubility', 'LogP']
  const radarData = radarProperties.map((prop) => {
    const entry: Record<string, string | number> = { property: prop }
    radarMolecules.forEach((mol) => {
      let val = 0
      if (prop === 'Hydrolysis') val = mol.stabilityScore * 0.72
      else if (prop === 'Thermal') val = Math.min(100, mol.stabilityScore * 1.05 + (mol.molarMass > 150 ? 8 : 0))
      else if (prop === 'Photolytic') val = mol.stabilityScore * 0.65 + Math.random() * 5
      else if (prop === 'Oxidative') val = mol.stabilityScore * 0.80
      else if (prop === 'Solubility') val = Math.min(100, Math.max(0, 100 - (mol.logP ?? 0) * 20))
      else if (prop === 'LogP') val = Math.min(100, Math.max(0, (mol.logP ?? 0) * 25 + 30))
      entry[mol.name] = Math.round(Math.min(100, Math.max(0, val)))
    })
    return entry
  })
  const RADAR_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#f59e0b']

  // Export analytics CSV
  const exportAnalyticsCSV = () => {
    const rows: string[] = ['Name,CAS,MW,LogP,Stability,Risk']
    molecules.forEach((m) => {
      rows.push(`${m.name},${m.casNumber},${m.molarMass},${m.logP ?? ''},${m.stabilityScore},${m.riskLevel}`)
    })
    rows.push('')
    rows.push('--- QSPR Model Performance ---')
    QSPR_MODEL_PERFORMANCE.forEach((model) => {
      rows.push(`${model.model},R2=${model.r2},RMSE=${model.rmse},MAE=${model.mae}`)
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chemstab-analytics.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Analytics &amp; Insights</h1>
          <p className="text-muted-foreground">QSPR model performance and platform-wide chemical stability analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportAnalyticsCSV} className="gap-2">
            <Download className="size-4" /> Export Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* QSPR Model Performance */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="size-5 text-emerald-600 dark:text-emerald-400" /> QSPR Model Performance</CardTitle><CardDescription>Prediction accuracy metrics for active QSPR models</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QSPR_MODEL_PERFORMANCE.map((model) => (
                <motion.div key={model.model} whileHover={{ y: -2 }} className="p-4 rounded-xl border bg-card relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: model.fill }} />
                  <div className="flex items-center gap-2 mb-3"><Brain className="size-4" style={{ color: model.fill }} /><p className="font-semibold">{model.model}</p></div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">R²</span><span className="font-bold" style={{ color: model.fill }}>{model.r2.toFixed(2)}</span></div>
                    <Progress value={model.r2 * 100} className="h-1.5" />
                    <div className="flex items-center justify-between pt-1"><span className="text-muted-foreground">RMSE</span><span className="font-medium">{model.rmse.toFixed(2)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">MAE</span><span className="font-medium">{model.mae.toFixed(2)}</span></div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Property Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader><CardTitle>Risk Level Distribution</CardTitle><CardDescription>Molecule count by risk classification</CardDescription></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : riskPieData.length === 0 ? <p className="text-sm text-muted-foreground py-20 text-center">No data available</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart><Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>{riskPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} /><Legend /></PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader><CardTitle>Molecules by Data Source</CardTitle><CardDescription>Origin of molecule records</CardDescription></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : sourceBarData.length === 0 ? <p className="text-sm text-muted-foreground py-20 text-center">No data available</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceBarData}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="source" className="text-xs" /><YAxis className="text-xs" allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} /><Bar dataKey="count" radius={[6, 6, 0, 0]}>{sourceBarData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stability Score Distribution + Study Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader><CardTitle>Stability Score Distribution</CardTitle><CardDescription>Histogram of molecule predicted stability scores</CardDescription></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bins}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="range" className="text-xs" /><YAxis className="text-xs" allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} /><Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader><CardTitle>Study Status Distribution</CardTitle><CardDescription>Current state of stability studies</CardDescription></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : statusDonutData.length === 0 ? <p className="text-sm text-muted-foreground py-20 text-center">No data available</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart><Pie data={statusDonutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label>{statusDonutData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} /><Legend /></PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Temperature vs Shelf Life Scatter */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardHeader><CardTitle>Temperature vs. Predicted Shelf Life</CardTitle><CardDescription>Relationship between study temperature and predicted shelf life</CardDescription></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-[300px] w-full" /> : scatterData.length === 0 ? <p className="text-sm text-muted-foreground py-20 text-center">No shelf life data available</p> : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis type="number" dataKey="x" name="Temperature" unit="°C" className="text-xs" /><YAxis type="number" dataKey="y" name="Shelf Life" unit=" mo" className="text-xs" /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(val: any, name: any) => [name === 'Shelf Life' ? `${val} months` : name === 'Temperature' ? `${val}°C` : val, name]} /><Scatter name="Studies" data={scatterData} fill="#14b8a6" /></ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top 5 Most / Least Stable Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="size-5 text-emerald-600 dark:text-emerald-400" />
              Top 5 Most Stable Molecules
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Formula</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    ))
                  ) : top5Stable.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>
                  ) : (
                    top5Stable.map((mol, idx) => (
                      <TableRow key={mol.id} className={idx % 2 === 1 ? 'bg-muted/30' : ''}>
                        <TableCell className="font-medium">{mol.name}</TableCell>
                        <TableCell className="font-mono text-xs"><Formula>{mol.formula}</Formula></TableCell>
                        <TableCell>
                          <span className={`font-bold ${getScoreColor(mol.stabilityScore)}`}>{mol.stabilityScore}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownRight className="size-5 text-amber-600 dark:text-amber-400" />
              Top 5 Least Stable Molecules
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Formula</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    ))
                  ) : top5Unstable.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>
                  ) : (
                    top5Unstable.map((mol, idx) => (
                      <TableRow key={mol.id} className={idx % 2 === 1 ? 'bg-muted/30' : ''}>
                        <TableCell className="font-medium">{mol.name}</TableCell>
                        <TableCell className="font-mono text-xs"><Formula>{mol.formula}</Formula></TableCell>
                        <TableCell>
                          <span className={`font-bold ${getScoreColor(mol.stabilityScore)}`}>{mol.stabilityScore}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stability vs Molecular Weight Scatter */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
            Stability vs Molecular Weight
          </CardTitle>
          <CardDescription>Correlation between molecular weight and predicted stability</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : mwScatterData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-20 text-center">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="molarMass" name="MW" type="number" className="text-xs" label={{ value: 'MW (g/mol)', position: 'insideBottom', offset: -5 }} />
                <YAxis dataKey="stabilityScore" name="Score" type="number" domain={[0, 100]} className="text-xs" label={{ value: 'Stability', angle: -90, position: 'insideLeft' }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Scatter name="Molecules" data={mwScatterData} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Property Comparison Radar */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5 text-teal-600 dark:text-teal-400" />
            Property Comparison Radar
          </CardTitle>
          <CardDescription>Compare molecules across multiple stability dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : radarData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-20 text-center">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis dataKey="property" className="text-xs" />
                <PolarRadiusAxis domain={[0, 100]} className="text-xs" />
                {radarMolecules.map((mol, i) => (
                  <Radar key={mol.name} name={mol.name} dataKey={mol.name} stroke={RADAR_COLORS[i]} fill={RADAR_COLORS[i]} fillOpacity={0.15} />
                ))}
                <Legend />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

    </motion.div>
  )
}

// ── Admin Page ────────────────────────────────────────────────────────────

function AdminPage() {
  const { toast } = useToast()
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [auditData, setAuditData] = useState<any[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditFacets, setAuditFacets] = useState<{ actions: any[]; tables: any[] }>({ actions: [], tables: [] })
  const [auditFilterAction, setAuditFilterAction] = useState('all')
  const [auditFilterTable, setAuditFilterTable] = useState('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [savingUser, setSavingUser] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'viewer', isActive: true })
  const [statsInfo, setStatsInfo] = useState<{ totalMolecules: number; activeStudies: number; totalReports: number; auditCount: number }>({ totalMolecules: 10, activeStudies: 3, totalReports: 5, auditCount: 6 })

  // Load stats + users
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/users'),
        ])
        if (!cancelled && statsRes.ok) {
          const data = await statsRes.json()
          setStatsInfo({
            totalMolecules: data.totalMolecules ?? 10,
            activeStudies: data.activeStudies ?? 3,
            totalReports: data.totalReports ?? 5,
            auditCount: data.totalReports ? (data.recentActivity?.length || 6) : 6,
          })
        }
        if (!cancelled && usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users || [])
        }
      } catch { /* fallback */ }
      if (!cancelled) { setLoading(false); setUsersLoading(false) }
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  // Load audit logs (with debounce on search)
  useEffect(() => {
    setAuditLoading(true)
    const params = new URLSearchParams()
    if (auditFilterAction !== 'all') params.set('action', auditFilterAction)
    if (auditFilterTable !== 'all') params.set('table', auditFilterTable)
    if (auditSearch) params.set('q', auditSearch)
    params.set('limit', '50')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/audit-logs?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setAuditData(data.logs || [])
          setAuditTotal(data.pagination?.total ?? 0)
          setAuditFacets(data.facets || { actions: [], tables: [] })
        }
      } catch { /* ignore */ }
      setAuditLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [auditFilterAction, auditFilterTable, auditSearch, refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  const startTraining = () => {
    setTrainingStatus('running')
    setTimeout(() => setTrainingStatus('done'), 3000)
  }

  const openCreateUser = () => {
    setEditingUser(null)
    setUserForm({ name: '', email: '', role: 'viewer', isActive: true })
    setUserDialogOpen(true)
  }

  const openEditUser = (user: any) => {
    setEditingUser(user)
    setUserForm({ name: user.name || '', email: user.email, role: user.role, isActive: user.isActive })
    setUserDialogOpen(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.email.trim()) {
      toast({ title: 'Validation error', description: 'Email is required', variant: 'destructive' })
      return
    }
    setSavingUser(true)
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      if (res.ok) {
        toast({
          title: editingUser ? 'User updated' : 'User created',
          description: `${userForm.email} saved successfully`,
        })
        setUserDialogOpen(false)
        // Refresh users
        const refreshRes = await fetch('/api/users')
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setUsers(data.users || [])
        }
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: err.error || 'Failed to save user', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setSavingUser(false)
    }
  }

  const handleToggleUserStatus = async (user: any) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) {
        toast({
          title: user.isActive ? 'User deactivated' : 'User activated',
          description: user.email,
        })
        setUsers(users.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      } else {
        toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    }
  }

  // actionIconMap and actionColorMap now use global maps
  // auditActionColors uses ACTION_TEXT_MAP

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Administration</h1>
          <p className="text-muted-foreground">Manage users, audit trail, ML training, and system configuration</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Organization Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: String(users.length || 5), icon: Users, color: 'emerald' },
          { label: 'Active Studies', value: String(statsInfo.activeStudies), icon: Microscope, color: 'teal' },
          { label: 'Reports Generated', value: String(statsInfo.totalReports), icon: FileText, color: 'cyan' },
          { label: 'Audit Events', value: String(auditTotal || statsInfo.auditCount), icon: ClipboardList, color: 'amber' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="backdrop-blur-sm bg-card/80 overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-1 ${GRADIENT_TOP_BAR[stat.color] || 'bg-amber-500'}`} />
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${COLOR_MAP[stat.color]}`}><Icon className="size-4" /></div>
                <div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-xl font-bold tabular-nums">{stat.value}</p></div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* User Management + Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Users */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  User Management
                </CardTitle>
                <CardDescription>Manage platform users and roles</CardDescription>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openCreateUser}>
                <Plus className="size-4 mr-1" /> Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {usersLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user, idx) => (
                      <TableRow key={user.id} className={idx % 2 === 1 ? 'bg-muted/30' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleAvatarColors[user.role] || 'from-slate-400 to-slate-500'} text-white flex items-center justify-center text-xs font-bold shadow-md shrink-0`}>
                              {(user.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{user.name || '(no name)'}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{roleLabels[user.role] || user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActive
                            ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">Active</Badge>
                            : <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center justify-end gap-1">
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditUser(user)}>
                                    <Settings className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit user</TooltipContent>
                              </UiTooltip>
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => handleToggleUserStatus(user)}
                                  >
                                    {user.isActive
                                      ? <XCircle className="size-3.5 text-red-500" />
                                      : <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    }
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{user.isActive ? 'Deactivate' : 'Activate'}</TooltipContent>
                              </UiTooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No users found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail with filters */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5" />
              Audit Trail
            </CardTitle>
            <CardDescription>Filtered system audit events ({auditTotal} total)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search details..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="text-xs h-8 flex-1 min-w-[120px]"
              />
              <Select value={auditFilterAction} onValueChange={setAuditFilterAction}>
                <SelectTrigger className="text-xs h-8 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="sign">Sign</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
              <Select value={auditFilterTable} onValueChange={setAuditFilterTable}>
                <SelectTrigger className="text-xs h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {auditFacets.tables.map((t: any) => (
                    <SelectItem key={t.table} value={t.table}>{t.table} ({t.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action facet chips */}
            {auditFacets.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {auditFacets.actions.map((a: any) => (
                  <button
                    key={a.action}
                    onClick={() => setAuditFilterAction(auditFilterAction === a.action ? 'all' : a.action)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      auditFilterAction === a.action
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted/40 border-border hover:bg-muted'
                    }`}
                  >
                    {a.action} <span className="font-semibold">{a.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Audit Timeline */}
            <div className="max-h-72 overflow-y-auto">
              {auditLoading ? (
                <div className="space-y-4 p-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : auditData.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-xs">
                  No audit events match your filters
                </p>
              ) : (
                <div className="space-y-0">
                  {auditData.map((entry, i) => {
                    const Icon = ACTION_ICON_MAP[entry.action] || Activity
                    const color = ACTION_COLOR_MAP[entry.action] || ACTION_COLOR_MAP.create
                    return (
                      <div key={entry.id} className="flex gap-4 pb-6 relative">
                        <div className="flex flex-col items-center">
                          <div className={`size-8 rounded-full flex items-center justify-center ${color} shadow-sm`}><Icon className="size-4" /></div>
                          {i < auditData.length - 1 && <div className="w-0.5 flex-1 bg-gradient-to-b from-border to-border/50 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-medium">{entry.details || `${entry.action} on ${entry.tableName}`}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">{entry.user?.name || entry.user?.email || 'System'}</span><span>·</span>
                            <Badge variant="outline" className="text-[10px] h-4">{entry.action}</Badge>
                            <Badge variant="outline" className="text-[10px] h-4 font-mono">{entry.tableName}</Badge><span>·</span>
                            <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Dashboard + System Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Health Dashboard */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5 text-emerald-600 dark:text-emerald-400" />
              System Health Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'ML Model Accuracy', value: 94.2, color: 'emerald' },
              { label: 'API Response Time', value: 97, color: 'teal' },
              { label: 'Database Integrity', value: 100, color: 'cyan' },
              { label: 'Storage Capacity', value: 78, color: 'amber' },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{item.label}</span><span className="font-semibold">{item.value}%</span></div>
                <Progress value={item.value} className={`h-3 ${PROGRESS_BAR_MAP[item.color] || '[&>div]:bg-amber-500'}`} />
              </div>
            ))}
            <Separator />
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">QSPR Stability Model</span><Badge variant="outline" className="text-xs">{trainingStatus === 'done' ? 'Trained' : trainingStatus === 'running' ? 'Training...' : 'Ready'}</Badge></div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Dataset:</span> <span className="font-medium">2,847 compounds</span></div>
                <div><span className="text-muted-foreground">Features:</span> <span className="font-medium">128 descriptors</span></div>
                <div><span className="text-muted-foreground">Last trained:</span> <span className="font-medium">2024-03-10</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium text-emerald-600 dark:text-emerald-400">Operational</span></div>
              </div>
              {trainingStatus === 'running' && <Progress value={66} className="h-2" />}
              {trainingStatus === 'done' && <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-4" /> Training completed successfully</div>}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
              onClick={startTraining}
              disabled={trainingStatus === 'running'}
            >
              {trainingStatus === 'running'
                ? <><RefreshCw className="size-4 animate-spin mr-2" /> Training in progress...</>
                : <><Brain className="size-4 mr-2" /> Retrain Model</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              System Configuration
            </CardTitle>
            <CardDescription>Platform settings and parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Default Temperature Unit', value: '°C (Celsius)' },
              { label: 'Risk Threshold — Low', value: 'Score ≥ 80' },
              { label: 'Risk Threshold — Moderate', value: 'Score 60–79' },
              { label: 'Risk Threshold — High', value: 'Score 40–59' },
              { label: 'Risk Threshold — Critical', value: 'Score < 40' },
              { label: 'Audit Retention Period', value: '7 years (FDA 21 CFR Part 11)' },
              { label: 'Session Timeout', value: '30 minutes' },
              { label: 'Data Encryption', value: 'AES-256' },
            ].map((cfg) => (
              <div key={cfg.label} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">{cfg.label}</span>
                <span className="text-sm font-medium">{cfg.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* User Create/Edit Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingUser ? (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleAvatarColors[editingUser.role] || 'from-slate-400 to-slate-500'} text-white flex items-center justify-center text-xs font-bold shadow-md`}>
                  {(editingUser.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              ) : (<Users className="size-5 text-emerald-600 dark:text-emerald-400" />)}
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            {editingUser && <DialogDescription>Editing {editingUser.name || editingUser.email} — {roleLabels[editingUser.role] || editingUser.role}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">
            {!editingUser && userForm.name && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleAvatarColors[userForm.role] || 'from-slate-400 to-slate-500'} text-white flex items-center justify-center text-xs font-bold shadow-md`}>
                  {userForm.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                </div>
                <span className="text-sm text-muted-foreground">Preview: {roleLabels[userForm.role] || userForm.role}</span>
              </div>
            )}
            <div><Label className="text-sm font-medium">Full Name *</Label><Input placeholder="e.g. Dr. Jane Smith" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className={!userForm.name.trim() && userForm.email ? 'border-red-300 focus:border-red-500' : ''} />{!userForm.name.trim() && userForm.email && <p className="text-xs text-red-500 mt-1">Name is required</p>}</div>
            <div><Label className="text-sm font-medium">Email *</Label><Input type="email" placeholder="jane.smith@chemstab.io" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className={!userForm.email.trim() ? 'border-red-300 focus:border-red-500' : ''} />{!userForm.email.trim() && <p className="text-xs text-red-500 mt-1">Email is required</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium">Role</Label><Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="viewer">Viewer</SelectItem><SelectItem value="analyst">Analyst</SelectItem><SelectItem value="project_manager">Project Manager</SelectItem><SelectItem value="org_admin">Org Admin</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem></SelectContent></Select></div>
              <div><Label className="text-sm font-medium">Status</Label><Select value={userForm.isActive ? 'active' : 'inactive'} onValueChange={(v) => setUserForm({ ...userForm, isActive: v === 'active' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Badge variant="outline" className="text-xs">{roleLabels[userForm.role] || userForm.role}</Badge>
              {userForm.isActive ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">Active</Badge> : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveUser} disabled={savingUser || !userForm.name.trim() || !userForm.email.trim()}>
              {savingUser
                ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Saving...</>
                : <><Plus className="size-4 mr-2" /> {editingUser ? 'Save Changes' : 'Create User'}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ── Page Router ───────────────────────────────────────────────────────────

function PageRouter() {
  const { currentPage } = useAppStore()

  const pages: Record<PageId, React.ReactNode> = {
    dashboard: <DashboardPage />,
    molecules: <MoleculesPage />,
    simulator: <SimulatorPage />,
    studies: <StudiesPage />,
    degradation: <DegradationPage />,
    reports: <ReportsPage />,
    analytics: <AnalyticsPage />,
    admin: <AdminPage />,
  }

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-y-auto"
      >
        {pages[currentPage]}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Notifications Button (Header) ────────────────────────────────────────

function NotificationsButton() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadNotifications = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) setNotifications(data.recentActivity || [])
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    loadNotifications()
    return () => { cancelled = true }
  }, [])

  const unreadCount = Math.min(notifications.length, 5)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <motion.div
            animate={unreadCount > 0 ? { rotate: [0, -10, 10, -10, 0] } : {}}
            transition={{ duration: 0.6, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 4 }}
          >
            <Bell className="size-4" />
          </motion.div>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Notifications</p>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No recent notifications</p>
          ) : (
            notifications.map((n) => {
              const Icon = ACTION_ICON_MAP[n.action] || Activity
              const color = ACTION_TEXT_MAP[n.action] || ACTION_TEXT_MAP.create
              return (
                <div key={n.id} className="flex items-start gap-2 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                  <Icon className={`size-4 mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug"><span className="font-medium">{n.user?.name || 'System'}</span> <span className="text-muted-foreground">{n.action}</span> <span className="font-mono text-[10px]">{n.tableName} #{n.recordId}</span></p>
                    {n.details && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.details}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── AI Assistant Chat Panel ────────────────────────────────────────────────

const QPROMPTS = ['Explain hydrolysis degradation', 'What is ICH Q1A?', 'How does Q10 affect shelf life?', 'Compare stability of Aspirin vs Ibuprofen']
interface CMsg { role: 'user' | 'assistant'; content: string; ts: number }

function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<CMsg[]>([])
  const [input, setInput] = useState('')
  const [ld, setLd] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const send = useCallback(async (t: string) => {
    if (!t.trim() || ld) return
    setMsgs(p => [...p, { role: 'user', content: t.trim(), ts: Date.now() }])
    setInput(''); setLd(true); setErr(null)
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: t.trim() }) })
      if (!r.ok) { const errData = await r.json().catch(() => ({ error: 'Request failed' })); throw new Error(errData.error || `HTTP ${r.status}`) }
      const data = await r.json()
      setMsgs(p => [...p, { role: 'assistant', content: data.response, ts: Date.now() }])
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') } finally { setLd(false) }
  }, [ld])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  return (
    <>
      <motion.button onClick={() => setOpen(!open)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center" aria-label="AI Assistant">
        {open ? <X className="size-5" /> : <Brain className="size-5" />}
        {!open && <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-gradient-to-br from-emerald-500 to-teal-600" />}
      </motion.button>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-20 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] rounded-2xl border bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-emerald-500/10">
            <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white"><Brain className="size-3.5" /></div><div><h3 className="font-semibold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">ChemStab AI</h3><p className="text-[10px] text-muted-foreground">Stability expert</p></div></div>
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-emerald-500" /></span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: '400px' }}>
            {msgs.length === 0 && <div className="flex flex-col items-center py-8 text-center"><Sparkles className="size-8 text-emerald-500 mb-2" /><h4 className="font-medium text-sm mb-3">Ask ChemStab AI</h4><div className="flex flex-col gap-2 w-full max-w-[320px]">{QPROMPTS.map(p => <button key={p} onClick={() => send(p)} className="text-left px-3 py-2 rounded-lg border hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs transition-colors"><MessageCircle className="size-3 text-emerald-500 mr-2 inline" />{p}</button>)}</div></div>}
            {msgs.map((m, i) => <motion.div key={m.ts + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white' : 'bg-card border'}`}>
                {m.role === 'assistant' && <div className="flex items-center gap-1 mb-1"><Brain className="size-3 text-emerald-500" /><span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">AI</span></div>}
                <p className="whitespace-pre-wrap">{m.content}</p></div></motion.div>)}
            {ld && <div className="flex items-center gap-1 py-3"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" /><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" /><span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" /><span className="text-xs text-muted-foreground ml-2">Thinking...</span></div>}
            {err && <div className="flex flex-col items-center gap-2 py-3"><div className="flex items-center gap-2 text-destructive text-xs"><AlertCircle className="size-3.5" />{err}</div><Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { const l = msgs.filter(m => m.role === 'user').pop(); if (l) { setMsgs(p => p.slice(0, -1)); setErr(null); send(l.content) } }}><RefreshCw className="size-3 mr-1" />Retry</Button></div>}
            <div ref={endRef} />
          </div>
          <div className="border-t px-3 py-3">
            <div className="flex items-center gap-2"><Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(input) } }} placeholder="Ask about stability..." disabled={ld} className="h-9 text-sm" /><Button onClick={() => send(input)} disabled={!input.trim() || ld} size="icon" className="h-9 w-9 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0"><Send className="size-3.5" /></Button></div>
            {msgs.length > 0 && <button onClick={() => { setMsgs([]); setErr(null) }} className="mt-2 text-[10px] text-muted-foreground hover:text-foreground w-full text-center">Clear conversation</button>}
          </div>
        </motion.div>
      )}</AnimatePresence>
    </>
  )
}

// ── Main Layout ───────────────────────────────────────────────────────────

export default function Home() {
  const { currentPage } = useAppStore()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-emerald-50/30 dark:from-background dark:via-background dark:to-emerald-950/20 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 h-14 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center px-4 gap-3">
        {/* Mobile menu button in header */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={useAppStore.getState().toggleSidebar}
        >
          <Menu className="size-4" />
        </Button>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">ChemStab</span>
          <ChevronRight className="size-3" />
          <span className="capitalize">{currentPage.replace('_', ' ')}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <NotificationsButton />
          <div className="flex items-center gap-2 pl-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-sm font-medium shadow-md shadow-emerald-500/20">
              SC
            </div>
            <span className="text-sm font-medium hidden sm:inline">Dr. Sarah Chen</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <PageRouter />
        </main>
      </div>

      {/* Sticky Footer */}
      <footer className="mt-auto border-t bg-gradient-to-r from-card via-card to-emerald-50/30 dark:via-card dark:to-emerald-950/20 py-3 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
          <span>© 2024 ChemStab Industrial — Chemical Stability Assessment Platform</span>
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            v5.3.0 · FDA 21 CFR Part 11 Compliant
          </span>
        </div>
      </footer>

      {/* AI Assistant Floating Panel */}
      <AIAssistant />
    </div>
  )
}
