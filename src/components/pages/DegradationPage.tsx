'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Plus, AlertTriangle, FlaskConical, Gauge,
  BarChart3, Atom, Search,
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import {
  transformMolecule, HAZARD_OUTLINE_MAP, HAZARD_BORDER_MAP, HAZARD_BAR_MAP,
  GRADIENT_TOP_BAR, COLOR_MAP, RISK_PILL_ACTIVE, formatFormula,
} from '@/lib/sample-data'
import type { MoleculeData } from '@/lib/types'
import { Formula } from '@/components/shared/Formula'

export function DegradationPage() {
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
        <Card className="relative overflow-hidden">
          <CardContent className="p-12 text-center relative">
            {/* Decorative floating circles */}
            <motion.div
              animate={{ y: [-8, 8, -8], rotate: [0, 180, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-6 left-12 size-8 rounded-full bg-emerald-200/30 dark:bg-emerald-800/30 blur-sm"
            />
            <motion.div
              animate={{ y: [8, -8, 8], rotate: [360, 180, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-8 right-16 size-6 rounded-full bg-teal-200/30 dark:bg-teal-800/30 blur-sm"
            />
            <motion.div
              animate={{ x: [-5, 5, -5], y: [5, -5, 5] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-12 right-20 size-4 rounded-full bg-cyan-200/30 dark:bg-cyan-800/30 blur-sm"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="flex justify-center"
            >
              <FlaskConical className="size-16 text-emerald-500/20 dark:text-emerald-400/20 mb-4" />
            </motion.div>
            <p className="font-medium text-foreground">No degradation products found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || hazardFilter !== 'all' || selectedMoleculeId !== 'all'
                ? 'Try adjusting your filters'
                : 'Add degradation products to see them here.'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
                onClick={() => setCreateDpOpen(true)}
              >
                <Plus className="size-4 mr-1" /> Add Product
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage('molecules')}>
                <Atom className="size-4 mr-2" /> Go to Molecules
              </Button>
            </div>
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
