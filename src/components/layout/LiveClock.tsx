'use client'

import { useSyncExternalStore } from 'react'
import { Clock } from 'lucide-react'

/**
 * Live clock display — updates every second. Shows HH:MM:SS in a subtle pill.
 * Uses useSyncExternalStore (the React-recommended way to subscribe to an
 * external "system" — here, the wall clock) so we get clean SSR + no
 * hydration mismatch and no cascading renders.
 */
function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000)
  return () => clearInterval(id)
}
function getSnapshot() {
  return Date.now()
}
function getServerSnapshot() {
  return 0
}

export function LiveClock() {
  const ts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const time = ts > 0
    ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--'

  return (
    <div
      className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-muted/30 text-[11px] font-mono tabular-nums text-muted-foreground"
      aria-label={`Current time ${time}`}
      suppressHydrationWarning
    >
      <Clock className="size-3 text-emerald-500" />
      <span suppressHydrationWarning>{time}</span>
    </div>
  )
}
