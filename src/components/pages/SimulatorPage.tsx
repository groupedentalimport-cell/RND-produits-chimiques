'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Beaker, Plus, Trash2, Thermometer, RefreshCw, Play,
  CheckCircle2, Clock, Lightbulb, Gauge, Zap,
} from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip,
} from 'recharts'
import { useAnalysisStore } from '@/lib/store'
import { getScoreColor, riskColors } from '@/lib/sample-data'
import { useToast } from '@/hooks/use-toast'
import { StabilityCalculator } from '@/components/shared/StabilityCalculator'

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

export function SimulatorPage() {
  const analysisStore = useAnalysisStore()
  const { toast } = useToast()
  const [simDone, setSimDone] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const runSimulation = useCallback(async () => {
    // Basic validation: at least one named substance
    const namedSubstance = analysisStore.substances.find((s) => s.name.trim())
    if (!namedSubstance) {
      toast({
        title: 'Validation error',
        description: 'Please name at least one substance before running the simulation',
        variant: 'destructive',
      })
      return
    }
    analysisStore.setRunning(true)
    setSimDone(false)
    setCurrentStep(0)
    // Increment through simulation progress steps
    const stepTimers = SIM_STEPS.map((_, i) =>
      setTimeout(() => setCurrentStep(i), (i + 1) * 600)
    )
    let succeeded = false
    let resultSummary: { overallScore: number; riskLevel: string } | null = null
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
        succeeded = true
        resultSummary = { overallScore: apiResult.overallScore, riskLevel: apiResult.riskLevel }
      } else {
        toast({
          title: 'Simulation failed',
          description: 'The analysis service returned an error. Please try again.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Simulation failed',
        description: 'Network error — could not reach the analysis service',
        variant: 'destructive',
      })
    }
    // Clear step timers
    stepTimers.forEach((t) => clearTimeout(t))
    setCurrentStep(SIM_STEPS.length)
    analysisStore.setRunning(false)
    setSimDone(true)
    if (succeeded && resultSummary) {
      toast({
        title: 'Simulation completed',
        description: `Overall stability score: ${resultSummary.overallScore} · Risk: ${resultSummary.riskLevel}`,
      })
    }
  }, [analysisStore, toast])

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

      {/* ── Arrhenius Stability Calculator ────────────────────────────── */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            ICH Q1A
          </Badge>
          <p className="text-xs text-muted-foreground">
            Quantitative shelf-life prediction based on the Arrhenius equation
          </p>
        </div>
        <StabilityCalculator />
      </div>
    </motion.div>
  )
}
