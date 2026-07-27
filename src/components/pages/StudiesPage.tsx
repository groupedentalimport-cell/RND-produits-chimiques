'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, RefreshCw, Download, ArrowRight, Thermometer, Droplets,
  Clock, Beaker, Activity, Eye, Gauge, Shield, CheckCircle2,
  XCircle, Trash2, List, CalendarRange, CheckSquare, X, GitCompareArrows, Star,
} from 'lucide-react'
import {
  Card, CardContent, CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  ToggleGroup, ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  studyTypeLabels, statusColors, transformStudy, exportCSV,
} from '@/lib/sample-data'
import type { StudyData } from '@/lib/types'
import { useFavoriteStore } from '@/lib/store'
import { StudyTimeline } from './StudyTimeline'

export function StudiesPage() {
  const { toast } = useToast()
  const { isFavorite, toggleFavorite } = useFavoriteStore()
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [studyTypeFilter, setStudyTypeFilter] = useState('all')
  const [view, setView] = useState<'list' | 'timeline'>('list')
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [apiStudies, setApiStudies] = useState<StudyData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [studiesByStatus, setStudiesByStatus] = useState<{ status: string; _count: { status: number } }[]>([])
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailStudy, setDetailStudy] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [signing, setSigning] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [newTimePoint, setNewTimePoint] = useState({ timeDays: 0, percentRemaining: 100, isOOS: false, isOOT: false })
  const [addingTimePoint, setAddingTimePoint] = useState(false)
  const [deletingTimePointId, setDeletingTimePointId] = useState<string | null>(null)
  const [newStudy, setNewStudy] = useState({
    substanceName: '',
    studyType: 'long_term',
    temperatureC: 25,
    humidityPercent: 60,
    durationMonths: 24,
    ph: 7.0,
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const clearSelection = () => setSelectedIds([])

  // Batch status update handler
  const batchUpdateStatus = async (newStatus: string) => {
    if (selectedIds.length === 0) return
    try {
      const results = await Promise.all(selectedIds.map(id =>
        fetch(`/api/studies/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      ))
      const successCount = results.filter(r => r.ok).length
      toast({
        title: `Batch status update`,
        description: `${successCount} of ${selectedIds.length} studies updated to "${newStatus.replace('_', ' ')}"`,
      })
      clearSelection()
      handleRefresh()
    } catch {
      toast({ title: 'Error', description: 'Network error during batch update', variant: 'destructive' })
    }
  }

  // Batch export selected studies
  const batchExportCSV = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await fetch('/api/studies?limit=1000')
      if (res.ok) {
        const data = await res.json()
        const selectedStudies = (data.studies || []).filter((s: any) => selectedIds.includes(s.id))
        const rows = selectedStudies.map((s: any) => ({
          id: s.id,
          studyCode: s.studyCode ?? '',
          substanceName: s.substanceName ?? '',
          studyType: s.studyType ?? '',
          status: s.status ?? '',
          temperatureC: s.temperatureC ?? '',
          humidityPercent: s.humidityPercent ?? '',
          durationMonths: s.durationMonths ?? '',
          predictedShelfLifeMonths: s.predictedShelfLifeMonths ?? '',
        }))
        exportCSV(rows, `chemstab-selected-studies-${new Date().toISOString().slice(0, 10)}.csv`)
        toast({ title: 'Export complete', description: `Exported ${rows.length} selected studies to CSV` })
      }
    } catch {
      toast({ title: 'Export failed', description: 'Network error', variant: 'destructive' })
    }
  }

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (studyTypeFilter !== 'all') params.set('type', studyTypeFilter)
      try {
        const [studiesRes, statsRes] = await Promise.all([
          fetch(`/api/studies?${params.toString()}`),
          fetch('/api/stats'),
        ])
        if (studiesRes.ok && !cancelled) {
          const data = await studiesRes.json()
          const transformed: StudyData[] = (data.studies || []).map((s: any) => ({
            ...transformStudy(s), humidityPercent: s.humidityPercent ?? null, ph: s.ph ?? null,
          }))
          if (!cancelled) {
            setApiStudies(transformed)
            setTotalCount(data.pagination?.total ?? 0)
          }
        }
        if (statsRes.ok && !cancelled) {
          const statsData = await statsRes.json()
          if (statsData.studiesByStatus && !cancelled) {
            setStudiesByStatus(statsData.studiesByStatus)
          }
        }
      } catch { /* fallback */ }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [statusFilter, studyTypeFilter, refreshKey])

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
          ph: newStudy.ph,
        }),
      })
      if (res.ok) {
        toast({
          title: 'Study created',
          description: `${newStudy.substanceName} study created successfully (${code})`,
        })
        setCreateOpen(false)
        setNewStudy({ substanceName: '', studyType: 'long_term', temperatureC: 25, humidityPercent: 60, durationMonths: 24, ph: 7.0 })
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

  const handleAddTimePoint = async () => {
    if (!detailStudy) return
    if (newTimePoint.timeDays < 0) {
      toast({ title: 'Validation error', description: 'Time (days) must be ≥ 0', variant: 'destructive' })
      return
    }
    setAddingTimePoint(true)
    try {
      const degradationPercent = Math.max(0, 100 - newTimePoint.percentRemaining)
      const res = await fetch('/api/timepoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeDays: newTimePoint.timeDays,
          percentRemaining: newTimePoint.percentRemaining,
          degradationPercent,
          isOOS: newTimePoint.isOOS,
          isOOT: newTimePoint.isOOT,
          studyId: detailStudy.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: 'Time point added', description: `Day ${newTimePoint.timeDays} recorded` })
        setDetailStudy((prev: any) => prev
          ? { ...prev, timePoints: [...(prev.timePoints || []), data.timePoint].sort((a: any, b: any) => a.timeDays - b.timeDays) }
          : prev)
        setNewTimePoint({ timeDays: 0, percentRemaining: 100, isOOS: false, isOOT: false })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Error', description: err.error || 'Failed to add time point', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setAddingTimePoint(false)
    }
  }

  const handleDeleteTimePoint = async (tpId: string) => {
    setDeletingTimePointId(tpId)
    try {
      const res = await fetch(`/api/timepoints/${tpId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Time point deleted', description: 'Measurement removed from study' })
        setDetailStudy((prev: any) => prev
          ? { ...prev, timePoints: (prev.timePoints || []).filter((tp: any) => tp.id !== tpId) }
          : prev)
      } else {
        toast({ title: 'Error', description: 'Failed to delete time point', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' })
    } finally {
      setDeletingTimePointId(null)
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

      {/* Status Pipeline Visualization */}
      <div className="flex items-center gap-1 p-3 rounded-xl bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border">
        {['draft', 'in_progress', 'under_review', 'approved'].map((stage, i) => {
          const count = studiesByStatus?.find(s => s.status === stage)?._count?.status || 0
          const stageColors: Record<string, string> = {
            draft: 'bg-slate-400', in_progress: 'bg-teal-500', under_review: 'bg-amber-500', approved: 'bg-emerald-500'
          }
          const stageLabels: Record<string, string> = {
            draft: 'Draft', in_progress: 'In Progress', under_review: 'Under Review', approved: 'Approved'
          }
          return (
            <div key={stage} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="size-3 text-muted-foreground" />}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/60 dark:bg-card/60">
                <span className={`size-2 rounded-full ${stageColors[stage]}`} />
                <span className="text-xs font-medium">{stageLabels[stage]}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{count}</Badge>
              </div>
            </div>
          )
        })}
      </div>

      {/* Study Type Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-1">
        {['all', 'long_term', 'accelerated', 'intermediate', 'stress'].map((type) => (
          <Button
            key={type}
            variant={studyTypeFilter === type ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs rounded-full ${studyTypeFilter === type ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
            onClick={() => setStudyTypeFilter(type)}
          >
            {type === 'all' ? 'All Types' : studyTypeLabels[type]}
          </Button>
        ))}
      </div>

      {/* Status Filter + View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => { if (v === 'list' || v === 'timeline') setView(v) }}
          variant="outline"
          size="sm"
          className="rounded-lg"
          aria-label="Studies view toggle"
        >
          <ToggleGroupItem value="list" className="gap-1.5 px-3 data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:hover:bg-emerald-700">
            <List className="size-3.5" /> List View
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline" className="gap-1.5 px-3 data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:hover:bg-emerald-700">
            <CalendarRange className="size-3.5" /> Timeline View
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Studies Table (List View) */}
      {view === 'list' && (
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
                    <TableHead className="w-[40px]">Select</TableHead>
                    <TableHead>Study Code</TableHead>
                    <TableHead>Substance</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Temp (°C)</TableHead>
                    <TableHead>Shelf Life</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiStudies.map((std, idx) => {
                    const isSelected = selectedIds.includes(std.id)
                    return (
                    <TableRow
                      key={std.id}
                      className={`cursor-pointer transition-all ${isSelected ? 'bg-emerald-50/60 dark:bg-emerald-900/15 shadow-[inset_3px_0_0_0_rgb(16,185,129)]' : idx % 2 === 1 ? 'bg-muted/30' : ''} hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10`}
                      onClick={() => openDetail(std)}
                    >
                      <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(std.id)}
                          aria-label={`Select study ${std.studyCode}`}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium font-mono">{std.studyCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span>{std.substanceName}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 shrink-0 p-0 hover:bg-transparent"
                            onClick={(e) => { e.stopPropagation(); toggleFavorite('study', std.id, std.substanceName) }}
                          >
                            <Star className={`size-3.5 transition-colors ${isFavorite('study', std.id) ? 'fill-emerald-500 text-emerald-500' : 'text-muted-foreground/50 hover:text-emerald-400'}`} />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{studyTypeLabels[std.studyType]}</TableCell>
                      <TableCell>{std.temperatureC}</TableCell>
                      <TableCell>
                        {std.predictedShelfLifeMonths !== null ? `${std.predictedShelfLifeMonths} mo` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[std.status]}>{std.status.replace('_', ' ')}</Badge>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                  {apiStudies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
      )}

      {/* Floating Batch Action Bar — appears when studies are selected */}
      <AnimatePresence>
        {selectedIds.length >= 1 && view === 'list' && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-card/95 backdrop-blur-md shadow-2xl shadow-emerald-900/20 px-4 py-2.5"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckSquare className="size-4" />
              </span>
              <span className="font-medium">
                Selected <span className="text-emerald-600 dark:text-emerald-400">{selectedIds.length}</span> study{selectedIds.length !== 1 ? 'ies' : 'y'}
              </span>
            </div>
            <div className="h-6 w-px bg-border" />
            {/* Batch status update buttons */}
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="text-xs h-7 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20" onClick={() => batchUpdateStatus('in_progress')}>
                Start
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20" onClick={() => batchUpdateStatus('under_review')}>
                Review
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => batchUpdateStatus('approved')}>
                Approve
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400" onClick={() => batchUpdateStatus('rejected')}>
                Reject
              </Button>
            </div>
            <div className="h-6 w-px bg-border" />
            <Button
              size="sm"
              variant="outline"
              onClick={batchExportCSV}
            >
              <Download className="size-4 mr-1" /> Export
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={clearSelection}
              aria-label="Clear selection"
            >
              <X className="size-4" /> Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Studies Timeline (Gantt-style View) */}
      {view === 'timeline' && (
        <StudyTimeline studies={apiStudies} onBarClick={openDetail} />
      )}

      {/* Create Study Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Stability Study</DialogTitle>
            <DialogDescription>Define the parameters for a new stability study</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-emerald-700 dark:text-emerald-400">Substance Name *</Label><Input placeholder="Enter substance name" value={newStudy.substanceName} onChange={(e) => setNewStudy({ ...newStudy, substanceName: e.target.value })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/50">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">Study Code Preview</p>
              <p className="text-sm font-mono text-muted-foreground">STB-{new Date().getFullYear()}-{String(Date.now()).slice(-5)} <span className="text-xs">(auto-generated)</span></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-emerald-700 dark:text-emerald-400">Study Type</Label><Select value={newStudy.studyType} onValueChange={(v) => setNewStudy({ ...newStudy, studyType: v })}><SelectTrigger className="border-emerald-200 dark:border-emerald-800/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="long_term">Long-Term</SelectItem><SelectItem value="accelerated">Accelerated</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="stress">Stress Testing</SelectItem></SelectContent></Select></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Duration (months)</Label><Input type="number" value={newStudy.durationMonths} onChange={(e) => setNewStudy({ ...newStudy, durationMonths: parseInt(e.target.value) || 0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Temperature (°C)</Label><Input type="number" value={newStudy.temperatureC} onChange={(e) => setNewStudy({ ...newStudy, temperatureC: parseFloat(e.target.value) || 0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">Humidity (%)</Label><Input type="number" value={newStudy.humidityPercent} onChange={(e) => setNewStudy({ ...newStudy, humidityPercent: parseFloat(e.target.value) || 0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
              <div><Label className="text-emerald-700 dark:text-emerald-400">pH</Label><Input type="number" step="0.1" value={newStudy.ph} onChange={(e) => setNewStudy({ ...newStudy, ph: parseFloat(e.target.value) || 7.0 })} className="border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500" /></div>
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
                            <TableHead className="w-8"></TableHead>
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
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-muted-foreground hover:text-red-500"
                                  onClick={() => handleDeleteTimePoint(tp.id)}
                                  disabled={deletingTimePointId === tp.id}
                                >
                                  <Trash2 className={`size-3 ${deletingTimePointId === tp.id ? 'animate-spin' : ''}`} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                      No time point data recorded for this study yet. Add measurements below.
                    </p>
                  )}

                  {/* Add time point form */}
                  <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/50">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">Add Time Point</p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[100px]"><Label className="text-[10px] text-muted-foreground">Time (days)</Label><Input type="number" min="0" placeholder="0" value={newTimePoint.timeDays || ''} onChange={(e) => setNewTimePoint({ ...newTimePoint, timeDays: parseInt(e.target.value) || 0 })} className="text-xs h-8" /></div>
                      <div className="flex-1 min-w-[100px]"><Label className="text-[10px] text-muted-foreground">% Remaining</Label><Input type="number" min="0" max="100" step="0.1" placeholder="100" value={newTimePoint.percentRemaining || ''} onChange={(e) => setNewTimePoint({ ...newTimePoint, percentRemaining: parseFloat(e.target.value) || 0 })} className="text-xs h-8" /></div>
                      <label className="flex items-center gap-1 text-xs cursor-pointer h-8"><input type="checkbox" checked={newTimePoint.isOOS} onChange={(e) => setNewTimePoint({ ...newTimePoint, isOOS: e.target.checked })} className="rounded" />OOS</label>
                      <label className="flex items-center gap-1 text-xs cursor-pointer h-8"><input type="checkbox" checked={newTimePoint.isOOT} onChange={(e) => setNewTimePoint({ ...newTimePoint, isOOT: e.target.checked })} className="rounded" />OOT</label>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8" onClick={handleAddTimePoint} disabled={addingTimePoint}>
                        {addingTimePoint ? <><RefreshCw className="size-3 mr-1 animate-spin" /> Adding...</> : <><Plus className="size-3 mr-1" /> Add</>}
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Electronic signatures */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Shield className="size-4 text-emerald-600 dark:text-emerald-400" /><p className="text-sm font-medium">Electronic Signatures ({detailStudy.signatures?.length || 0})</p></div>
                  {detailStudy.signatures && detailStudy.signatures.length > 0 ? (
                    <div className="space-y-2">
                      {detailStudy.signatures.map((sig: any) => (
                        <div key={sig.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{sig.signerName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium">{sig.signerName}</p><p className="text-xs text-muted-foreground">{sig.meaning} · {sig.signerRole}</p></div>
                          <div className="text-right shrink-0"><p className="text-xs text-muted-foreground">{sig.signedAt ? new Date(sig.signedAt).toLocaleString() : ''}</p><p className="text-[10px] font-mono text-muted-foreground">#{sig.signatureHash?.slice(0, 8)}</p></div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">No electronic signatures recorded yet.</p>}
                </div>

                <Separator />

                {/* Status action buttons */}
                {detailStudy.status === 'under_review' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateStudyStatus('approved')} disabled={statusUpdating}><CheckCircle2 className="size-4 mr-1" /> Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStudyStatus('rejected')} disabled={statusUpdating}><XCircle className="size-4 mr-1" /> Reject</Button>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" onClick={signStudy} disabled={signing}>{signing ? <><RefreshCw className="size-4 mr-2 animate-spin" /> Signing...</> : <><Shield className="size-4 mr-2" /> Sign Study</>}</Button>
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
