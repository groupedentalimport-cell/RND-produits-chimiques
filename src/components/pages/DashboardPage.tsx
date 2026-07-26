'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Play, ClipboardList, Download, Database, Microscope, Cpu,
  AlertTriangle, RefreshCw, FileText, CheckCircle2, Activity,
  ArrowRight, ArrowUpRight, ArrowDownRight, XCircle,
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
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import {
  STABILITY_TRENDS_DATA, RISK_DISTRIBUTION_DATA, studyTypeLabels, statusColors,
  ACTION_ICON_MAP, GRADIENT_TOP_BAR, COLOR_MAP, COLOR_MAP_TEXT, transformStudy,
} from '@/lib/sample-data'
import type { PageId, StudyData } from '@/lib/types'
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

  // Sparkline colors per stat color
  const sparklineColors: Record<string, string> = {
    emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', amber: '#f59e0b',
  }
  // Deterministic 7-day variations per card index for visual variety
  const sparkVariations = [
    [12, 19, 14, 22, 18, 26, 24],
    [30, 28, 32, 25, 29, 27, 31],
    [62, 65, 61, 68, 70, 66, 72],
    [3, 5, 2, 4, 6, 3, 2],
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-20 w-full rounded-md bg-muted animate-pulse" /></CardContent></Card>
          ))
        ) : stats.map((stat, statIdx) => {
          const Icon = stat.icon
          const sparkColor = sparklineColors[stat.color] || '#10b981'
          const sparkData = sparkVariations[statIdx] || sparkVariations[0]
          return (
            <motion.div key={stat.label} whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }} transition={{ type: 'spring', stiffness: 400 }}>
              <Card className="cursor-pointer backdrop-blur-sm bg-card/80 transition-transform hover:-translate-y-1 overflow-hidden relative group">
                <div className={`absolute inset-x-0 top-0 h-1 ${GRADIENT_TOP_BAR[stat.color] || GRADIENT_TOP_BAR.emerald}`} />
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-teal-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <CardContent className="p-4 relative">
                  <div className="absolute top-0 right-0 size-24 rounded-full bg-gradient-to-br from-emerald-200/20 to-teal-200/20 dark:from-emerald-800/20 dark:to-teal-800/20 blur-2xl" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <div className="text-2xl font-bold">{isNaN(Number(stat.value)) ? stat.value : <AnimatedNumber value={Number(stat.value)} />}</div>
                    </div>
                    <div className={`p-2 rounded-lg ${COLOR_MAP[stat.color]}`}><Icon className="size-5" /></div>
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {stat.trendUp ? <ArrowUpRight className="size-3 text-emerald-500" /> : <ArrowDownRight className="size-3 text-amber-500" />}{stat.trend}
                    </div>
                    {/* 7-day sparkline — tiny, no axes */}
                    <div className="w-20 h-8 opacity-70 group-hover:opacity-100 transition-opacity">
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
                      <TableRow key={s.id} className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all hover:shadow-[inset_3px_0_0_0_rgb(16,185,129)] ${idx % 2 === 1 ? 'bg-muted/30' : ''}`} onClick={() => setPage('studies')}>
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
