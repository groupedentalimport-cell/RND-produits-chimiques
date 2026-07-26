'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle, MinusCircle,
  FileText, Shield, Award, ChevronRight, Sparkles, Download, Loader2, Info,
  FlaskConical, Microscope, BookOpen, Scale,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select'
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { useToast } from '@/hooks/use-toast'
import {
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_CATEGORY_COLORS,
  ICH_Q1A_RULES,
  type ComplianceStatus,
  type ComplianceCategory,
} from '@/lib/sample-data'

// ── Types (mirrors API response) ────────────────────────────────────────

interface ComplianceCheckResult {
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

interface CategoryScore {
  category: ComplianceCategory
  label: string
  score: number
  pass: number
  warning: number
  fail: number
  notApplicable: number
}

interface ComplianceReport {
  studyId: string
  studyCode: string
  substanceName: string
  studyType: string
  status: string
  checkedAt: string
  overallScore: number
  passCount: number
  warningCount: number
  failCount: number
  notApplicableCount: number
  totalWeight: number
  earnedWeight: number
  results: ComplianceCheckResult[]
  categoryScores: CategoryScore[]
  readyForSubmission: boolean
  blockingIssues: string[]
}

interface StudyOption {
  id: string
  studyCode: string
  substanceName: string
  studyType: string
  status: string
  temperatureC: number
  durationMonths: number
}

// ── Helpers ─────────────────────────────────────────────────────────────

const STATUS_META: Record<ComplianceStatus, {
  label: string
  icon: React.ElementType
  badgeClass: string
  textClass: string
  bgClass: string
  ringClass: string
}> = {
  pass: {
    label: 'Pass',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/60',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500',
    ringClass: 'stroke-emerald-500',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300/60 dark:border-amber-700/60',
    textClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500',
    ringClass: 'stroke-amber-500',
  },
  fail: {
    label: 'Fail',
    icon: XCircle,
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300/60 dark:border-red-700/60',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500',
    ringClass: 'stroke-red-500',
  },
  not_applicable: {
    label: 'N/A',
    icon: MinusCircle,
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-slate-300/60 dark:border-slate-700/60',
    textClass: 'text-slate-500 dark:text-slate-400',
    bgClass: 'bg-slate-400',
    ringClass: 'stroke-slate-400',
  },
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981' // emerald
  if (score >= 60) return '#f59e0b' // amber
  if (score >= 40) return '#f97316' // orange
  return '#ef4444' // red
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Compliant'
  if (score >= 60) return 'Needs Attention'
  if (score >= 40) return 'At Risk'
  return 'Non-Compliant'
}

const STUDY_TYPE_LABELS: Record<string, string> = {
  long_term: 'Long-Term',
  accelerated: 'Accelerated',
  intermediate: 'Intermediate',
  stress: 'Stress / Forced Degradation',
  photostability: 'Photostability',
}

// ── Circular Progress Ring ──────────────────────────────────────────────

function ScoreRing({ score, size = 200 }: { score: number; size?: number }) {
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)
  const label = getScoreLabel(score)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted/30"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="url(#scoreGradient)"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-5xl font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
        <Badge
          variant="outline"
          className="mt-1.5 text-[10px] font-semibold border-current"
          style={{ color }}
        >
          {label}
        </Badge>
      </div>
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={`gap-1 ${meta.badgeClass}`}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="relative mb-6">
        {/* Floating decorative circles */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-emerald-500/20"
            style={{
              width: 14 + i * 4,
              height: 14 + i * 4,
              top: `${[-10, 50, 5, 60, 30][i]}%`,
              left: `${[50, 10, 90, 20, 80][i]}%`,
            }}
            animate={{
              y: [0, -8, 0],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 3 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
          <ClipboardCheck className="size-10 text-white" />
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-2">ICH Q1A Compliance Checker</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Select a stability study and run an automated compliance check against
        ICH Q1A(R2), ICH Q1B, ICH Q9, and 21 CFR Part 11 requirements.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl w-full">
        {[
          { icon: FlaskConical, label: '16 rules', color: 'text-emerald-500' },
          { icon: BookOpen, label: 'ICH Q1A(R2)', color: 'text-teal-500' },
          { icon: Shield, label: '21 CFR Part 11', color: 'text-cyan-500' },
          { icon: Scale, label: 'ICH Q9 risk', color: 'text-emerald-500' },
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20"
            >
              <Icon className={`size-4 ${item.color}`} />
              <span className="text-[11px] font-medium text-center">{item.label}</span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Loading State ───────────────────────────────────────────────────────

function CheckingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="relative w-20 h-20 mb-4">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-emerald-500/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <ClipboardCheck className="size-8 text-emerald-500" />
        </div>
      </div>
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        Evaluating compliance rules…
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Cross-referencing study data against ICH Q1A(R2) guidelines
      </p>
    </motion.div>
  )
}

// ── Compliance Certificate (printable) ──────────────────────────────────

function ComplianceCertificate({ report }: { report: ComplianceReport }) {
  const scoreColor = getScoreColor(report.overallScore)
  const date = new Date(report.checkedAt)

  return (
    <Card className="overflow-hidden border-2 print:shadow-none" style={{ borderColor: scoreColor + '40' }}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}80)` }} />
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: scoreColor + '20' }}
            >
              <Award className="size-6" style={{ color: scoreColor }} />
            </div>
            <div>
              <h3 className="font-semibold text-base">Compliance Certificate</h3>
              <p className="text-xs text-muted-foreground">ICH Q1A(R2) · ICH Q1B · 21 CFR Part 11</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Certificate ID</p>
            <p className="font-mono text-xs font-semibold">
              CCR-{report.studyId.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Study Code</p>
            <p className="font-medium">{report.studyCode}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Substance</p>
            <p className="font-medium">{report.substanceName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Study Type</p>
            <p className="font-medium">{STUDY_TYPE_LABELS[report.studyType] || report.studyType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Checked At</p>
            <p className="font-medium">{date.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg" style={{ background: scoreColor + '10' }}>
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums" style={{ color: scoreColor }}>
              {report.overallScore}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Score / 100</p>
          </div>
          <div className="flex-1 grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{report.passCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pass</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{report.warningCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Warning</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{report.failCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fail</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-500 dark:text-slate-400">{report.notApplicableCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">N/A</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {report.readyForSubmission ? (
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white gap-1">
              <CheckCircle2 className="size-3" /> Ready for regulatory submission
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="size-3" /> Not ready for submission
            </Badge>
          )}
        </div>

        {report.blockingIssues.length > 0 && (
          <div className="text-xs space-y-1">
            <p className="font-semibold text-red-600 dark:text-red-400">Blocking Issues:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              {report.blockingIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page Component ─────────────────────────────────────────────────

export function CompliancePage() {
  const { toast } = useToast()
  const [studies, setStudies] = useState<StudyOption[]>([])
  const [selectedStudyId, setSelectedStudyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [report, setReport] = useState<ComplianceReport | null>(null)

  // Load studies on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/studies?limit=1000')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            const opts: StudyOption[] = (data.studies || []).map((s: any) => ({
              id: s.id,
              studyCode: s.studyCode,
              substanceName: s.substanceName,
              studyType: s.studyType,
              status: s.status,
              temperatureC: s.temperatureC,
              durationMonths: s.durationMonths,
            }))
            setStudies(opts)
            // Auto-select the first non-draft study
            const firstActive = opts.find((s) => s.status !== 'draft') || opts[0]
            if (firstActive) setSelectedStudyId(firstActive.id)
          }
        }
      } catch {
        // ignore
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const selectedStudy = useMemo(
    () => studies.find((s) => s.id === selectedStudyId),
    [studies, selectedStudyId],
  )

  const runCheck = async () => {
    if (!selectedStudyId) {
      toast({ title: 'Select a study', description: 'Please pick a study to check.', variant: 'destructive' })
      return
    }
    setChecking(true)
    setReport(null)
    try {
      const res = await fetch('/api/compliance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId: selectedStudyId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data: ComplianceReport = await res.json()
      setReport(data)
      toast({
        title: `Compliance check complete`,
        description: `Overall score: ${data.overallScore}/100 — ${getScoreLabel(data.overallScore)}`,
      })
    } catch (err: any) {
      toast({
        title: 'Compliance check failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setChecking(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Group results by category for the detailed view
  const groupedResults = useMemo(() => {
    if (!report) return []
    const groups: { category: ComplianceCategory; label: string; results: ComplianceCheckResult[] }[] = []
    for (const cat of Object.keys(COMPLIANCE_CATEGORY_LABELS) as ComplianceCategory[]) {
      const items = report.results.filter((r) => r.category === cat)
      if (items.length > 0) {
        groups.push({
          category: cat,
          label: COMPLIANCE_CATEGORY_LABELS[cat],
          results: items,
        })
      }
    }
    return groups
  }, [report])

  return (
    <div className="space-y-6 fade-in-up">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Shield className="size-3.5 text-emerald-500" />
            <span className="uppercase tracking-wider">Regulatory Compliance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
            ICH Q1A Compliance Checker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated evaluation of stability studies against ICH Q1A(R2), Q1B, Q9, and 21 CFR Part 11 requirements.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={!report}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print / Save as PDF</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Study selector + Run button card */}
      <Card className="border-emerald-500/20 print:hidden overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Microscope className="size-4 text-emerald-500" />
            Select Stability Study
          </CardTitle>
          <CardDescription>
            Choose a study to evaluate against the 16-rule ICH Q1A(R2) compliance framework.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Study</label>
              <Select value={selectedStudyId} onValueChange={setSelectedStudyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a study…" />
                </SelectTrigger>
                <SelectContent>
                  {studies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono text-xs mr-2">{s.studyCode}</span>
                      <span className="font-medium">{s.substanceName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        · {STUDY_TYPE_LABELS[s.studyType] || s.studyType} · {s.temperatureC}°C · {s.durationMonths}mo
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={runCheck}
              disabled={checking || !selectedStudyId}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20"
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {checking ? 'Checking…' : 'Run Compliance Check'}
            </Button>
          </div>

          {/* Selected study quick info */}
          {selectedStudy && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
            >
              <div>
                <p className="text-muted-foreground">Study Code</p>
                <p className="font-mono font-semibold">{selectedStudy.studyCode}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">{STUDY_TYPE_LABELS[selectedStudy.studyType] || selectedStudy.studyType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Temperature</p>
                <p className="font-medium tabular-nums">{selectedStudy.temperatureC}°C</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium tabular-nums">{selectedStudy.durationMonths} months</p>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Main content area */}
      {checking ? (
        <CheckingState />
      ) : !report ? (
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <EmptyState />
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Top row: Score ring + certificate */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score ring */}
            <Card className="border-emerald-500/20 print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Award className="size-4 text-emerald-500" />
                  Overall Compliance Score
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pt-2">
                <ScoreRing score={report.overallScore} />
                <p className="text-xs text-muted-foreground text-center mt-3 max-w-xs">
                  Weighted score across {report.results.length} rules ({report.passCount + report.warningCount + report.failCount} applicable, {report.notApplicableCount} not applicable).
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {report.readyForSubmission ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white gap-1">
                      <CheckCircle2 className="size-3" /> Ready for submission
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="size-3" /> Not ready for submission
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Certificate */}
            <div className="lg:col-span-2">
              <ComplianceCertificate report={report} />
            </div>
          </div>

          {/* Category breakdown */}
          <Card className="print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="size-4 text-emerald-500" />
                Category Breakdown
              </CardTitle>
              <CardDescription>
                Compliance score by regulatory category. Hover for details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.categoryScores.map((cat, i) => {
                  const color = getScoreColor(cat.score)
                  return (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 rounded-lg border border-border/60 hover:border-emerald-500/40 hover:shadow-md hover:shadow-emerald-500/5 transition-all hover-lift"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold">{cat.label}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{cat.category}</p>
                        </div>
                        <span className="text-lg font-bold tabular-nums" style={{ color }}>
                          {cat.score}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.score}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="size-2.5 text-emerald-500" /> {cat.pass}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <AlertTriangle className="size-2.5 text-amber-500" /> {cat.warning}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <XCircle className="size-2.5 text-red-500" /> {cat.fail}
                        </span>
                        {cat.notApplicable > 0 && (
                          <span className="flex items-center gap-0.5">
                            <MinusCircle className="size-2.5 text-slate-400" /> {cat.notApplicable}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detailed rule results */}
          <Card className="print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-emerald-500" />
                Detailed Rule Results
              </CardTitle>
              <CardDescription>
                {report.results.length} rules evaluated across {report.categoryScores.length} categories. Click to expand evidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {groupedResults.map((group) => (
                  <AccordionItem key={group.category} value={group.category} className="border-border/60">
                    <AccordionTrigger className="hover:no-underline hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 px-3 rounded-md">
                      <div className="flex items-center gap-3 flex-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: COMPLIANCE_CATEGORY_COLORS[group.category] }}
                        />
                        <span className="font-medium text-sm">{group.label}</span>
                        <span className="text-xs text-muted-foreground">
                          ({group.results.filter(r => r.status === 'pass').length}/{group.results.filter(r => r.status !== 'not_applicable').length} pass)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-2">
                      {group.results.map((r) => {
                        const meta = STATUS_META[r.status]
                        const Icon = meta.icon
                        return (
                          <motion.div
                            key={r.ruleId}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors slide-in-left"
                          >
                            <div className="flex items-start gap-3">
                              <Icon className={`size-4 mt-0.5 shrink-0 ${meta.textClass}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div>
                                    <p className="text-sm font-medium">
                                      <span className="font-mono text-xs text-muted-foreground mr-1.5">{r.ruleId}</span>
                                      {r.ruleTitle}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {r.guideline} · weight {r.weight}
                                    </p>
                                  </div>
                                  <StatusBadge status={r.status} />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1.5">{r.evidence}</p>
                                {r.recommendation && (
                                  <div className="mt-2 flex items-start gap-1.5 p-2 rounded bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/20">
                                    <Info className="size-3 text-amber-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                      <span className="font-semibold">Recommendation:</span> {r.recommendation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading skeleton on initial mount */}
      {loading && !report && !checking && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </div>
  )
}
