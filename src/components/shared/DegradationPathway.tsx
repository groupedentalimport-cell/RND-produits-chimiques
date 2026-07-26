'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Atom, ChevronDown, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoleculeStructure } from './MoleculeStructure'
import {
  DEGRADATION_CONDITION_STYLES,
  HAZARD_BADGE_STYLES,
  formatFormula,
  type HazardLevel,
  type DegradationCondition,
} from '@/lib/sample-data'

// ── Types ────────────────────────────────────────────────────────────────

export interface DegradationProductInput {
  name: string
  smiles?: string
  percentage?: number | null
  hazardLevel?: HazardLevel | string
  condition?: DegradationCondition | string
  description?: string
}

export interface DegradationPathwayProps {
  moleculeName: string
  smiles?: string
  casNumber?: string
  formula?: string
  degradationProducts?: DegradationProductInput[]
  /** Compact rendering for narrow dialogs (smaller structures / no descriptions) */
  compact?: boolean
  /** Optional className applied to the outer wrapper */
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeCondition(c?: string): DegradationCondition | undefined {
  if (!c) return undefined
  const cap = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
  if (cap === 'Hydrolysis' || cap === 'Oxidation' || cap === 'Photolysis' || cap === 'Thermal') {
    return cap
  }
  return undefined
}

function normalizeHazard(h?: string): HazardLevel {
  if (h === 'low' || h === 'moderate' || h === 'high') return h
  if (h === 'critical') return 'high'
  return 'low'
}

// ── Layout constants ─────────────────────────────────────────────────────

const CONNECTOR_HEIGHT = 64        // SVG height in px (parent → bus → drops)
const STEM_END_Y = 22              // vertical stem from parent ends here
const DROP_END_Y = 50              // arrow tip Y position (above product card)

// ── Component ────────────────────────────────────────────────────────────

export function DegradationPathway({
  moleculeName,
  smiles,
  casNumber,
  formula,
  degradationProducts = [],
  compact = false,
  className = '',
}: DegradationPathwayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const products = degradationProducts
  const n = products.length

  // Decide number of grid columns based on container width and product count
  const effectiveCols =
    n === 0 ? 0
    : width === 0 ? n // SSR fallback (will recompute after mount)
    : width < 480 ? 1
    : width < 768 ? Math.min(2, n)
    : width < 1280 ? Math.min(3, n)
    : Math.min(n, 4)

  // X positions of the centers of the first row of product cards (px)
  const firstRowCount = Math.min(n, effectiveCols || n)
  const colWidth = effectiveCols > 0 ? width / effectiveCols : 0
  const productXs = Array.from(
    { length: firstRowCount },
    (_, i) => colWidth * (i + 0.5)
  )

  const parentExitX = width / 2
  const busLeftX = firstRowCount > 0 ? productXs[0] : parentExitX
  const busRightX = firstRowCount > 0 ? productXs[firstRowCount - 1] : parentExitX

  // ── Empty state ───────────────────────────────────────────────────────
  if (n === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={className}
      >
        <Card className="relative overflow-hidden border-dashed border-emerald-300/60 dark:border-emerald-700/50">
          <CardContent className="p-8 text-center relative">
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-6 left-10 size-8 rounded-full bg-emerald-200/30 dark:bg-emerald-800/30 blur-sm"
            />
            <motion.div
              animate={{ y: [4, -4, 4] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-8 right-12 size-6 rounded-full bg-teal-200/30 dark:bg-teal-800/30 blur-sm"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="flex justify-center mb-3"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <FlaskConical className="size-7 text-emerald-600 dark:text-emerald-400" />
              </div>
            </motion.div>
            <p className="font-medium text-foreground">No degradation pathway mapped</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              No degradation products are currently registered for{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{moleculeName}</span>.
              Add degradants via the form below or select another molecule to explore its pathway.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      {/* Parent molecule card (centered at top) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 }}
        className="flex justify-center"
      >
        <Card className="relative overflow-hidden border-emerald-300/60 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-900/15 dark:to-teal-900/10 max-w-md w-full">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
          <CardContent className={compact ? 'p-3' : 'p-4'}>
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <Atom className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm sm:text-base truncate">
                    {moleculeName}
                  </h3>
                  <Badge variant="outline" className="text-[10px] border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                    Parent
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                  {formula && <span className="font-mono">{formatFormula(formula)}</span>}
                  {casNumber && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="font-mono">CAS {casNumber}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {smiles && (
              <div className="mt-3">
                <MoleculeStructure
                  smiles={smiles}
                  width={compact ? 260 : 320}
                  height={compact ? 110 : 140}
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SVG connector area: parent → bus → drops (with arrowheads) */}
      <div
        className="relative w-full"
        style={{ height: CONNECTOR_HEIGHT }}
        aria-hidden="true"
      >
        {width > 0 ? (
          <svg
            width={width}
            height={CONNECTOR_HEIGHT}
            className="block"
            style={{ overflow: 'visible' }}
          >
            {/* Parent stem (centered, neutral teal) */}
            <line
              x1={parentExitX}
              y1={0}
              x2={parentExitX}
              y2={STEM_END_Y}
              stroke="currentColor"
              strokeWidth={2}
              className="text-emerald-400/80 dark:text-emerald-500/70"
            />
            {/* Horizontal bus connecting all first-row drop points */}
            {firstRowCount > 1 && (
              <line
                x1={busLeftX}
                y1={STEM_END_Y}
                x2={busRightX}
                y2={STEM_END_Y}
                stroke="currentColor"
                strokeWidth={2}
                className="text-emerald-400/80 dark:text-emerald-500/70"
              />
            )}
            {/* Drops + arrowheads, color-coded by condition */}
            {productXs.map((px, i) => {
              const prod = products[i]
              const cond =
                normalizeCondition(prod?.condition as string | undefined) || 'Hydrolysis'
              const style = DEGRADATION_CONDITION_STYLES[cond]
              return (
                <g key={`drop-${i}`}>
                  <line
                    x1={px}
                    y1={STEM_END_Y}
                    x2={px}
                    y2={DROP_END_Y}
                    stroke={style.stroke}
                    strokeWidth={2}
                  />
                  {/* Arrowhead */}
                  <polygon
                    points={`${px},${DROP_END_Y + 6} ${px - 5},${DROP_END_Y - 2} ${px + 5},${DROP_END_Y - 2}`}
                    fill={style.stroke}
                  />
                </g>
              )
            })}
          </svg>
        ) : (
          // Placeholder to prevent layout shift before ResizeObserver fires
          <div className="h-full w-full" />
        )}

        {/* Condition label pills — overlaid above each drop arrow tip */}
        {width > 0 && productXs.map((px, i) => {
          const prod = products[i]
          const cond =
            normalizeCondition(prod?.condition as string | undefined) || 'Hydrolysis'
          const style = DEGRADATION_CONDITION_STYLES[cond]
          return (
            <div
              key={`cond-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border shadow-sm bg-background/95 backdrop-blur-sm border-border/60 whitespace-nowrap"
              style={{
                left: px,
                top: (STEM_END_Y + DROP_END_Y) / 2,
              }}
            >
              <span className={`inline-block size-1.5 rounded-full ${style.dot} mr-1.5`} />
              <span className="text-foreground/80">{style.label}</span>
            </div>
          )
        })}
      </div>

      {/* Product cards grid */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${effectiveCols || n}, minmax(0, 1fr))`,
        }}
      >
        {products.map((p, i) => {
          const cond = normalizeCondition(p.condition as string | undefined) || 'Hydrolysis'
          const condStyle = DEGRADATION_CONDITION_STYLES[cond]
          const hazard = normalizeHazard(p.hazardLevel as string | undefined)
          const hazardStyle = HAZARD_BADGE_STYLES[hazard]
          const pct = typeof p.percentage === 'number' ? p.percentage : null
          return (
            <motion.div
              key={`prod-${i}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              className="h-full"
            >
              <Card className="h-full overflow-hidden border-border/70 bg-card/95 backdrop-blur-sm hover:shadow-md hover:border-emerald-300/60 dark:hover:border-emerald-700/50 transition-all">
                {/* Top color bar matching the degradation condition */}
                <div
                  className="h-0.5 w-full"
                  style={{ backgroundColor: condStyle.stroke }}
                />
                <CardContent className={compact ? 'p-3' : 'p-4'}>
                  {/* Header: name + condition badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                      {p.name}
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${condStyle.badge} border-current/30`}
                    >
                      {condStyle.label}
                    </Badge>
                  </div>

                  {/* 2D structure */}
                  {p.smiles ? (
                    <MoleculeStructure
                      smiles={p.smiles}
                      width={compact ? 200 : 240}
                      height={compact ? 90 : 110}
                      className="w-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center bg-muted/30 rounded-lg border border-border/40 text-muted-foreground text-[10px]"
                      style={{ height: compact ? 90 : 110 }}
                    >
                      No structure
                    </div>
                  )}

                  {/* Badges row: percentage + hazard */}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {pct !== null ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] tabular-nums bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      >
                        {pct}%
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Yield not specified</span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${hazardStyle}`}
                    >
                      {hazard} hazard
                    </Badge>
                  </div>

                  {/* Optional description */}
                  {!compact && p.description && (
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                        {p.description}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Legend (only on non-compact mode) */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 + n * 0.08 }}
          className="mt-4 flex items-center justify-center gap-3 flex-wrap text-[10px] text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Info className="size-3" />
            Conditions:
          </span>
          {(Object.keys(DEGRADATION_CONDITION_STYLES) as DegradationCondition[]).map((c) => {
            const s = DEGRADATION_CONDITION_STYLES[c]
            return (
              <span key={c} className="flex items-center gap-1.5">
                <span className={`inline-block size-2 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            )
          })}
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-1.5">
            <ChevronDown className="size-3" />
            Indicates direction of degradation
          </span>
        </motion.div>
      )}
    </div>
  )
}
