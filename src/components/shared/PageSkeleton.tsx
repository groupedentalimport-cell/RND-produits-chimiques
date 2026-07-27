'use client'

/**
 * Reusable shimmer loading skeleton for full-page transitions.
 * Renders a sidebar rail, header bar, and a grid of pulsing/shimmering cards.
 * Uses the .shimmer animation defined in globals.css.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* Title block */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md shimmer" />
        <div className="h-4 w-72 rounded-md shimmer" />
      </div>

      {/* 5 KPI card skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500/40 to-teal-500/40" />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-20 rounded shimmer" />
                  <div className="h-5 w-16 rounded shimmer" />
                </div>
                <div className="size-9 rounded-lg shimmer" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-24 rounded shimmer" />
                <div className="h-6 w-16 rounded shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column chart skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="h-4 w-40 rounded shimmer" />
            <div className="h-3 w-56 rounded shimmer" />
            <div className="h-[260px] w-full rounded-md shimmer" />
          </div>
        ))}
      </div>

      {/* Activity + sidebar skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border/60 p-4 space-y-3">
          <div className="h-4 w-32 rounded shimmer" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-2.5 rounded-full shimmer" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded shimmer" />
                <div className="h-2.5 w-1/4 rounded shimmer" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <div className="h-4 w-28 rounded shimmer" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-md shimmer" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
