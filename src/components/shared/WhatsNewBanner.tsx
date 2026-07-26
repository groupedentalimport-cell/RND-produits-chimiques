'use client'

/**
 * WhatsNewBanner
 *
 * A dismissible, persisted announcement banner that surfaces new features
 * to users. Each announcement has a unique `id`; once dismissed, the id is
 * stored in localStorage so the banner won't reappear until a new
 * announcement is published.
 *
 * Renders as a sliding, gradient-bordered banner at the top of the main
 * content area (above the page content). Multiple announcements are shown
 * in sequence via a small pager.
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ChevronRight, ChevronLeft, ClipboardCheck, Zap, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import type { PageId } from '@/lib/types'

interface Announcement {
  id: string
  icon: React.ElementType
  iconBg: string
  title: string
  body: string
  ctaLabel?: string
  ctaPage?: PageId
  badge?: string
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2026-03-compliance-checker',
    icon: ClipboardCheck,
    iconBg: 'from-emerald-500 to-teal-600',
    title: 'New: ICH Q1A Compliance Checker',
    body: 'Run automated compliance checks against ICH Q1A(R2), Q1B, Q9, and 21 CFR Part 11 — 16 weighted rules, animated score ring, printable certificate, and category breakdown.',
    ctaLabel: 'Try it now',
    ctaPage: 'compliance',
    badge: 'NEW',
  },
  {
    id: '2026-03-realtime-notifications',
    icon: Zap,
    iconBg: 'from-cyan-500 to-emerald-500',
    title: 'Real-time notifications are live',
    body: 'The ChemStab notifications service now streams study completions, risk alerts, and report-ready events straight to your bell icon — no refresh needed.',
    badge: 'LIVE',
  },
  {
    id: '2026-03-stability-calculator',
    icon: Shield,
    iconBg: 'from-teal-500 to-cyan-600',
    title: 'Arrhenius stability calculator',
    body: 'Predict shelf life from activation energy, rate constant, and temperature. Visualize the degradation curve and 10% threshold directly in the Simulator.',
    ctaLabel: 'Open Simulator',
    ctaPage: 'simulator',
    badge: 'FEATURE',
  },
]

const STORAGE_KEY = 'chemstab-whats-new-dismissed'

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // ignore quota errors
  }
}

export function WhatsNewBanner() {
  const { setPage } = useAppStore()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)
  const [idx, setIdx] = useState(0)

  // Hydrate from localStorage on mount (client-only).
  // This is the canonical "subscribe to external system (localStorage)" pattern
  // — setState here is intentional and unavoidable for SSR-safe hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissed())
    setHydrated(true)
  }, [])

  // Filter to non-dismissed announcements
  const visible = useMemo(
    () => ANNOUNCEMENTS.filter((a) => !dismissed.has(a.id)),
    [dismissed],
  )

  // Clamp the pager index into bounds — derived during render to avoid
  // setState-in-effect. If idx is out of bounds, fall back to the last
  // available item.
  const safeIdx = visible.length === 0 ? 0 : Math.min(idx, visible.length - 1)

  const dismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    saveDismissed(next)
  }

  const dismissAll = () => {
    const next = new Set(ANNOUNCEMENTS.map((a) => a.id))
    setDismissed(next)
    saveDismissed(next)
  }

  // Don't render until hydrated (avoids SSR/CSR mismatch) or if all dismissed
  if (!hydrated || visible.length === 0) return null

  const current = visible[safeIdx]
  if (!current) return null

  const Icon = current.icon
  const hasPager = visible.length > 1

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative mb-4 overflow-hidden"
      >
        <div className="relative rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/20 shadow-sm">
          {/* Animated gradient top accent */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          {/* Subtle shimmer sweep */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          />

          <div className="relative flex items-center gap-3 p-3 pr-2">
            {/* Icon */}
            <div className={`shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${current.iconBg} flex items-center justify-center shadow-md shadow-emerald-500/20`}>
              <Icon className="size-5 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-sm">{current.title}</p>
                {current.badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-white">
                    {current.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
                {current.body}
              </p>
            </div>

            {/* CTA */}
            {current.ctaLabel && current.ctaPage && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 hidden sm:flex gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                onClick={() => {
                  setPage(current.ctaPage!)
                  dismiss(current.id)
                }}
              >
                <Sparkles className="size-3.5" />
                {current.ctaLabel}
              </Button>
            )}

            {/* Pager (only when more than one visible) */}
            {hasPager && (
              <div className="shrink-0 hidden md:flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setIdx((i) => (i - 1 + visible.length) % visible.length)}
                  aria-label="Previous announcement"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums px-1">
                  {safeIdx + 1}/{visible.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setIdx((i) => (i + 1) % visible.length)}
                  aria-label="Next announcement"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            {/* Dismiss */}
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 size-7 text-muted-foreground hover:text-foreground"
              onClick={() => dismiss(current.id)}
              aria-label="Dismiss announcement"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Dismiss-all footer link */}
          {hasPager && (
            <button
              type="button"
              onClick={dismissAll}
              className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              Dismiss all
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
