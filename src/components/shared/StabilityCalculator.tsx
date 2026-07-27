'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Calculator,
  ChevronDown,
  Clock,
  FlaskConical,
  Gauge,
  Save,
  Sigma,
  Thermometer,
  TimerReset,
  TrendingDown,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────

type KineticOrder = 0 | 1 | 2

interface StabilityResult {
  rateConstantAtTarget: number
  degradationPercent: number
  remainingPotencyPercent: number
  shelfLifeMonths: number
  kineticOrder: KineticOrder
  activationEnergy: number
  rateConstant25C: number
  temperatureC: number
  temperatureK: number
  q10: number
  arrheniusFactor: number
  curve: { month: number; degradation: number; potency: number }[]
}

// ── Constants ──────────────────────────────────────────────────────────

// Log slider: 0 → 0.001, 1000 → 0.1
const RATE_SLIDER_MIN = 0
const RATE_SLIDER_MAX = 1000
const rateToSlider = (k: number): number =>
  Math.max(RATE_SLIDER_MIN, Math.min(RATE_SLIDER_MAX,
    Math.round(((Math.log10(k) + 3) / 2) * 1000)
  ))
const sliderToRate = (s: number): number =>
  Math.pow(10, -3 + (s / 1000) * 2)

const KINETIC_LABELS: Record<KineticOrder, string> = {
  0: 'Zero-order',
  1: 'First-order',
  2: 'Second-order',
}

const KINETIC_FORMULAS: Record<KineticOrder, string> = {
  0: 'D = k · t',
  1: 'D = 1 − e^(−k · t)',
  2: 'D = (k · t) / (1 + k · t)',
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatNumber(n: number, digits = 4): string {
  if (!isFinite(n)) return '∞'
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1000) return n.toFixed(0)
  if (abs >= 1) return n.toFixed(2)
  if (abs >= 0.01) return n.toFixed(digits)
  // very small — use exponential
  return n.toExponential(2)
}

function formatShelfLife(months: number): string {
  if (!isFinite(months) || months < 0) return '∞ (stable)'
  if (months >= 24) {
    const years = months / 12
    return `${years.toFixed(1)} yr (${months.toFixed(0)} mo)`
  }
  return `${months.toFixed(1)} mo`
}

function getDegradationColor(d: number): string {
  if (d < 5) return '#10b981' // emerald-500
  if (d < 10) return '#14b8a6' // teal-500
  if (d < 20) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

function getPotencyColor(p: number): string {
  if (p >= 95) return '#10b981'
  if (p >= 90) return '#14b8a6'
  if (p >= 80) return '#f59e0b'
  return '#ef4444'
}

// ── Sub-components ─────────────────────────────────────────────────────

function CircularGauge({
  value,
  label,
  unit = '%',
  color,
}: {
  value: number
  label: string
  unit?: string
  color: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted/30"
          />
          <motion.circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>
            {clamped.toFixed(1)}
          </span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  )
}

function SliderRow({
  icon: Icon,
  label,
  unit,
  value,
  display,
  min,
  max,
  step,
  onChange,
  accent = 'emerald',
}: {
  icon: React.ElementType
  label: string
  unit: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  accent?: 'emerald' | 'teal' | 'amber'
}) {
  const accentColor =
    accent === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'teal'
      ? 'text-teal-600 dark:text-teal-400'
      : 'text-amber-600 dark:text-amber-400'
  const rangeColor =
    accent === 'emerald'
      ? '[&>[data-slot=slider-range]]:bg-emerald-500 [&>[data-slot=slider-thumb]]:border-emerald-500'
      : accent === 'teal'
      ? '[&>[data-slot=slider-range]]:bg-teal-500 [&>[data-slot=slider-thumb]]:border-teal-500'
      : '[&>[data-slot=slider-range]]:bg-amber-500 [&>[data-slot=slider-thumb]]:border-amber-500'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Icon className={`size-4 ${accentColor}`} />
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value}
            step={step}
            min={min}
            max={max}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!Number.isNaN(v)) onChange(v)
            }}
            className="w-24 h-8 text-right text-sm tabular-nums"
          />
          <span className="text-xs text-muted-foreground w-12">{unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(arr) => onChange(arr[0])}
          className={`flex-1 ${rangeColor}`}
        />
        <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
          {display}
        </span>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function StabilityCalculator() {
  const { toast } = useToast()
  const setPage = useAppStore((s) => s.setPage)

  const [activationEnergy, setActivationEnergy] = useState(100)
  const [rateConstant25C, setRateConstant25C] = useState(0.01)
  const [rateSlider, setRateSlider] = useState(rateToSlider(0.01))
  const [temperatureC, setTemperatureC] = useState(25)
  const [durationMonths, setDurationMonths] = useState(12)
  const [kineticOrder, setKineticOrder] = useState<KineticOrder>(1)

  const [result, setResult] = useState<StabilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep slider and number input in sync
  const onRateSliderChange = useCallback((s: number) => {
    setRateSlider(s)
    setRateConstant25C(sliderToRate(s))
  }, [])
  const onRateNumberChange = useCallback((k: number) => {
    setRateConstant25C(k)
    setRateSlider(rateToSlider(k))
  }, [])

  const compute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stability-calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activationEnergy,
          rateConstant25C,
          temperatureC,
          durationMonths,
          kineticOrder,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          data?.details?.join('; ') ||
          data?.error ||
          'Calculation failed'
        setError(msg)
        setResult(null)
      } else {
        setResult(data.result as StabilityResult)
      }
    } catch {
      setError('Network error — could not reach the stability-calculator service')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [activationEnergy, rateConstant25C, temperatureC, durationMonths, kineticOrder])

  // Auto-compute on parameter change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      void compute()
    }, 250)
    return () => clearTimeout(t)
  }, [compute])

  const handleSave = useCallback(() => {
    if (!result) return
    toast({
      title: 'Study draft saved',
      description: `Predicted shelf life: ${formatShelfLife(result.shelfLifeMonths)} at ${temperatureC}°C (${KINETIC_LABELS[kineticOrder]}). Navigating to Studies…`,
    })
    setPage('studies')
  }, [result, temperatureC, kineticOrder, toast, setPage])

  const degradationColor = result
    ? getDegradationColor(result.degradationPercent)
    : '#10b981'
  const potencyColor = result
    ? getPotencyColor(result.remainingPotencyPercent)
    : '#10b981'

  const chartData = useMemo(() => {
    if (!result) return []
    return result.curve
  }, [result])

  return (
    <Card className="overflow-hidden border-emerald-500/20 dark:border-emerald-500/10">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-5 text-emerald-600 dark:text-emerald-400" />
          Arrhenius Stability Prediction
        </CardTitle>
        <CardDescription>
          Predict shelf life and degradation kinetics using the Arrhenius equation
        </CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
        {/* ── Input Panel ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <SliderRow
            icon={Sigma}
            label="Activation Energy (Eₐ)"
            unit="kJ/mol"
            value={activationEnergy}
            display={activationEnergy.toFixed(0)}
            min={50}
            max={150}
            step={1}
            onChange={setActivationEnergy}
            accent="emerald"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Activity className="size-4 text-teal-600 dark:text-teal-400" />
                Rate Constant at 25°C (k₂₅)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={rateConstant25C}
                  step={0.001}
                  min={0.001}
                  max={0.1}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!Number.isNaN(v)) onRateNumberChange(v)
                  }}
                  className="w-28 h-8 text-right text-sm tabular-nums"
                />
                <span className="text-xs text-muted-foreground w-16">1/months</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[rateSlider]}
                min={RATE_SLIDER_MIN}
                max={RATE_SLIDER_MAX}
                step={1}
                onValueChange={(arr) => onRateSliderChange(arr[0])}
                className="flex-1 [&>[data-slot=slider-range]]:bg-teal-500 [&>[data-slot=slider-thumb]]:border-teal-500"
              />
              <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                {formatNumber(rateConstant25C, 4)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Logarithmic scale · 0.001 (very stable) → 0.1 (rapid degradation)
            </p>
          </div>

          <SliderRow
            icon={Thermometer}
            label="Storage Temperature"
            unit="°C"
            value={temperatureC}
            display={`${temperatureC.toFixed(0)}°C`}
            min={4}
            max={60}
            step={1}
            onChange={setTemperatureC}
            accent="amber"
          />

          <SliderRow
            icon={TimerReset}
            label="Duration"
            unit="months"
            value={durationMonths}
            display={`${durationMonths} mo`}
            min={1}
            max={36}
            step={1}
            onChange={setDurationMonths}
            accent="emerald"
          />

          {/* Kinetic Order Selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="size-4 text-teal-600 dark:text-teal-400" />
              Reaction Kinetic Order
            </Label>
            <ToggleGroup
              type="single"
              value={String(kineticOrder)}
              onValueChange={(v) => {
                if (v) setKineticOrder(Number(v) as KineticOrder)
              }}
              className="grid grid-cols-3 w-full"
            >
              <ToggleGroupItem
                value="0"
                className="data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:border-emerald-500"
              >
                Zero-order
              </ToggleGroupItem>
              <ToggleGroupItem
                value="1"
                className="data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:border-emerald-500"
              >
                First-order
              </ToggleGroupItem>
              <ToggleGroupItem
                value="2"
                className="data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:border-emerald-500"
              >
                Second-order
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-[10px] text-muted-foreground">
              {KINETIC_LABELS[kineticOrder]} kinetics · {KINETIC_FORMULAS[kineticOrder]}
            </p>
          </div>

          {/* Formula Reference */}
          <Accordion type="single" collapsible className="rounded-lg border bg-muted/30">
            <AccordionItem value="formula" className="border-b-0">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Sigma className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Formula Reference
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      Arrhenius Equation
                    </p>
                    <p className="font-mono text-foreground/80 bg-background/60 p-2 rounded border">
                      k₂ = k₁ · exp((Eₐ/R) · (1/T₁ − 1/T₂))
                    </p>
                    <ul className="mt-2 space-y-0.5 text-muted-foreground">
                      <li>· R = 8.314 J·mol⁻¹·K⁻¹ (gas constant)</li>
                      <li>· T₁ = 298.15 K (25°C reference temperature)</li>
                      <li>· T₂ = T(°C) + 273.15 (target temperature, K)</li>
                      <li>· Eₐ is converted from kJ/mol to J/mol internally</li>
                    </ul>
                  </div>
                  <Separator />
                  <div>
                    <p className="font-semibold text-teal-700 dark:text-teal-400 mb-1">
                      Degradation Kinetics
                    </p>
                    <ul className="space-y-1 text-muted-foreground font-mono">
                      <li>· Zero-order:   D = k · t</li>
                      <li>· First-order:  D = 1 − exp(−k · t)</li>
                      <li>· Second-order: D = (k · t) / (1 + k · t)</li>
                    </ul>
                  </div>
                  <Separator />
                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      Shelf Life Definition
                    </p>
                    <p className="text-muted-foreground">
                      Time required for the active pharmaceutical ingredient to
                      degrade by 10% (i.e., remaining potency = 90%), per ICH Q1A
                      guidance for stability testing.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* ── Results Panel ──────────────────────────────────────── */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                Calculation error
              </p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          )}

          {/* Shelf Life — most prominent */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 dark:from-emerald-950/40 dark:to-teal-950/20 p-5 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
              <Clock className="size-3.5" />
              PREDICTED SHELF LIFE
            </div>
            <div className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              {loading && !result
                ? '…'
                : result
                ? formatShelfLife(result.shelfLifeMonths)
                : '—'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Time to 10% degradation at {temperatureC.toFixed(0)}°C
            </p>
          </motion.div>

          {/* Potency + Degradation */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-emerald-500/20">
              <CardContent className="flex flex-col items-center pt-5">
                <CircularGauge
                  value={result?.remainingPotencyPercent ?? 100}
                  label="Remaining Potency"
                  color={potencyColor}
                />
              </CardContent>
            </Card>
            <Card className="border-teal-500/20">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-teal-700 dark:text-teal-400">
                  <TrendingDown className="size-3.5" />
                  DEGRADATION
                </div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: degradationColor }}>
                  {result ? `${result.degradationPercent.toFixed(2)}%` : '—'}
                </div>
                <Progress
                  value={result?.degradationPercent ?? 0}
                  className="h-2.5"
                />
                <p className="text-[10px] text-muted-foreground">
                  After {durationMonths} month{durationMonths > 1 ? 's' : ''} at{' '}
                  {temperatureC.toFixed(0)}°C
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                  <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">&lt; 5%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-teal-500" />
                    <span className="text-muted-foreground">5–10%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span className="text-muted-foreground">10–20%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">&gt; 20%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kinetic parameters summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <Gauge className="size-4 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="text-[10px] text-muted-foreground mt-1">k at {temperatureC.toFixed(0)}°C</p>
              <p className="text-sm font-bold tabular-nums">
                {result ? formatNumber(result.rateConstantAtTarget, 6) : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground">1/months</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <Activity className="size-4 mx-auto text-teal-600 dark:text-teal-400" />
              <p className="text-[10px] text-muted-foreground mt-1">Arrhenius Factor</p>
              <p className="text-sm font-bold tabular-nums">
                {result ? `${result.arrheniusFactor.toFixed(3)}×` : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground">k₂ / k₁</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <Thermometer className="size-4 mx-auto text-amber-600 dark:text-amber-400" />
              <p className="text-[10px] text-muted-foreground mt-1">Q₁₀</p>
              <p className="text-sm font-bold tabular-nums">
                {result ? result.q10.toFixed(3) : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground">temp. coeff.</p>
            </div>
          </div>

          {/* Degradation Curve Chart */}
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingDown className="size-4 text-emerald-600 dark:text-emerald-400" />
                Degradation Profile
              </CardTitle>
              <CardDescription className="text-xs">
                Projected degradation & potency over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.3} />
                  <XAxis
                    dataKey="month"
                    className="text-[10px]"
                    label={{ value: 'Months', position: 'insideBottom', offset: -2, fontSize: 10 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    className="text-[10px]"
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 11,
                    }}
                    formatter={(v: number) => `${v.toFixed(2)}%`}
                    labelFormatter={(l) => `${l} mo`}
                  />
                  <ReferenceLine
                    y={10}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Shelf life (10%)',
                      fontSize: 9,
                      fill: '#ef4444',
                      position: 'insideTopRight',
                    }}
                  />
                  <ReferenceLine
                    x={durationMonths}
                    stroke="#14b8a6"
                    strokeDasharray="2 2"
                    label={{
                      value: 'Target',
                      fontSize: 9,
                      fill: '#14b8a6',
                      position: 'top',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="degradation"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Degradation"
                  />
                  <Line
                    type="monotone"
                    dataKey="potency"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Potency"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-500" />
                  <span className="text-[10px] text-muted-foreground">Degradation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Potency</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Button */}
          <Button
            onClick={handleSave}
            disabled={!result || loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
          >
            <Save className="size-4 mr-2" />
            Save as Study
          </Button>
          <p className="text-[10px] text-center text-muted-foreground -mt-2">
            Saves parameters and navigates to the Studies page
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
