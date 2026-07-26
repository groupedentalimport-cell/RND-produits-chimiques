'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Download, RefreshCw, Search, BarChart3, LayoutGrid,
  Microscope, AlertTriangle, GitCompareArrows, X, CheckSquare, Atom, Database,
  Network,
} from 'lucide-react'
import {
  Card, CardContent, CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip as UiTooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import { useAppStore, useCompareStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import {
  transformMolecule, riskColors, getScoreColor,
  HAZARD_OUTLINE_MAP, HAZARD_CLASS_MAP, RISK_BG_MAP,
  RISK_PILL_ACTIVE, RISK_PILL_OUTLINE,
  formatFormula, exportCSV,
  findPathwayForMolecule,
} from '@/lib/sample-data'
import type { MoleculeData } from '@/lib/types'
import { Formula } from '@/components/shared/Formula'
import { MoleculeStructure } from '@/components/shared/MoleculeStructure'
import { DegradationPathway } from '@/components/shared/DegradationPathway'
import { MoleculeComparison } from '@/components/pages/MoleculeComparison'

export function MoleculesPage() {
  const { toast } = useToast()
  const { setPage } = useAppStore()
  const { selectedIds: compareIds, toggleId: toggleCompareId, setCompareOpen, clear: clearCompare } = useCompareStore()
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
                    <TableHead className="w-[40px]">Compare</TableHead>
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
                  {displayed.map((mol, idx) => {
                    const isSelected = compareIds.includes(mol.id)
                    return (
                    <TableRow
                      key={mol.id}
                      className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all hover:shadow-[inset_3px_0_0_0_rgb(16,185,129)] ${idx % 2 === 1 ? 'bg-muted/30' : ''} ${isSelected ? 'bg-emerald-50/60 dark:bg-emerald-900/15 shadow-[inset_3px_0_0_0_rgb(16,185,129)]' : ''}`}
                      onClick={() => openDetail(mol)}
                    >
                      <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCompareId(mol.id, {
                            onMaxReached: () => toast({
                              title: 'Maximum 3 molecules',
                              description: 'Oldest selection replaced. You can compare up to 3 molecules at a time.',
                            }),
                          })}
                          aria-label={`Select ${mol.name} for comparison`}
                          className="cursor-pointer"
                        />
                      </TableCell>
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
                    )
                  })}
                  {displayed.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 relative">
                          {/* Decorative floating circles */}
                          <motion.div
                            animate={{ y: [-6, 6, -6] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute -top-2 left-1/4 size-3 rounded-full bg-emerald-200/40 dark:bg-emerald-800/40 blur-sm"
                          />
                          <motion.div
                            animate={{ y: [6, -6, 6] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute top-0 right-1/4 size-2 rounded-full bg-teal-200/40 dark:bg-teal-800/40 blur-sm"
                          />
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                          >
                            <Database className="size-14 text-emerald-500/20 dark:text-emerald-400/20" />
                          </motion.div>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">No molecules found</p>
                            <p className="text-sm text-muted-foreground">
                              {searchQuery || riskFilter !== 'all' || sourceFilter !== 'all'
                                ? 'Try adjusting your search or filters'
                                : 'Get started by adding your first compound'}
                            </p>
                          </div>
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setAddOpen(true) }}
                          >
                            <Plus className="size-4 mr-1" /> Add Molecule
                          </Button>
                        </div>
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
          <Card className="relative overflow-hidden">
            <CardContent className="py-16 text-center relative">
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
                <Atom className="size-16 text-emerald-500/20 dark:text-emerald-400/20 mb-4" />
              </motion.div>
              <p className="font-medium text-foreground">No molecules found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || riskFilter !== 'all' || sourceFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Add your first compound to get started'}
              </p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                size="sm"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="size-4 mr-1" /> Add Molecule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((mol) => (
              <motion.div key={mol.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden" onClick={() => openDetail(mol)}>
                  {/* 2D Molecule Structure at top of card */}
                  {mol.smiles && (
                    <div className="border-b border-border/50">
                      <MoleculeStructure smiles={mol.smiles} width={280} height={140} className="rounded-none border-0" />
                    </div>
                  )}
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

                  {/* 2D Molecule Structure Viewer */}
                  {selectedMolecule.smiles && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Molecular Structure</p>
                      <MoleculeStructure
                        smiles={selectedMolecule.smiles}
                        width={400}
                        height={220}
                        className="w-full"
                      />
                    </div>
                  )}

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
                <TabsContent value="degradation" className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-medium">Degradation Products</p>
                      {degradationProducts.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{degradationProducts.length}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Interactive Degradation Pathway Visualization */}
                  {(() => {
                    const predefined = findPathwayForMolecule(selectedMolecule.name)
                    const pathwayProducts = degradationProducts.length > 0
                      ? degradationProducts.map((dp: any) => {
                          // Enrich with condition by matching product name to predefined pathway
                          const matched = predefined?.products.find(
                            (pp) => pp.name.toLowerCase() === (dp.name || '').toLowerCase()
                          )
                          return {
                            name: dp.name,
                            smiles: dp.smiles || undefined,
                            percentage: dp.percentage ?? null,
                            hazardLevel: (dp.hazardLevel || 'low') as any,
                            condition: matched?.condition as any,
                          }
                        })
                      : predefined?.products || []

                    const pathwaySmiles = selectedMolecule.smiles || predefined?.smiles
                    const pathwayCas = selectedMolecule.casNumber || predefined?.casNumber
                    const pathwayFormula = selectedMolecule.formula || predefined?.formula
                    const isUsingPredefined = degradationProducts.length === 0 && !!predefined

                    if (pathwayProducts.length === 0 && !degradationLoading) {
                      return null
                    }

                    return (
                      <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/40 to-teal-50/20 dark:from-emerald-900/10 dark:to-teal-900/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Network className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            Degradation Pathway Map
                          </p>
                          {isUsingPredefined && (
                            <Badge variant="outline" className="text-[9px] py-0 h-3.5 border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                              Reference pathway
                            </Badge>
                          )}
                        </div>
                        {degradationLoading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-24 w-full" />
                          </div>
                        ) : (
                          <DegradationPathway
                            moleculeName={selectedMolecule.name}
                            smiles={pathwaySmiles}
                            casNumber={pathwayCas}
                            formula={pathwayFormula}
                            degradationProducts={pathwayProducts}
                            compact
                          />
                        )}
                      </div>
                    )
                  })()}

                  {/* Detailed list of degradation products (existing UI) */}
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

      {/* Floating Compare Action Bar — appears when ≥2 molecules are selected */}
      <AnimatePresence>
        {compareIds.length >= 2 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-card/95 backdrop-blur-md shadow-2xl shadow-emerald-900/20 px-4 py-2.5"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <GitCompareArrows className="size-4" />
              </span>
              <span className="font-medium">
                Comparing <span className="text-emerald-600 dark:text-emerald-400">{compareIds.length}</span> molecule{compareIds.length !== 1 ? 's' : ''}
              </span>
              <span className="hidden md:inline text-xs text-muted-foreground ml-1">
                (max 3)
              </span>
            </div>
            <div className="h-6 w-px bg-border" />
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setCompareOpen(true)}
            >
              <CheckSquare className="size-4 mr-1" /> Compare Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => { clearCompare(); toast({ title: 'Selection cleared' }) }}
              aria-label="Clear comparison selection"
            >
              <X className="size-4" /> Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Molecule Comparison Dialog */}
      <MoleculeComparison molecules={displayed} />
    </motion.div>
  )
}
