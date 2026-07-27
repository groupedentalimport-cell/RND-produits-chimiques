'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitCompareArrows, Plus, X, Search, AlertOctagon, AlertTriangle, ShieldAlert,
  Info, CheckCircle2, Loader2, BookOpen, FlaskConical, Activity, ChevronRight,
  Pill, Zap, Clock, FileWarning, Beaker, ArrowRight, RefreshCw,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────

type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor' | 'none'

interface DrugInteraction {
  id: string
  substanceA: string
  substanceB: string
  severity: InteractionSeverity
  mechanism: string
  clinicalEffect: string
  onset: 'rapid' | 'delayed' | 'not_specified'
  management: string
  evidenceLevel: 'established' | 'probable' | 'suspected' | 'theoretical'
  literatureRef?: string
}

// ── Severity styling ─────────────────────────────────────────────────────

const SEVERITY_META: Record<InteractionSeverity, {
  label: string
  icon: React.ElementType
  badgeClass: string
  textClass: string
  bgClass: string
  borderClass: string
  gradientClass: string
  dotColor: string
}> = {
  contraindicated: {
    label: 'Contraindicated',
    icon: AlertOctagon,
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300/60 dark:border-red-700/60',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500',
    borderClass: 'border-red-500/40',
    gradientClass: 'from-red-500 to-rose-600',
    dotColor: 'bg-red-500',
  },
  major: {
    label: 'Major',
    icon: AlertTriangle,
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300/60 dark:border-amber-700/60',
    textClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-500/40',
    gradientClass: 'from-amber-500 to-orange-600',
    dotColor: 'bg-amber-500',
  },
  moderate: {
    label: 'Moderate',
    icon: ShieldAlert,
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300/60 dark:border-teal-700/60',
    textClass: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-teal-500',
    borderClass: 'border-teal-500/40',
    gradientClass: 'from-teal-500 to-cyan-600',
    dotColor: 'bg-teal-500',
  },
  minor: {
    label: 'Minor',
    icon: Info,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/60',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500',
    borderClass: 'border-emerald-500/40',
    gradientClass: 'from-emerald-500 to-teal-600',
    dotColor: 'bg-emerald-500',
  },
  none: {
    label: 'No Interaction',
    icon: CheckCircle2,
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-slate-300/60 dark:border-slate-700/60',
    textClass: 'text-slate-500 dark:text-slate-400',
    bgClass: 'bg-slate-400',
    borderClass: 'border-slate-400/40',
    gradientClass: 'from-slate-400 to-slate-500',
    dotColor: 'bg-slate-400',
  },
}

const EVIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  established: { label: 'Established', color: 'text-emerald-600 dark:text-emerald-400' },
  probable: { label: 'Probable', color: 'text-teal-600 dark:text-teal-400' },
  suspected: { label: 'Suspected', color: 'text-amber-600 dark:text-amber-400' },
  theoretical: { label: 'Theoretical', color: 'text-slate-500 dark:text-slate-400' },
}

const ONSET_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  rapid: { label: 'Rapid onset', icon: Zap },
  delayed: { label: 'Delayed onset', icon: Clock },
  not_specified: { label: 'Onset not specified', icon: Activity },
}

// ── Empty State ──────────────────────────────────────────────────────────

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
            animate={{ y: [0, -8, 0], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
          <GitCompareArrows className="size-10 text-white" />
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-2">Drug Interaction Checker</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Add two or more substances to check for known drug-drug and drug-chemical
        interactions, including formulation incompatibilities and stability concerns.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl w-full">
        {[
          { icon: FlaskConical, label: 'Chemical compat', color: 'text-emerald-500' },
          { icon: Pill, label: 'Drug-drug', color: 'text-teal-500' },
          { icon: BookOpen, label: 'Evidence-based', color: 'text-cyan-500' },
          { icon: ShieldAlert, label: 'Severity tiers', color: 'text-amber-500' },
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

// ── Checking State ───────────────────────────────────────────────────────

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
          <GitCompareArrows className="size-8 text-emerald-500" />
        </div>
      </div>
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        Checking interactions…
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Cross-referencing against the interaction knowledge base
      </p>
    </motion.div>
  )
}

// ── Interaction Card ─────────────────────────────────────────────────────

function InteractionCard({ interaction, index }: { interaction: DrugInteraction; index: number }) {
  const meta = SEVERITY_META[interaction.severity]
  const SeverityIcon = meta.icon
  const OnsetIcon = ONSET_LABELS[interaction.onset].icon
  const evidence = EVIDENCE_LABELS[interaction.evidenceLevel]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      <Card className={`overflow-hidden border-l-4 ${meta.borderClass} hover:shadow-md transition-all hover-lift`}>
        <div className={`h-1 bg-gradient-to-r ${meta.gradientClass}`} />
        <CardContent className="p-5 space-y-4">
          {/* Header: substance pair + severity */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20">
                <FlaskConical className="size-3.5 text-emerald-500" />
                <span className="font-medium text-sm">{interaction.substanceA}</span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground rotate-90 sm:rotate-0" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-500/20">
                <FlaskConical className="size-3.5 text-teal-500" />
                <span className="font-medium text-sm">{interaction.substanceB}</span>
              </div>
            </div>
            <Badge variant="outline" className={`gap-1.5 shrink-0 ${meta.badgeClass}`}>
              <SeverityIcon className="size-3.5" />
              {meta.label}
            </Badge>
          </div>

          {/* Mechanism */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3" />
              Mechanism
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{interaction.mechanism}</p>
          </div>

          {/* Clinical Effect */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileWarning className="size-3" />
              Clinical Effect
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{interaction.clinicalEffect}</p>
          </div>

          {/* Management */}
          <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/20 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="size-3" />
              Management
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">{interaction.management}</p>
          </div>

          {/* Footer: metadata */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <OnsetIcon className="size-3" />
              <span>{ONSET_LABELS[interaction.onset].label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Evidence:</span>
              <span className={`font-medium ${evidence.color}`}>{evidence.label}</span>
            </div>
            {interaction.literatureRef && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                      <BookOpen className="size-3" />
                      <span className="truncate max-w-[180px]">{interaction.literatureRef}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">Literature reference: {interaction.literatureRef}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Summary Stats Bar ────────────────────────────────────────────────────

function SummaryBar({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  const items = [
    { key: 'contraindicated', label: 'Contraindicated', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
    { key: 'major', label: 'Major', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
    { key: 'moderate', label: 'Moderate', color: 'bg-teal-500', textColor: 'text-teal-600 dark:text-teal-400' },
    { key: 'minor', label: 'Minor', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
  ]

  return (
    <Card className="overflow-hidden border-emerald-500/20">
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              Interaction Summary
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total} interaction{total !== 1 ? 's' : ''} found across selected substances
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((item) => {
            const count = breakdown[item.key] || 0
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`size-2 rounded-full ${item.color}`} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${item.textColor}`}>{count}</p>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page Component ──────────────────────────────────────────────────

export function InteractionsPage() {
  const { toast } = useToast()
  const [substances, setSubstances] = useState<string[]>([''])
  const [availableSubstances, setAvailableSubstances] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [interactions, setInteractions] = useState<DrugInteraction[]>([])
  const [severityBreakdown, setSeverityBreakdown] = useState<Record<string, number>>({})
  const [hasChecked, setHasChecked] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load available substances on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/drug-interactions')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setAvailableSubstances(data.substances || [])
        }
      } catch {
        // ignore
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Auto-check interactions whenever substances change (debounced)
  useEffect(() => {
    const validSubstances = substances.map((s) => s.trim()).filter(Boolean)
    if (validSubstances.length < 2) {
      setInteractions([])
      setSeverityBreakdown({})
      setHasChecked(false)
      return
    }
    setChecking(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/drug-interactions?substances=${encodeURIComponent(validSubstances.join(','))}`)
        if (res.ok) {
          const data = await res.json()
          setInteractions(data.interactions || [])
          setSeverityBreakdown(data.severityBreakdown || {})
          setHasChecked(true)
        }
      } catch {
        // ignore
      } finally {
        setChecking(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [substances])

  const addSubstance = () => {
    if (substances.length >= 6) {
      toast({ title: 'Maximum 6 substances', description: 'For clarity, limit checks to 6 substances at a time.', variant: 'destructive' })
      return
    }
    setSubstances([...substances, ''])
  }

  const removeSubstance = (index: number) => {
    if (substances.length === 1) {
      setSubstances([''])
    } else {
      setSubstances(substances.filter((_, i) => i !== index))
    }
  }

  const updateSubstance = (index: number, value: string) => {
    setSubstances(substances.map((s, i) => (i === index ? value : s)))
  }

  const clearAll = () => {
    setSubstances([''])
    setInteractions([])
    setSeverityBreakdown({})
    setHasChecked(false)
  }

  const validSubstanceCount = substances.filter((s) => s.trim()).length
  const canCheck = validSubstanceCount >= 2

  return (
    <div className="space-y-6 fade-in-up">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <GitCompareArrows className="size-3.5 text-emerald-500" />
            <span className="uppercase tracking-wider">Drug & Chemical Compatibility</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
            Drug Interaction Checker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Check drug-drug and drug-chemical interactions, including formulation incompatibilities and stability concerns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCatalogOpen(!catalogOpen)}
            className="gap-2"
          >
            <BookOpen className="size-4" />
            <span className="hidden sm:inline">{catalogOpen ? 'Hide' : 'Show'} Catalog</span>
            <span className="sm:hidden">Catalog</span>
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="gap-2">
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      {/* Substance input card */}
      <Card className="border-emerald-500/20 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pill className="size-4 text-emerald-500" />
            Select Substances
          </CardTitle>
          <CardDescription>
            Add 2–6 substances to check for known interactions. Checks run automatically as you type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Substance input rows */}
          <div className="space-y-2">
            <AnimatePresence>
              {substances.map((sub, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <Input
                    value={sub}
                    onChange={(e) => updateSubstance(idx, e.target.value)}
                    placeholder={`Substance ${idx + 1} (e.g., Aspirin, Ibuprofen, Caffeine...)`}
                    className="flex-1"
                    list="known-substances"
                  />
                  <datalist id="known-substances">
                    {availableSubstances.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubstance(idx)}
                    className="shrink-0 text-muted-foreground hover:text-red-500"
                  >
                    <X className="size-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add substance button + status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={addSubstance}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Add Substance
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {checking ? (
                <>
                  <Loader2 className="size-3 animate-spin text-emerald-500" />
                  <span>Checking interactions…</span>
                </>
              ) : validSubstanceCount < 2 ? (
                <>
                  <Info className="size-3" />
                  <span>Add at least 2 substances to check ({validSubstanceCount}/2)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  <span>{validSubstanceCount} substances selected · auto-checking</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optional: Knowledge base catalog */}
      <AnimatePresence>
        {catalogOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-teal-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="size-4 text-teal-500" />
                  Known Substances in Database
                </CardTitle>
                <CardDescription>
                  Click a substance to add it to the checker above. The catalog contains {availableSubstances.length} substances.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {availableSubstances.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => {
                        // Add to first empty slot, or append
                        const firstEmpty = substances.findIndex((s) => !s.trim())
                        if (firstEmpty >= 0) {
                          updateSubstance(firstEmpty, sub)
                        } else if (substances.length < 6) {
                          setSubstances([...substances, sub])
                        } else {
                          toast({ title: 'Maximum 6 substances', description: 'Remove one before adding more.', variant: 'destructive' })
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors hover:border-emerald-500/40 hover:scale-105"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      {checking && !hasChecked ? (
        <CheckingState />
      ) : !canCheck ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState />
          </CardContent>
        </Card>
      ) : interactions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
            <CardContent className="pt-6 pb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-4">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Interactions Found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                No known interactions between the selected substances in our database.
                This does not guarantee safety — always consult a pharmacist or the latest literature.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                {substances.filter((s) => s.trim()).map((s, i) => (
                  <Badge key={i} variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                    <FlaskConical className="size-3" />
                    {s.trim()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Summary bar */}
          <SummaryBar breakdown={severityBreakdown} total={interactions.length} />

          {/* Interaction cards */}
          <div className="space-y-4">
            {interactions
              .sort((a, b) => {
                const order: Record<string, number> = { contraindicated: 0, major: 1, moderate: 2, minor: 3, none: 4 }
                return (order[a.severity] ?? 5) - (order[b.severity] ?? 5)
              })
              .map((interaction, i) => (
                <InteractionCard key={interaction.id} interaction={interaction} index={i} />
              ))}
          </div>

          {/* Disclaimer */}
          <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
            <CardContent className="pt-5 pb-5 flex items-start gap-3">
              <Info className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Disclaimer</p>
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  This interaction checker is for research and educational purposes only.
                  Always verify against the latest FDA labeling, peer-reviewed literature, and clinical guidelines.
                  The database is curated and may not include all known interactions.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {loading && !hasChecked && !checking && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </div>
  )
}
