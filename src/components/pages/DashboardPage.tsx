'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Play, ClipboardList, Download, Database, Microscope, Cpu,
  AlertTriangle, RefreshCw, FileText, CheckCircle2, Activity,
  ArrowRight, ArrowUpRight, ArrowDownRight, XCircle, ShieldCheck,
  Clock, Atom, Shield, TrendingUp, Info, ExternalLink,
} from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import {
  STABILITY_TRENDS_DATA, RISK_DISTRIBUTION_DATA, studyTypeLabels, statusColors,
  ACTION_ICON_MAP, GRADIENT_TOP_BAR, COLOR_MAP, COLOR_MAP_TEXT, transformStudy,
  transformMolecule, riskColors, getScoreColor,
} from '@/lib/sample-data'
import type { PageId, StudyData, MoleculeData } from '@/lib/types'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'

export function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [statsData, setStatsData] = useState<{
    totalMolecules: number; activeStudies: number; avgStabilityScore: number;
    riskDistribution: Record<string, number>; recentActivity: any[];
    totalReports: number;
    studiesByStatus?: { status: string; _count: { status: number } }[];
  } | null>(null)
  const [recentStudies, setRecentStudies] = useState<StudyData[]>([])
  const [shelfLifeStudies, setShelfLifeStudies] = useState<StudyData[]>([])
  const [recentMolecules, setRecentMolecules] = useState<MoleculeData[]>([])
  const [complianceScore, setComplianceScore] = useState<number | null>(null)
  const [riskAlerts, setRiskAlerts] = useState<any[]>([])

  const quickActions = [
    { label: 'Add Molecule', icon: Plus, page: 'molecules' as PageId },
    { label: 'Run Simulation', icon: Play, page: 'simulator' as PageId },
    { label: 'Create Study', icon: ClipboardList, page: 'studies' as PageId },
    { label: 'Compliance Check', icon: ShieldCheck, page: 'compliance' as PageId },
    { label: 'Generate Report', icon: Download, page: 'reports' as PageId },
  ]

  const { setPage } = useAppStore()

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [statsRes, studiesRes, shelfLifeRes, moleculesRes, complianceRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/studies?limit=5'),
          fetch('/api/studies?limit=10'),
          fetch('/api/molecules?limit=5'),
          fetch('/api/compliance-history'),
        ])
        if (statsRes.ok && !cancelled) {
          const data = await statsRes.json()
          if (!cancelled) setStatsData(data)
          // Extract risk alerts from recentActivity (filter risk/alert related entries)
          if (data.recentActivity) {
            const alerts = data.recentActivity.filter((entry: any) => {
              const isRiskRelated = /risk|alert|escalat|critical|reject|delete/i.test(entry.action) ||
                /risk|alert|escalat|critical|hazard/i.test(entry.details || '') ||
                /reject|delete/i.test(entry.action)
              return isRiskRelated
            })
            if (!cancelled) setRiskAlerts(alerts)
          }
        }
        if (studiesRes.ok && !cancelled) {
          const data = await studiesRes.json()
          const transformed: StudyData[] = (data.studies || []).slice(0, 5).map(transformStudy)
          if (!cancelled) setRecentStudies(transformed)
        }
        if (shelfLifeRes.ok && !cancelled) {
          const data = await shelfLifeRes.json()
          const withShelfLife: StudyData[] = (data.studies || [])
            .filter((s: any) => s.predictedShelfLifeMonths != null)
            .map(transformStudy)
            .slice(0, 8)
          if (!cancelled) setShelfLifeStudies(withShelfLife)
        }
        if (moleculesRes.ok && !cancelled) {
          const data = await moleculesRes.json()
          const transformed: MoleculeData[] = (data.molecules || []).slice(0, 5).map(transformMolecule)
          if (!cancelled) setRecentMolecules(transformed)
        }
        if (complianceRes.ok && !cancelled) {
          const data = await complianceRes.json()
          if (data.reports && data.reports.length > 0) {
            // Most recent report's overallScore
            if (!cancelled) setComplianceScore(data.reports[0].overallScore)
          }
        }
      } catch { /* fallback: statsData stays null, sample data used */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  // Derive compliance score color
  const complianceColor = complianceScore !== null
    ? (complianceScore >= 80 ? 'emerald' : complianceScore >= 60 ? 'amber' : 'red')
    : 'emerald'

  // Derive stats from API data (fallback to sample values if API fails)
  const stats = statsData ? [
    { label: 'Total Molecules', value: String(statsData.totalMolecules), icon: Database, trend: `Avg score ${statsData.avgStabilityScore.toFixed(0)}`, trendUp: true, color: 'emerald' },
    { label: 'Active Studies', value: String(statsData.activeStudies), icon: Microscope, trend: `${statsData.totalReports} reports`, trendUp: false, color: 'teal' },
    { label: 'Avg Stability', value: statsData.avgStabilityScore.toFixed(1), icon: Cpu, trend: 'Platform-wide', trendUp: true, color: 'cyan' },
    { label: 'Risk Alerts', value: String((statsData.riskDistribution.high || 0) + (statsData.riskDistribution.critical || 0)), icon: AlertTriangle, trend: `${statsData.riskDistribution.critical || 0} critical`, trendUp: false, color: 'amber' },
    { label: 'Compliance Score', value: complianceScore !== null ? complianceScore.toFixed(0) : '--', icon: ShieldCheck, trend: complianceScore !== null ? (complianceScore >= 80 ? 'Passing' : 'Needs review') : 'No data yet', trendUp: complianceScore !== null ? complianceScore >= 80 : false, color: complianceColor },
  ] : [
    { label: 'Total Molecules', value: '12', icon: Database, trend: '+3 this month', trendUp: true, color: 'emerald' },
    { label: 'Active Studies', value: '3', icon: Microscope, trend: '2 under review', trendUp: false, color: 'teal' },
    { label: 'Simulations Run', value: '47', icon: Cpu, trend: '+12 this week', trendUp: true, color: 'cyan' },
    { label: 'Risk Alerts', value: '2', icon: AlertTriangle, trend: '1 critical alert', trendUp: false, color: 'amber' },
    { label: 'Compliance Score', value: '--', icon: ShieldCheck, trend: 'No data yet', trendUp: false, color: 'emerald' },
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

  // Sparkline colors per stat color
  const sparklineColors: Record<string, string> = {
    emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', amber: '#f59e0b', red: '#ef4444',
  }
  // Deterministic 7-day variations per card index for visual variety
  const sparkVariations = [
    [12, 19, 14, 22, 18, 26, 24],
    [30, 28, 32, 25, 29, 27, 31],
    [62, 65, 61, 68, 70, 66, 72],
    [3, 5, 2, 4, 6, 3, 2],
    [85, 82, 88, 84, 90, 86, 92],
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 relative"
    >
      {/* Subtle grid pattern background with radial fade */}
      <div className="pointer-events-none absolute inset-0 grid-pattern grid-pattern-fade opacity-60 -z-10" aria-hidden />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-foreground/70">Overview of your chemical stability assessment platform</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
            <RefreshCw className="size-2.5" />
            Last updated: <span className="font-mono">2 minutes ago</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-20 w-full rounded-md bg-muted animate-pulse" /></CardContent></Card>
          ))
        ) : stats.map((stat, statIdx) => {
          const Icon = stat.icon
          const sparkColor = sparklineColors[stat.color] || '#10b981'
          const sparkData = sparkVariations[statIdx] || sparkVariations[0]
          // Pulse the Risk Alerts card when there are critical alerts
          const criticalCount = statsData?.riskDistribution?.critical || 0
          const isRiskAlertWithCritical = stat.label === 'Risk Alerts' && criticalCount > 0
          // Compliance card tooltip when no data
          const isComplianceNoData = stat.label === 'Compliance Score' && complianceScore === null
          return (
            <motion.div key={stat.label} whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }} transition={{ type: 'spring', stiffness: 400 }}>
              <Card className={`cursor-pointer backdrop-blur-sm bg-card/80 transition-transform hover:-translate-y-1 overflow-hidden relative group ${isRiskAlertWithCritical ? 'ring-2 ring-amber-400/60 dark:ring-amber-500/40' : ''}`}>
                {/* Pulsing amber glow border for Risk Alerts with critical count */}
                {isRiskAlertWithCritical && (
                  <span className="pointer-events-none absolute -inset-px rounded-xl ring-1 ring-amber-400/40 dark:ring-amber-500/30 animate-pulse" aria-hidden />
                )}
                <div className={`absolute inset-x-0 top-0 h-1 ${GRADIENT_TOP_BAR[stat.color] || GRADIENT_TOP_BAR.emerald}`} />
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-teal-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <CardContent className="p-4 relative">
                  <div className="absolute top-0 right-0 size-24 rounded-full bg-gradient-to-br from-emerald-200/20 to-teal-200/20 dark:from-emerald-800/20 dark:to-teal-800/20 blur-2xl" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-muted-foreground/90 flex items-center gap-1">
                        {stat.label}
                        {isComplianceNoData && (
                          <span title="Run a compliance check to see your score" className="inline-flex items-center">
                            <Info className="size-3.5 text-muted-foreground/60" />
                          </span>
                        )}
                      </p>
                      <div className={`text-xl sm:text-2xl font-bold ${complianceScore !== null && stat.label === 'Compliance Score' ? getScoreColor(complianceScore) : ''}`}>{isNaN(Number(stat.value)) ? stat.value : <AnimatedNumber value={Number(stat.value)} />}</div>
                    </div>
                    <div className={`p-2 rounded-lg ${COLOR_MAP[stat.color]}`}><Icon className="size-5" /></div>
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {stat.trendUp ? <ArrowUpRight className="size-3 text-emerald-500" /> : <ArrowDownRight className="size-3 text-amber-500" />}{stat.trend}
                    </div>
                    {/* 7-day sparkline — tiny, no axes, hidden on very small screens */}
                    <div className="w-20 h-8 opacity-70 group-hover:opacity-100 transition-opacity hidden sm:block">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData.map((v, i) => ({ i, v }))}>
                          <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.3} />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis domain={[40, 100]} ticks={[40, 60, 80, 100]} allowDataOverflow={false} className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
                  <Line type="monotone" dataKey="aspirin" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Aspirin" />
                  <Line type="monotone" dataKey="acetaminophen" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} name="Acetaminophen" />
                  <Line type="monotone" dataKey="caffeine" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Caffeine" />
                  <Line type="monotone" dataKey="overall" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} name="Overall" />
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
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative border-l-2 pl-4 ml-2 p-2 rounded-r-lg hover:bg-muted/50 transition-colors" style={{ borderImage: 'linear-gradient(to bottom, #10b981, #14b8a6) 1' }}>
                  <span className="absolute -left-[5px] top-2 size-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  <div className="flex items-start gap-3">
                    <Icon className={`size-4 mt-0.5 shrink-0 ${COLOR_MAP_TEXT[item.color]}`} />
                    <div className="flex-1 min-w-0"><p className="text-sm leading-snug">{item.text}</p><p className="text-xs text-muted-foreground mt-0.5">{item.time}</p></div>
                  </div>
                </motion.div>
              )
            })}
          </CardContent>
          {/* View all link */}
          <div className="px-6 pb-4 pt-0">
            <button
              onClick={() => setPage('admin')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors group"
            >
              View all activity
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </Card>

        {/* Quick Actions + System Status */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 sm:grid-cols-2 gap-2">
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

          <Card className="gradient-border backdrop-blur-sm bg-card/80">
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
                <div className="p-12 text-center relative">
                  <Microscope className="size-14 text-emerald-500/20 dark:text-emerald-400/20 mx-auto mb-3" />
                  <p className="font-medium text-foreground">No studies yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create your first stability study to see it here</p>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white mt-3"
                    size="sm"
                    onClick={() => setPage('studies')}
                  >
                    <Plus className="size-4 mr-1" /> Create Study
                  </Button>
                </div>
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
                      <TableRow key={s.id} className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[inset_3px_0_0_0_rgb(16,185,129),0_4px_12px_-4px_rgba(16,185,129,0.25)] ${idx % 2 === 1 ? 'bg-muted/30' : ''}`} onClick={() => setPage('studies')}>
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

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTIONS: Shelf Life Predictions, Recent Molecules, Risk Alerts
         ══════════════════════════════════════════════════════════════════════ */}

      {/* Shelf Life Predictions + Recent Molecules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Shelf Life Predictions Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}
        >
          <Card className="backdrop-blur-sm bg-card/80 overflow-hidden relative group">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="pointer-events-none absolute inset-0 grid-pattern opacity-40 -z-10" aria-hidden />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5 text-emerald-600 dark:text-emerald-400" />
                Shelf Life Predictions
              </CardTitle>
              <CardDescription>Predicted shelf life vs ICH 24-month reference threshold</CardDescription>
              <CardAction>
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400">ICH Ref: 24 mo</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : shelfLifeStudies.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="size-12 text-emerald-500/20 dark:text-emerald-400/20 mx-auto mb-3" />
                  <p className="font-medium text-foreground">No shelf life data yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Complete a study with predicted shelf life to see predictions here</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={shelfLifeStudies.map((s) => ({
                      name: s.substanceName.length > 12 ? s.substanceName.slice(0, 12) + '…' : s.substanceName,
                      months: s.predictedShelfLifeMonths ?? 0,
                      fill: (s.predictedShelfLifeMonths ?? 0) > 24 ? '#10b981' : (s.predictedShelfLifeMonths ?? 0) >= 12 ? '#f59e0b' : '#ef4444',
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.3} horizontal={false} />
                    <XAxis type="number" domain={[0, 'dataMax + 10']} className="text-xs" tickFormatter={(v: number) => `${v}mo`} />
                    <YAxis type="category" dataKey="name" width={90} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [`${value} months`, 'Shelf Life']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <ReferenceLine x={24} stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" label={{ value: 'ICH 24mo', position: 'insideTopRight', fill: '#10b981', fontSize: 11 }} />
                    <Bar dataKey="months" radius={[0, 6, 6, 0]} barSize={20}>
                      {shelfLifeStudies.map((s, idx) => {
                        const months = s.predictedShelfLifeMonths ?? 0
                        const barFill = months > 24 ? '#10b981' : months >= 12 ? '#f59e0b' : '#ef4444'
                        return <Cell key={idx} fill={barFill} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Recent Molecules Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}
        >
          <Card className="backdrop-blur-sm bg-card/80 overflow-hidden relative group">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
            <div className="pointer-events-none absolute inset-0 grid-pattern opacity-40 -z-10" aria-hidden />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Atom className="size-5 text-teal-600 dark:text-teal-400" />
                Recent Molecules
              </CardTitle>
              <CardDescription>Newly added compounds in the database</CardDescription>
              <CardAction>
                <button
                  onClick={() => setPage('molecules')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors group"
                >
                  View All <ExternalLink className="size-3" />
                </button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : recentMolecules.length === 0 ? (
                <div className="py-12 text-center">
                  <Atom className="size-12 text-teal-500/20 dark:text-teal-400/20 mx-auto mb-3" />
                  <p className="font-medium text-foreground">No molecules yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Add your first molecule to see it here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {recentMolecules.map((mol, idx) => {
                    const riskBadgeColors: Record<string, string> = {
                      low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                      moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                      high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                      critical: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200',
                    }
                    const score = mol.stabilityScore
                    const scoreBarColor = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-teal-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    return (
                      <motion.div
                        key={mol.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08 }}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm group/row"
                        onClick={() => setPage('molecules')}
                      >
                        {/* Molecule icon */}
                        <div className="size-8 rounded-lg bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-900/30 dark:to-emerald-900/30 flex items-center justify-center shrink-0">
                          <Atom className="size-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{mol.name}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${riskBadgeColors[mol.riskLevel] || riskBadgeColors.low}`}>{mol.riskLevel}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">CAS: {mol.casNumber || 'N/A'}</span>
                        </div>
                        {/* Stability score mini progress */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div className={`h-full rounded-full ${scoreBarColor} transition-all duration-500`} style={{ width: `${Math.max(score, 5)}%` }} />
                          </div>
                          <span className={`text-xs font-mono tabular-nums w-6 ${getScoreColor(score)}`}>{score}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
              {/* View All Molecules link */}
              {!loading && recentMolecules.length > 0 && (
                <div className="pt-3 mt-2 border-t border-muted/30">
                  <button
                    onClick={() => setPage('molecules')}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors group"
                  >
                    View All Molecules
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Risk Alerts Timeline Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}
      >
        <Card className="backdrop-blur-sm bg-card/80 overflow-hidden relative group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="pointer-events-none absolute inset-0 grid-pattern opacity-40 -z-10" aria-hidden />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              Risk Alerts Timeline
            </CardTitle>
            <CardDescription>Recent risk-related events and alerts</CardDescription>
            <CardAction>
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">Last 7 days</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : riskAlerts.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="size-12 text-emerald-500/30 dark:text-emerald-400/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No risk alerts in the last 7 days</p>
                <p className="text-sm text-muted-foreground mt-1">All systems operating within normal parameters</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-0">
                {riskAlerts.map((entry: any, idx: number) => {
                  // Determine severity: critical or warning
                  const isCritical = /critical|reject|delete/i.test(entry.action) || /critical/i.test(entry.details || '')
                  const severityColor = isCritical ? 'red' : 'amber'
                  const dotColor = isCritical ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                  const lineGradient = isCritical ? 'from-red-500 to-amber-500' : 'from-amber-500 to-teal-500'
                  const severityBadge = isCritical
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  const severityLabel = isCritical ? 'Critical' : 'Warning'
                  const actionIcon = ACTION_ICON_MAP[entry.action] || AlertTriangle
                  const IconComp = actionIcon
                  return (
                    <motion.div
                      key={entry.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative border-l-2 pl-4 ml-3 p-2 rounded-r-lg hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors"
                      style={{ borderImage: 'linear-gradient(to bottom, var(--tw-gradient-stops)) 1' }}
                    >
                      {/* Gradient line */}
                      <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${lineGradient}`} />
                      {/* Color-coded dot */}
                      <span className={`absolute -left-[5px] top-2.5 size-2.5 rounded-full ${dotColor}`} />
                      <div className="flex items-start gap-3">
                        <IconComp className={`size-4 mt-0.5 shrink-0 ${COLOR_MAP_TEXT[severityColor]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge className={`text-[10px] px-1.5 py-0 ${severityBadge}`}>{severityLabel}</Badge>
                            <span className="text-xs text-muted-foreground font-mono">{new Date(entry.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm leading-snug">{entry.details || `${entry.action} on ${entry.tableName} (#${entry.recordId})`}</p>
                          {entry.user?.name && <p className="text-xs text-muted-foreground mt-0.5">by {entry.user.name}</p>}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
