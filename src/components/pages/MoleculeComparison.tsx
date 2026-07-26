'use client'

import { useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend, ResponsiveContainer, Tooltip,
} from 'recharts'
import { Download, X, GitCompareArrows, Trophy, AlertOctagon } from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { useCompareStore } from '@/lib/store'
import {
  riskColors, getScoreColor, exportCSV, formatFormula, SAMPLE_MOLECULES,
} from '@/lib/sample-data'
import type { MoleculeData } from '@/lib/types'
import { Formula } from '@/components/shared/Formula'
import { useToast } from '@/hooks/use-toast'

interface MoleculeComparisonProps {
  /** Currently-loaded molecules (current page); missing IDs fall back to SAMPLE_MOLECULES */
  molecules: MoleculeData[]
}

// Palette for radar lines (NO indigo/blue) — max 3 molecules
const COMPARE_COLORS = ['#10b981', '#14b8a6', '#06b6d4']

// Reference ranges used for radar normalization (absolute, stable across selections)
const REF_RANGES: Record<string, { min: number; max: number }> = {
  stabilityScore: { min: 0, max: 100 },
  logP: { min: -5, max: 5 },
  molarMass: { min: 0, max: 250 },
  meltingPoint: { min: -200, max: 1000 },
}

function norm(v: number | null | undefined, key: keyof typeof REF_RANGES): number {
  const r = REF_RANGES[key]
  if (v === null || v === undefined || Number.isNaN(v)) return 0
  const pct = ((v - r.min) / (r.max - r.min)) * 100
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10))
}

interface PropertyRow {
  label: string
  /** Returns the raw value (string) used in the table cell */
  raw: (m: MoleculeData) => string
  /** Returns a React node for richer cell rendering (overrides raw when present) */
  render?: (m: MoleculeData, isHigh?: boolean, isLow?: boolean) => React.ReactNode
  /** Numeric accessor used for high/low highlighting */
  num?: (m: MoleculeData) => number | null
}

export function MoleculeComparison({ molecules }: MoleculeComparisonProps) {
  const { compareOpen, setCompareOpen, selectedIds, clear } = useCompareStore()
  const { toast } = useToast()

  // Resolve molecule objects — fall back to sample data for any IDs missing from the
  // currently-loaded list (e.g. user paginated away from the row).
  const selectedMolecules = useMemo<MoleculeData[]>(() => {
    return selectedIds
      .map((id) => molecules.find((m) => m.id === id) || SAMPLE_MOLECULES.find((m) => m.id === id))
      .filter((m): m is MoleculeData => Boolean(m))
  }, [selectedIds, molecules])

  const scores = selectedMolecules.map((m) => m.stabilityScore)
  const maxScore = scores.length ? Math.max(...scores) : null
  const minScore = scores.length ? Math.min(...scores) : null

  const propertyRows: PropertyRow[] = useMemo(() => ([
    { label: 'Name', raw: (m) => m.name },
    { label: 'CAS Number', raw: (m) => m.casNumber || '—' },
    {
      label: 'Formula',
      raw: (m) => formatFormula(m.formula),
      render: (m) => <Formula>{m.formula}</Formula>,
    },
    { label: 'Molar Mass', raw: (m) => (m.molarMass ? `${m.molarMass.toFixed(2)} g/mol` : '—') },
    { label: 'logP', raw: (m) => (m.logP !== null ? m.logP.toFixed(2) : '—') },
    {
      label: 'Stability Score',
      raw: (m) => String(m.stabilityScore),
      render: (m, isHigh, isLow) => (
        <span
          className={`inline-flex items-center gap-1 font-bold text-base ${
            isHigh ? 'text-emerald-600 dark:text-emerald-400'
            : isLow ? 'text-red-600 dark:text-red-400'
            : getScoreColor(m.stabilityScore)
          }`}
        >
          {isHigh && scores.length > 1 && <Trophy className="size-3.5" />}
          {isLow && scores.length > 1 && <AlertOctagon className="size-3.5" />}
          {m.stabilityScore}
          <span className="text-[10px] text-muted-foreground font-normal">/100</span>
        </span>
      ),
      num: (m) => m.stabilityScore,
    },
    {
      label: 'Risk Level',
      raw: (m) => m.riskLevel,
      render: (m) => <Badge className={`${riskColors[m.riskLevel]} capitalize`}>{m.riskLevel}</Badge>,
    },
    { label: 'Melting Point', raw: (m) => (m.meltingPoint !== null ? `${m.meltingPoint}°C` : '—') },
    { label: 'Boiling Point', raw: (m) => (m.boilingPoint !== null ? `${m.boilingPoint}°C` : '—') },
    { label: 'Data Source', raw: (m) => m.dataSource },
    {
      label: 'Description',
      raw: (m) => m.description || '—',
      render: (m) => (
        <span className="text-xs text-muted-foreground leading-relaxed block max-w-[260px]">
          {m.description || '—'}
        </span>
      ),
    },
  ]), [scores.length])

  // Build radar chart data — one entry per dimension, each molecule as a key
  const radarData = useMemo(() => {
    const dimensions = [
      { key: 'Stability' as const, accessor: (m: MoleculeData) => norm(m.stabilityScore, 'stabilityScore') },
      { key: 'logP' as const, accessor: (m: MoleculeData) => norm(m.logP, 'logP') },
      { key: 'Molar Mass' as const, accessor: (m: MoleculeData) => norm(m.molarMass, 'molarMass') },
      { key: 'Melting Pt' as const, accessor: (m: MoleculeData) => norm(m.meltingPoint, 'meltingPoint') },
    ]
    return dimensions.map((d) => {
      const row: Record<string, number | string> = { dimension: d.key }
      selectedMolecules.forEach((m, idx) => {
        row[`mol${idx}`] = d.accessor(m)
      })
      return row
    })
  }, [selectedMolecules])

  const handleExport = useCallback(() => {
    if (!selectedMolecules.length) {
      toast({ title: 'Nothing to export', description: 'No molecules selected for comparison' })
      return
    }
    const rows = selectedMolecules.map((m) => ({
      Name: m.name,
      'CAS Number': m.casNumber || '',
      Formula: m.formula || '',
      'Molar Mass': m.molarMass ?? '',
      logP: m.logP ?? '',
      'Stability Score': m.stabilityScore,
      'Risk Level': m.riskLevel,
      'Melting Point': m.meltingPoint ?? '',
      'Boiling Point': m.boilingPoint ?? '',
      'Data Source': m.dataSource,
      Description: m.description || '',
    }))
    exportCSV(rows, `chemstab-comparison-${new Date().toISOString().slice(0, 10)}.csv`)
    toast({
      title: 'Comparison exported',
      description: `Exported ${rows.length} molecule${rows.length !== 1 ? 's' : ''} to CSV`,
    })
  }, [selectedMolecules, toast])

  const handleClose = useCallback(() => {
    setCompareOpen(false)
  }, [setCompareOpen])

  return (
    <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-5xl md:max-w-5xl lg:max-w-5xl w-[calc(100%-2rem)] max-h-[92vh] overflow-y-auto p-0 gap-0 border-emerald-200/40 dark:border-emerald-800/40 shadow-2xl shadow-emerald-900/10"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GitCompareArrows className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              Molecule Comparison
            </span>
            <Badge variant="outline" className="ml-1 text-[10px]">
              {selectedMolecules.length} selected
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Side-by-side comparison of properties and normalized radar profile
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          {selectedMolecules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitCompareArrows className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No molecules selected. Pick 2-3 molecules from the table to compare.</p>
            </div>
          ) : (
            <>
              {/* Comparison Table */}
              <div className="rounded-lg border">
                <Table style={{ minWidth: `${140 + selectedMolecules.length * 220}px` }}>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[140px] sticky left-0 bg-muted/40 z-10">Property</TableHead>
                      {selectedMolecules.map((m, idx) => (
                        <TableHead key={m.id} className="min-w-[220px] align-top whitespace-normal">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: COMPARE_COLORS[idx] }}
                            />
                            <span className="font-semibold">{m.name}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propertyRows.map((row) => (
                      <TableRow key={row.label} className="even:bg-muted/20">
                        <TableCell className="font-medium text-xs text-muted-foreground uppercase tracking-wider sticky left-0 bg-background z-10">
                          {row.label}
                        </TableCell>
                        {selectedMolecules.map((m) => {
                          const isHigh = row.num ? row.num(m) === maxScore : false
                          const isLow = row.num ? row.num(m) === minScore : false
                          return (
                            <TableCell
                              key={m.id}
                              className={
                                row.label === 'Stability Score' && scores.length > 1
                                  ? isHigh
                                    ? 'bg-emerald-50/70 dark:bg-emerald-900/20'
                                    : isLow
                                      ? 'bg-red-50/70 dark:bg-red-900/20'
                                      : ''
                                  : ''
                              }
                            >
                              {row.render
                                ? row.render(m, isHigh, isLow)
                                : <span className="text-sm break-words whitespace-normal">{row.raw(m)}</span>}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Radar Chart */}
              {selectedMolecules.length >= 2 && (
                <div className="rounded-lg border p-4 bg-card/40">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold">Normalized Property Radar</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Each dimension normalized 0-100 against absolute reference ranges
                      </p>
                    </div>
                  </div>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer key={compareOpen ? 'open' : 'closed'} width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="72%">
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis
                          dataKey="dimension"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 100]}
                          tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                          tickCount={5}
                        />
                        {selectedMolecules.map((m, idx) => (
                          <Radar
                            key={m.id}
                            name={m.name}
                            dataKey={`mol${idx}`}
                            stroke={COMPARE_COLORS[idx]}
                            fill={COMPARE_COLORS[idx]}
                            fillOpacity={0.18}
                            strokeWidth={2}
                          />
                        ))}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                          iconType="circle"
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {selectedMolecules.length < 2 && (
                <div className="rounded-lg border p-4 bg-amber-50/40 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300">
                  Select at least 2 molecules to view the radar chart comparison.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/20 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clear() }}
            className="mr-auto text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <X className="size-4 mr-1" /> Clear Selection
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={selectedMolecules.length === 0}
          >
            <Download className="size-4 mr-1" /> Export Comparison
          </Button>
          <Button
            size="sm"
            onClick={handleClose}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
