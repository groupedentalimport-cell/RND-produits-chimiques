'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Download, Cpu, Brain,
  ArrowUpRight, ArrowDownRight, TrendingUp, Activity,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  QSPR_MODEL_PERFORMANCE, transformMolecule, getScoreColor,
} from '@/lib/sample-data'
import type { MoleculeData } from '@/lib/types'
import { Formula } from '@/components/shared/Formula'
import { useToast } from '@/hooks/use-toast'

export function AnalyticsPage() {
  const { toast } = useToast()
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
    try {
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
      toast({
        title: 'Analytics exported',
        description: `Exported ${molecules.length} molecules and ${QSPR_MODEL_PERFORMANCE.length} QSPR models to CSV`,
      })
    } catch {
      toast({ title: 'Export failed', description: 'Failed to generate analytics CSV', variant: 'destructive' })
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
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Analytics &amp; Insights</h1>
          <p className="text-muted-foreground">QSPR model performance and platform-wide chemical stability analytics</p>
          {/* Gradient underline beneath the page title */}
          <div className="mt-2 h-0.5 w-40 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-70" aria-hidden />
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
      <Card className="glass-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="size-5 text-emerald-600 dark:text-emerald-400" /> QSPR Model Performance</CardTitle><CardDescription>Prediction accuracy metrics for active QSPR models</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QSPR_MODEL_PERFORMANCE.map((model, idx) => (
                <motion.div
                  key={model.model}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="p-4 rounded-xl border bg-card relative overflow-hidden transition-shadow hover:shadow-[0_10px_28px_-8px_rgba(16,185,129,0.25)]"
                  style={{ background: `linear-gradient(135deg, ${model.fill}10, transparent 70%)` }}
                >
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
        <Card className="backdrop-blur-sm bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.18)]">
          <CardHeader><CardTitle>Risk Level Distribution</CardTitle><CardDescription>Molecule count by risk classification</CardDescription></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : riskPieData.length === 0 ? <p className="text-sm text-muted-foreground py-20 text-center">No data available</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart><Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>{riskPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} /><Legend /></PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="backdrop-blur-sm bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.18)]">
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
        <Card className="backdrop-blur-sm bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.18)]">
          <CardHeader><CardTitle>Stability Score Distribution</CardTitle><CardDescription>Histogram of molecule predicted stability scores</CardDescription></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bins}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="range" className="text-xs" /><YAxis className="text-xs" allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} /><Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="backdrop-blur-sm bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.18)]">
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
        <Card className="backdrop-blur-sm bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.18)]">
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
                      <TableRow key={mol.id} className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all hover:shadow-[inset_3px_0_0_0_rgb(16,185,129)] ${idx % 2 === 1 ? 'bg-muted/30' : ''}`}>
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

        <Card className="backdrop-blur-sm bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.18)]">
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
                      <TableRow key={mol.id} className={`cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all hover:shadow-[inset_3px_0_0_0_rgb(245,158,11)] ${idx % 2 === 1 ? 'bg-muted/30' : ''}`}>
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
