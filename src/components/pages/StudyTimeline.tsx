'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip'
import { studyTypeLabels, statusColors } from '@/lib/sample-data'
import type { StudyData } from '@/lib/types'

// ── Status → bar background + ring colors (NO indigo or blue) ─────────────
const STATUS_BAR: Record<string, { bg: string; ring: string; label: string }> = {
  draft:        { bg: 'bg-slate-400',   ring: 'ring-slate-500/40',   label: 'Draft' },
  in_progress:  { bg: 'bg-teal-500',    ring: 'ring-teal-500/40',    label: 'In Progress' },
  under_review: { bg: 'bg-amber-500',   ring: 'ring-amber-500/40',   label: 'Under Review' },
  completed:    { bg: 'bg-emerald-500', ring: 'ring-emerald-500/40', label: 'Completed' },
  approved:     { bg: 'bg-emerald-600', ring: 'ring-emerald-600/40', label: 'Approved' },
  rejected:     { bg: 'bg-red-500',     ring: 'ring-red-500/40',     label: 'Rejected' },
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_WIDTH = 96          // px per month column
const TIMELINE_WIDTH = MONTH_WIDTH * 12   // 1152px
const ROW_HEIGHT = 52
const ROW_GAP = 10

interface StudyTimelineProps {
  studies: StudyData[]
  onBarClick: (study: StudyData) => void
}

export function StudyTimeline({ studies, onBarClick }: StudyTimelineProps) {
  // Use the current year so the "today" indicator always lands inside the chart.
  const year = useMemo(() => new Date().getFullYear(), [])

  // Today position (fractional months from start of year)
  const todayMonth = useMemo(() => {
    const now = new Date()
    if (now.getFullYear() !== year) return 5.5 // fallback: late spring
    return now.getMonth() + Math.min(1, (now.getDate() - 1) / 30)
  }, [year])

  // Build display rows: assign each study a startMonth derived from its index
  // (spread across the year so bars don't all stack on top of each other).
  const rows = useMemo(() => {
    return studies.map((study, idx) => {
      const startMonth = Math.min(11, (idx * 2) % 10)
      // Cap displayed duration so it stays inside the visible year
      const dur = Math.max(1, Math.min(12 - startMonth, study.durationMonths))
      return { study, idx, startMonth, dur }
    })
  }, [studies])

  const totalHeight = Math.max(120, rows.length * (ROW_HEIGHT + ROW_GAP) + 16)

  return (
    <Card className="backdrop-blur-sm bg-card/80 overflow-hidden">
      <CardContent className="p-0">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b bg-gradient-to-r from-emerald-50/40 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Calendar className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-gradient-emerald">{year} Timeline</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 ml-1">
            {Object.entries(STATUS_BAR).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`size-3 rounded-sm ${v.bg}`} />
                <span className="text-xs text-muted-foreground">{v.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-px h-3 bg-rose-500" />
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
        </div>

        {/* Timeline scroll area */}
        <div className="overflow-x-auto">
          <div className="relative" style={{ width: TIMELINE_WIDTH, minWidth: '100%' }}>
            {/* Month axis header (sticky inside horizontal scroll) */}
            <div className="sticky top-0 z-30 flex h-9 border-b bg-card/95 backdrop-blur">
              {MONTH_LABELS.map((m, i) => (
                <div
                  key={m}
                  className="flex items-center justify-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
                  style={{ width: MONTH_WIDTH }}
                >
                  <span>{m}</span>
                  {i === 0 && <span className="ml-1 text-[10px] text-muted-foreground/60">{year}</span>}
                </div>
              ))}
            </div>

            {/* Grid + bars canvas */}
            <div className="relative" style={{ height: totalHeight }}>
              {/* Vertical grid dividers (subtle) */}
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={`grid-${i}`}
                  className={`absolute top-0 bottom-0 border-r last:border-r-0 ${
                    i % 3 === 2 ? 'border-muted/40' : 'border-muted/20'
                  }`}
                  style={{ left: i * MONTH_WIDTH, width: MONTH_WIDTH }}
                />
              ))}

              {/* Alternating quarter-tinted bands for readability */}
              {[0, 4, 8].map((i) => (
                <div
                  key={`band-${i}`}
                  className="absolute top-0 bottom-0 bg-muted/10"
                  style={{ left: i * MONTH_WIDTH, width: MONTH_WIDTH * 3 }}
                />
              ))}

              {/* Today vertical line indicator */}
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: todayMonth * MONTH_WIDTH }}
              >
                <div className="w-px h-full bg-gradient-to-b from-rose-500 via-rose-500/70 to-rose-500/30" />
                <div className="absolute top-1.5 -translate-x-1/2 left-0 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-md shadow-rose-500/30 whitespace-nowrap">
                  Today
                </div>
              </div>

              {/* Study bars */}
              {rows.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="size-6 opacity-50" />
                  <span>No studies to display on the timeline</span>
                </div>
              ) : (
                rows.map(({ study, idx, startMonth, dur }) => {
                  const style = STATUS_BAR[study.status] || STATUS_BAR.draft
                  return (
                    <motion.div
                      key={study.id}
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.1 + idx * 0.08,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      style={{
                        position: 'absolute',
                        top: idx * (ROW_HEIGHT + ROW_GAP) + 10,
                        left: startMonth * MONTH_WIDTH,
                        width: dur * MONTH_WIDTH,
                        height: ROW_HEIGHT,
                        transformOrigin: 'left center',
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onBarClick(study)}
                            className={`group w-full h-full rounded-md ${style.bg} text-white px-3 flex items-center gap-2 ring-2 ${style.ring} hover:brightness-110 hover:shadow-lg hover:shadow-black/15 hover:-translate-y-0.5 transition-all cursor-pointer focus:outline-none focus:ring-4`}
                            aria-label={`Open study ${study.studyCode} details`}
                          >
                            <span className="font-mono text-xs font-bold truncate drop-shadow-sm">
                              {study.studyCode}
                            </span>
                            <span className="hidden sm:inline text-xs font-medium truncate opacity-90">
                              · {study.substanceName}
                            </span>
                            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/20 shrink-0 flex items-center gap-0.5">
                              {dur}mo <ChevronRight className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold">{study.studyCode}</span>
                              <Badge className={statusColors[study.status]}>
                                {study.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="text-xs font-medium opacity-95">{study.substanceName}</div>
                            <div className="text-[10px] opacity-80 space-y-0.5">
                              <div>Type: {studyTypeLabels[study.studyType] || study.studyType}</div>
                              <div>Start: {MONTH_LABELS[startMonth]} {year}</div>
                              <div>Duration: {study.durationMonths} months (showing {dur}mo)</div>
                              <div>Temperature: {study.temperatureC}°C</div>
                              {study.humidityPercent !== null && (
                                <div>Humidity: {study.humidityPercent}%</div>
                              )}
                              {study.ph !== null && <div>pH: {study.ph.toFixed(1)}</div>}
                              {study.predictedShelfLifeMonths !== null && (
                                <div>Predicted shelf life: {study.predictedShelfLifeMonths} months</div>
                              )}
                            </div>
                            <div className="text-[10px] opacity-60 pt-1 border-t border-white/20">
                              Click to view full study details
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3 text-emerald-600 dark:text-emerald-400" />
            {rows.length} stud{rows.length === 1 ? 'y' : 'ies'} · {MONTH_LABELS[0]}–{MONTH_LABELS[11]} {year}
          </span>
          <span className="italic opacity-70 hidden sm:inline">Click any bar to view study details · Scroll horizontally to see all months</span>
        </div>
      </CardContent>
    </Card>
  )
}
