'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FlaskConical, Atom, Beaker, FileText, ShieldCheck,
  ChevronLeft, ChevronRight, Menu, X, Sun, Moon, Bell, Search, Plus,
  Trash2, Play, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  BarChart3, Activity, Database, Cpu, Thermometer, Droplets, Eye,
  Lightbulb, FileCheck, ClipboardList, Brain, Settings, Users,
  ArrowRight, Download, RefreshCw, ChevronDown, Filter, Info,
  Shield, Zap, Microscope, BookOpen, AlertCircle, XCircle,
  FileBadge, Scale, GraduationCap, Gauge, ArrowUpRight, ArrowDownRight
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
} from 'recharts'
import { useToast } from '@/hooks/use-toast'
import {
  Tooltip as UiTooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover'

// ── Types ──────────────────────────────────────────────────────────────────

type PageId = 'dashboard' | 'molecules' | 'simulator' | 'studies' | 'reports' | 'analytics' | 'admin'

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

// ── Sidebar Navigation ────────────────────────────────────────────────────

const NAV_ITEMS: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'molecules', label: 'Molecules', icon: Atom },
  { id: 'simulator', label: 'Simulator', icon: Beaker },
  { id: 'studies', label: 'Studies', icon: Microscope },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
]

function Sidebar() {
  const { currentPage, setPage, sidebarOpen, toggleSidebar, darkMode, toggleDarkMode } = useAppStore()

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
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
            {sidebarOpen && <span className="whitespace-nowrap">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
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
  } | null>(null)

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
        const res = await fetch('/api/stats')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) setStatsData(data)
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
    ? statsData.recentActivity.map((entry: any) => {
        const actionIconMap: Record<string, any> = {
          create: Plus, update: RefreshCw, delete: Trash2, approve: CheckCircle2, sign: Shield, reject: XCircle,
        }
        const actionColorMap: Record<string, string> = {
          create: 'emerald', update: 'amber', delete: 'red', approve: 'teal', sign: 'cyan', reject: 'red',
        }
        const icon = actionIconMap[entry.action] || Activity
        const color = actionColorMap[entry.action] || 'emerald'
        const timeStr = new Date(entry.createdAt).toLocaleDateString()
        return {
          text: `${entry.action} on ${entry.tableName} (#${entry.recordId}) — ${entry.details || ''}`.trim(),
          time: timeStr,
          icon,
          color,
        }
      })
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
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : stats.map((stat) => {
          const Icon = stat.icon
          const colorMap: Record<string, string> = {
            emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
            teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
            cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
            amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
            red: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
          }
          return (
            <motion.div
              key={stat.label}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Card className="cursor-pointer backdrop-blur-sm bg-card/80 transition-transform hover:-translate-y-1 overflow-hidden relative">
                <div className={`absolute inset-x-0 top-0 h-1 ${stat.color === 'emerald' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : stat.color === 'teal' ? 'bg-gradient-to-r from-teal-500 to-cyan-500' : stat.color === 'cyan' ? 'bg-gradient-to-r from-cyan-500 to-sky-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${colorMap[stat.color]}`}>
                      <Icon className="size-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    {stat.trendUp ? <ArrowUpRight className="size-3 text-emerald-500" /> : <ArrowDownRight className="size-3 text-amber-500" />}
                    {stat.trend}
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
              const colorMap: Record<string, string> = {
                emerald: 'text-emerald-600 dark:text-emerald-400',
                teal: 'text-teal-600 dark:text-teal-400',
                cyan: 'text-cyan-600 dark:text-cyan-400',
                amber: 'text-amber-600 dark:text-amber-400',
                red: 'text-red-600 dark:text-red-400',
              }
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Icon className={`size-4 mt-0.5 shrink-0 ${colorMap[item.color]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
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
          const transformed: MoleculeData[] = (data.molecules || []).map((m: any) => ({
            id: m.id, name: m.name, casNumber: m.casNumber || '', smiles: m.smiles || '',
            formula: m.formula || '', molarMass: m.molarMass ?? 0, logP: m.logP ?? 0,
            stabilityScore: m.predictedStabilityScore ?? 0, riskLevel: m.riskLevel || 'low',
            dataSource: m.dataSource || 'Manual', description: m.description || '',
            meltingPoint: m.meltingPoint ?? null, boilingPoint: m.boilingPoint ?? null,
          }))
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

  // Apply source filter client-side on fetched molecules
  const displayed = sourceFilter === 'all'
    ? apiMolecules
    : apiMolecules.filter((mol) => mol.dataSource.toLowerCase() === sourceFilter.toLowerCase())

  const openDetail = (mol: MoleculeData) => {
    setSelectedMolecule(mol)
    setDetailOpen(true)
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
        <div className="flex gap-2">
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

      {/* Table */}
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
                      <TableCell>{mol.formula}</TableCell>
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

      {/* Add Molecule Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-emerald-600 dark:text-emerald-400" />
              Add New Molecule
            </DialogTitle>
            <DialogDescription>Create a new entry in the chemical compounds database</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Acetylsalicylic acid"
                value={newMolecule.name}
                onChange={(e) => setNewMolecule({ ...newMolecule, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CAS Number</Label>
                <Input
                  placeholder="e.g. 50-78-2"
                  value={newMolecule.casNumber}
                  onChange={(e) => setNewMolecule({ ...newMolecule, casNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>Formula</Label>
                <Input
                  placeholder="e.g. C9H8O4"
                  value={newMolecule.formula}
                  onChange={(e) => setNewMolecule({ ...newMolecule, formula: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>SMILES</Label>
              <Input
                placeholder="e.g. CC(=O)OC1=CC=CC=C1C(=O)O"
                value={newMolecule.smiles}
                onChange={(e) => setNewMolecule({ ...newMolecule, smiles: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Molar Mass</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newMolecule.molarMass || ''}
                  onChange={(e) => setNewMolecule({ ...newMolecule, molarMass: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>LogP</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newMolecule.logP || ''}
                  onChange={(e) => setNewMolecule({ ...newMolecule, logP: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Stability (0-100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={newMolecule.predictedStabilityScore || ''}
                  onChange={(e) => setNewMolecule({ ...newMolecule, predictedStabilityScore: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Risk Level</Label>
                <Select value={newMolecule.riskLevel} onValueChange={(v) => setNewMolecule({ ...newMolecule, riskLevel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Source</Label>
                <Select value={newMolecule.dataSource} onValueChange={(v) => setNewMolecule({ ...newMolecule, dataSource: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="pubchem">PubChem</SelectItem>
                    <SelectItem value="chembl">ChEMBL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the compound and its stability profile..."
                value={newMolecule.description}
                onChange={(e) => setNewMolecule({ ...newMolecule, description: e.target.value })}
                rows={3}
              />
            </div>
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Formula', value: selectedMolecule.formula || '—' },
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

                <Separator />

                {/* Degradation Products placeholder */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-medium">Degradation Products</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground">
                    No degradation pathway data has been recorded for this molecule yet.
                    Run a stability simulation or link a study to populate this section.
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailOpen(false)
                    setPage('studies')
                  }}
                >
                  <Microscope className="size-4 mr-2" /> Create Study from this Molecule
                </Button>
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

function SimulatorPage() {
  const analysisStore = useAnalysisStore()
  const [simDone, setSimDone] = useState(false)

  const runSimulation = useCallback(async () => {
    analysisStore.setRunning(true)
    setSimDone(false)
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
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 items-end"
                >
                  <div className="flex-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="Substance name"
                      value={sub.name}
                      onChange={(e) => analysisStore.updateSubstance(i, 'name', e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Conc.</Label>
                    <Input
                      type="number"
                      value={sub.concentration}
                      onChange={(e) => analysisStore.updateSubstance(i, 'concentration', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={sub.unit}
                      onValueChange={(v) => analysisStore.updateSubstance(i, 'unit', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g/L">g/L</SelectItem>
                        <SelectItem value="mg/mL">mg/mL</SelectItem>
                        <SelectItem value="mol/L">mol/L</SelectItem>
                        <SelectItem value="%w/v">%w/v</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {analysisStore.substances.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => analysisStore.removeSubstance(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
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
                <div>
                  <Label className="text-xs">pH</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={analysisStore.conditions.ph}
                    onChange={(e) => analysisStore.setConditions({ ph: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Temperature (°C)</Label>
                  <Input
                    type="number"
                    value={analysisStore.conditions.temperature}
                    onChange={(e) => analysisStore.setConditions({ temperature: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Dissolved O₂ (mg/L)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={analysisStore.conditions.dissolvedOxygen}
                    onChange={(e) => analysisStore.setConditions({ dissolvedOxygen: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Light Exposure (lux)</Label>
                  <Input
                    type="number"
                    value={analysisStore.conditions.lightExposure}
                    onChange={(e) => analysisStore.setConditions({ lightExposure: parseFloat(e.target.value) || 0 })}
                  />
                </div>
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
                className="flex items-center justify-center py-20"
              >
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="size-8 animate-spin text-emerald-600" />
                  <p className="text-sm text-muted-foreground">Running stability analysis simulation...</p>
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
                <Card className="flex flex-col items-center justify-center py-20">
                  <Beaker className="size-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">Configure substances and conditions, then run the analysis</p>
                  <p className="text-xs text-muted-foreground mt-1">Results will appear here after simulation completes</p>
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
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [apiStudies, setApiStudies] = useState<StudyData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailStudy, setDetailStudy] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [signing, setSigning] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [newStudy, setNewStudy] = useState({
    substanceName: '',
    studyType: 'long_term',
    temperatureC: 25,
    humidityPercent: 60,
    durationMonths: 24,
  })

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      try {
        const res = await fetch(`/api/studies?${params.toString()}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const transformed: StudyData[] = (data.studies || []).map((s: any) => ({
            id: s.id, studyCode: s.studyCode || '', substanceName: s.substanceName || '',
            studyType: s.studyType || 'long_term', temperatureC: s.temperatureC ?? 25,
            humidityPercent: s.humidityPercent ?? null, durationMonths: s.durationMonths ?? 24,
            predictedShelfLifeMonths: s.predictedShelfLifeMonths ?? null,
            status: s.status || 'draft', ph: s.ph ?? null,
          }))
          if (!cancelled) {
            setApiStudies(transformed)
            setTotalCount(data.pagination?.total ?? 0)
          }
        }
      } catch { /* fallback */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [statusFilter, typeFilter, refreshKey])

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
        }),
      })
      if (res.ok) {
        toast({
          title: 'Study created',
          description: `${newStudy.substanceName} study created successfully (${code})`,
        })
        setCreateOpen(false)
        setNewStudy({ substanceName: '', studyType: 'long_term', temperatureC: 25, humidityPercent: 60, durationMonths: 24 })
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="long_term">Long-Term</SelectItem>
            <SelectItem value="accelerated">Accelerated</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="stress">Stress Testing</SelectItem>
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
            <div>
              <Label>Substance Name *</Label>
              <Input
                placeholder="Enter substance name"
                value={newStudy.substanceName}
                onChange={(e) => setNewStudy({ ...newStudy, substanceName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Study Type</Label>
                <Select value={newStudy.studyType} onValueChange={(v) => setNewStudy({ ...newStudy, studyType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long_term">Long-Term</SelectItem>
                    <SelectItem value="accelerated">Accelerated</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="stress">Stress Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (months)</Label>
                <Input
                  type="number"
                  value={newStudy.durationMonths}
                  onChange={(e) => setNewStudy({ ...newStudy, durationMonths: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  value={newStudy.temperatureC}
                  onChange={(e) => setNewStudy({ ...newStudy, temperatureC: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Humidity (%)</Label>
                <Input
                  type="number"
                  value={newStudy.humidityPercent}
                  onChange={(e) => setNewStudy({ ...newStudy, humidityPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>
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
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                      No time point data recorded for this study yet.
                    </p>
                  )}
                </div>

                <Separator />

                {/* Electronic signatures */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium">Electronic Signatures ({detailStudy.signatures?.length || 0})</p>
                  </div>
                  {detailStudy.signatures && detailStudy.signatures.length > 0 ? (
                    <div className="space-y-2">
                      {detailStudy.signatures.map((sig: any) => (
                        <div key={sig.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {sig.signerName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{sig.signerName}</p>
                            <p className="text-xs text-muted-foreground">{sig.meaning} · {sig.signerRole}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{sig.signedAt ? new Date(sig.signedAt).toLocaleString() : ''}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">#{sig.signatureHash?.slice(0, 8)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                      No electronic signatures recorded yet.
                    </p>
                  )}
                </div>

                <Separator />

                {/* Status action buttons */}
                {detailStudy.status === 'under_review' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => updateStudyStatus('approved')}
                      disabled={statusUpdating}
                    >
                      <CheckCircle2 className="size-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateStudyStatus('rejected')}
                      disabled={statusUpdating}
                    >
                      <XCircle className="size-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={signStudy}
                  disabled={signing}
                >
                  {signing ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Signing...</> : <><Shield className="size-4 mr-2" /> Sign Study</>}
                </Button>
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

  const reportStatusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    in_progress: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  }

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
    cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
  }

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const res = await fetch('/api/reports')
        if (res.ok && !cancelled) {
          const data = await res.json()
          const transformed: ReportData[] = (data.reports || []).map((r: any) => ({
            id: r.id, title: r.title || '', reportType: r.reportType || '',
            status: r.status || 'draft',
            createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
          }))
          if (!cancelled) setApiReports(transformed)
        }
      } catch { /* fallback */ }
      try {
        const res = await fetch('/api/studies')
        if (res.ok && !cancelled) {
          const data = await res.json()
          const transformed: StudyData[] = (data.studies || []).map((s: any) => ({
            id: s.id, studyCode: s.studyCode || '', substanceName: s.substanceName || '',
            studyType: s.studyType || 'long_term', temperatureC: s.temperatureC || 25,
            humidityPercent: s.humidityPercent, durationMonths: s.durationMonths || 24,
            predictedShelfLifeMonths: s.predictedShelfLifeMonths, status: s.status || 'draft',
            ph: s.ph,
          }))
          if (!cancelled) setReportStudies(transformed)
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
                    className={`p-3 rounded-xl ${colorMap[rt.color]}`}
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

      {/* Recent Reports */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Recently generated compliance documents</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  apiReports.map((report, idx) => (
                    <TableRow key={report.id} className={idx % 2 === 1 ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {REPORT_TYPES.find(r => r.type === report.reportType)?.title?.split(' ')[0] || report.reportType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={reportStatusColors[report.status]}>
                          {report.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{report.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider delayDuration={200}>
                          <UiTooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Download className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download {report.reportType} report</TooltipContent>
                          </UiTooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Generate Report Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>Configure and generate a compliance report</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Report Type *</Label>
              <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((rt) => (
                    <SelectItem key={rt.type} value={rt.type}>{rt.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Associated Study</Label>
              <Select value={selectedStudyId} onValueChange={setSelectedStudyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a study (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {reportStudies.map((std) => (
                    <SelectItem key={std.id} value={std.id}>{std.studyCode} — {std.substanceName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Additional Notes</Label>
              <Textarea placeholder="Any additional context or requirements for this report..." />
            </div>
            {selectedReportType && (
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-emerald-500 text-sm">
                <p className="text-muted-foreground">Report title preview:</p>
                <p className="font-medium">
                  {REPORT_TYPES.find(r => r.type === selectedReportType)?.title || selectedReportType} Report — {new Date().toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleGenerateReport}
              disabled={!selectedReportType || generating}
            >
              {generating
                ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Generating...</>
                : <><FileText className="size-4 mr-2" /> Generate Report</>}
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
          const transformed: MoleculeData[] = (md.molecules || []).map((m: any) => ({
            id: m.id, name: m.name, casNumber: m.casNumber || '', smiles: m.smiles || '',
            formula: m.formula || '', molarMass: m.molarMass ?? 0, logP: m.logP ?? 0,
            stabilityScore: m.predictedStabilityScore ?? 0, riskLevel: m.riskLevel || 'low',
            dataSource: m.dataSource || 'Manual', description: m.description || '',
            meltingPoint: m.meltingPoint ?? null, boilingPoint: m.boilingPoint ?? null,
          }))
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
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* QSPR Model Performance */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="size-5 text-emerald-600 dark:text-emerald-400" />
            QSPR Model Performance
          </CardTitle>
          <CardDescription>Prediction accuracy metrics for active quantitative structure-property relationship models</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QSPR_MODEL_PERFORMANCE.map((model) => (
                <motion.div
                  key={model.model}
                  whileHover={{ y: -2 }}
                  className="p-4 rounded-xl border bg-card relative overflow-hidden"
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: model.fill }} />
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="size-4" style={{ color: model.fill }} />
                    <p className="font-semibold">{model.model}</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">R²</span>
                      <span className="font-bold" style={{ color: model.fill }}>{model.r2.toFixed(2)}</span>
                    </div>
                    <Progress value={model.r2 * 100} className="h-1.5" />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground">RMSE</span>
                      <span className="font-medium">{model.rmse.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">MAE</span>
                      <span className="font-medium">{model.mae.toFixed(2)}</span>
                    </div>
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
          <CardHeader>
            <CardTitle>Risk Level Distribution</CardTitle>
            <CardDescription>Molecule count by risk classification</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : riskPieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-20 text-center">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {riskPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle>Molecules by Data Source</CardTitle>
            <CardDescription>Origin of molecule records</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : sourceBarData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-20 text-center">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceBarData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="source" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {sourceBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stability Score Distribution + Study Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle>Stability Score Distribution</CardTitle>
            <CardDescription>Histogram of molecule predicted stability scores</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bins}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle>Study Status Distribution</CardTitle>
            <CardDescription>Current state of stability studies</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : statusDonutData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-20 text-center">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusDonutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label>
                    {statusDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Temperature vs Shelf Life Scatter */}
      <Card className="backdrop-blur-sm bg-card/80">
        <CardHeader>
          <CardTitle>Temperature vs. Predicted Shelf Life</CardTitle>
          <CardDescription>Relationship between study temperature and predicted shelf life (months)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : scatterData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-20 text-center">No shelf life data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" dataKey="x" name="Temperature" unit="°C" className="text-xs" />
                <YAxis type="number" dataKey="y" name="Shelf Life" unit=" mo" className="text-xs" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(val: any, name: any) => {
                    if (name === 'Shelf Life') return [`${val} months`, name]
                    if (name === 'Temperature') return [`${val}°C`, name]
                    return [val, name]
                  }}
                />
                <Scatter name="Studies" data={scatterData} fill="#14b8a6" />
              </ScatterChart>
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
                        <TableCell className="font-mono text-xs">{mol.formula}</TableCell>
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
                        <TableCell className="font-mono text-xs">{mol.formula}</TableCell>
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
    </motion.div>
  )
}

// ── Admin Page ────────────────────────────────────────────────────────────

function AdminPage() {
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [auditData, setAuditData] = useState<AuditEntry[]>([])
  const [statsInfo, setStatsInfo] = useState<{ totalMolecules: number; activeStudies: number; totalReports: number; auditCount: number }>({ totalMolecules: 10, activeStudies: 3, totalReports: 5, auditCount: 6 })

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) {
            setStatsInfo({
              totalMolecules: data.totalMolecules ?? 10,
              activeStudies: data.activeStudies ?? 3,
              totalReports: data.totalReports ?? 5,
              auditCount: data.recentActivity?.length ?? 6,
            })
            if (data.recentActivity?.length) {
              const transformed: AuditEntry[] = data.recentActivity.map((entry: any) => ({
                id: entry.id, action: entry.action, tableName: entry.tableName,
                recordId: entry.recordId, details: entry.details || '',
                userName: entry.user?.name || 'Unknown',
                createdAt: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '',
              }))
              setAuditData(transformed)
            }
          }
        }
      } catch { /* fallback to sample data */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  const startTraining = () => {
    setTrainingStatus('running')
    setTimeout(() => setTrainingStatus('done'), 3000)
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
          { label: 'Total Users', value: '5', icon: Users, color: 'emerald' },
          { label: 'Active Studies', value: String(statsInfo.activeStudies), icon: Microscope, color: 'teal' },
          { label: 'Reports Generated', value: String(statsInfo.totalReports), icon: FileText, color: 'cyan' },
          { label: 'Audit Events', value: String(statsInfo.auditCount), icon: ClipboardList, color: 'amber' },
        ].map((stat) => {
          const Icon = stat.icon
          const colorMap: Record<string, string> = {
            emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
            teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
            cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
            amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
          }
          return (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${colorMap[stat.color]}`}>
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* User Management + Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage platform users and roles</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_USERS.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{roleLabels[user.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.isActive
                          ? <CheckCircle2 className="size-4 text-emerald-500" />
                          : <XCircle className="size-4 text-red-500" />
                        }
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{user.lastLogin}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5" />
              Audit Trail
            </CardTitle>
            <CardDescription>Recent system audit events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditData.length > 0 ? auditData : SAMPLE_AUDIT).map((entry) => {
                    const actionColors: Record<string, string> = {
                      create: 'text-emerald-600 dark:text-emerald-400',
                      update: 'text-amber-600 dark:text-amber-400',
                      delete: 'text-red-600 dark:text-red-400',
                      approve: 'text-teal-600 dark:text-teal-400',
                      sign: 'text-cyan-600 dark:text-cyan-400',
                    }
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <span className={`font-medium ${actionColors[entry.action] || ''}`}>
                            {entry.action}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{entry.tableName}</TableCell>
                        <TableCell className="text-xs">{entry.userName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.createdAt}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ML Training + System Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ML Training */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-5 text-emerald-600 dark:text-emerald-400" />
              ML Training
            </CardTitle>
            <CardDescription>Train and manage QSPR prediction models</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">QSPR Stability Model</span>
                <Badge variant="outline" className="text-xs">
                  {trainingStatus === 'done' ? 'Trained' : trainingStatus === 'running' ? 'Training...' : 'Ready'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Accuracy:</span> <span className="font-medium">94.2%</span></div>
                <div><span className="text-muted-foreground">Dataset:</span> <span className="font-medium">2,847 compounds</span></div>
                <div><span className="text-muted-foreground">Features:</span> <span className="font-medium">128 descriptors</span></div>
                <div><span className="text-muted-foreground">Last trained:</span> <span className="font-medium">2024-03-10</span></div>
              </div>
              {trainingStatus === 'running' && (
                <Progress value={66} className="h-2" />
              )}
              {trainingStatus === 'done' && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" /> Training completed successfully
                </div>
              )}
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
        <Card>
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

  const actionIconMap: Record<string, React.ElementType> = {
    create: Plus, update: RefreshCw, delete: Trash2,
    approve: CheckCircle2, sign: Shield, reject: XCircle,
  }
  const actionColorMap: Record<string, string> = {
    create: 'text-emerald-600 dark:text-emerald-400',
    update: 'text-amber-600 dark:text-amber-400',
    delete: 'text-red-600 dark:text-red-400',
    approve: 'text-teal-600 dark:text-teal-400',
    sign: 'text-cyan-600 dark:text-cyan-400',
    reject: 'text-red-600 dark:text-red-400',
  }

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
              const Icon = actionIconMap[n.action] || Activity
              const color = actionColorMap[n.action] || 'text-emerald-600 dark:text-emerald-400'
              return (
                <div key={n.id} className="flex items-start gap-2 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                  <Icon className={`size-4 mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">
                      <span className="font-medium">{n.user?.name || 'System'}</span>{' '}
                      <span className="text-muted-foreground">{n.action}</span>{' '}
                      <span className="font-mono text-[10px]">{n.tableName} #{n.recordId}</span>
                    </p>
                    {n.details && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.details}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    </p>
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

// ── Main Layout ───────────────────────────────────────────────────────────

export default function Home() {
  const { darkMode } = useAppStore()

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

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
    </div>
  )
}
