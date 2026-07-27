# Task 7-b — Study Timeline View + Enhanced Notifications

**Agent:** full-stack-developer
**Task:** Add a Gantt-style Study Timeline view to the Studies page and completely revamp the Notifications center.

## Files I Own (exclusive)

- `src/components/pages/StudiesPage.tsx` — added view toggle + integrated the new timeline view
- `src/components/layout/NotificationsButton.tsx` — full rewrite as rich notification center

## Files I Created

- `src/components/pages/StudyTimeline.tsx` — new Gantt-style timeline sub-component used by StudiesPage

## Files I Appended To (append-only, per task rules)

- `src/lib/sample-data.ts` — added `AppNotification` interface, `SAMPLE_NOTIFICATIONS` (10 entries), `NOTIF_CATEGORY_ICON` / `NOTIF_CATEGORY_LABEL` / `NOTIF_SEVERITY_BG` maps, and `formatRelativeTime()` helper. Also added `Cpu` to the lucide-react import.
- `src/lib/store.ts` — added `useNotificationStore` (notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, addNotification). Initialized with `SAMPLE_NOTIFICATIONS` (first 5 already unread in sample data). `unreadCount` auto-recomputed by every mutator.

## Architecture Notes

### Study Timeline (Feature 1)

`StudiesPage.tsx` adds a `view` state (`'list' | 'timeline'`, default `'list'`) and a `ToggleGroup` next to the existing Status filter. The existing studies table Card is wrapped in `{view === 'list' && (...)}` — every line of the existing list view is preserved verbatim. When `view === 'timeline'`, `<StudyTimeline studies={apiStudies} onBarClick={openDetail} />` is rendered instead, reading from the SAME `apiStudies` state the list view uses — so both views stay in sync with the same status / type filters and the same refresh action.

`StudyTimeline.tsx`:
- Uses the current year dynamically so the "today" line always lands inside the chart
- Each study gets `startMonth = (idx * 2) % 10` (capped at 11) so bars are spread across the year
- Bar width = `durationMonths * 96px`, capped so it stays inside the visible year
- Status → color: draft=slate-400, in_progress=teal-500, under_review=amber-500, completed=emerald-500, approved=emerald-600, rejected=red-500 (NO indigo/blue)
- Hovering a bar opens a shadcn Tooltip with full study details; clicking calls the parent's `openDetail()` so the same study detail dialog (timepoints + signatures + status actions) opens
- "Today" line in rose-500 with gradient + pill label
- Subtle grid: vertical month dividers + 3 alternating quarter-tinted bands
- Horizontally scrollable (`overflow-x-auto`), sticky month axis header inside the scroll
- Bars animate in with framer-motion: `initial={{opacity:0, scaleX:0}} animate={{opacity:1, scaleX:1}}`, staggered delay `0.1 + idx*0.08`, transformOrigin 'left center'

### Enhanced Notifications (Feature 2)

`NotificationsButton.tsx` (full rewrite, 90 → 220 lines):
- Bell button: wobble animation when unread, red badge with count (or "9+") + pulsing `animate-ping` ring + drop shadow
- Popover (`align=end`, `w-96 max-w-[calc(100vw-2rem)] p-0` — responsive w-96 desktop / capped viewport mobile)
- Header: title + emerald "N unread" pill + "Mark all read" button
- Category filter pills: All / Studies / Molecules / Reports / System / Alerts
- Scrollable list (`max-h-96 overflow-y-auto`) of cards:
  - `border-l-2`: red for critical, emerald for unread, transparent for read
  - Category icon chip with severity-colored bg (cyan/emerald/amber/red)
  - Title (semibold) + message (muted, line-clamp-3)
  - Relative timestamp (mono) via `formatRelativeTime`
  - Action button (emerald) if `actionLabel` + `actionPage` — navigates via `useAppStore.setPage`, marks read, closes popover
  - Dismiss (X) button on hover
  - Unread indicator: small emerald dot (size-1.5) in left padding area with glow
  - Critical indicator: pulsing red dot (size-2 + animate-ping ring)
  - framer-motion `layout` + initial/animate/exit for smooth filtering + dismissing
- Empty state: Inbox icon + context-aware message
- Footer: "View all notifications" (navigates to admin) + "Preferences" (visual only)
- Subscribes to `notifications` / `unreadCount` / mutators via separate zustand selectors (prevents re-renders on unrelated state)

## Verification

- `bun run lint` → 0 errors, 0 warnings
- `curl http://localhost:3000` → HTTP 200 across 3 consecutive checks
- dev.log shows multiple `✓ Compiled in ...` entries after file edits, no errors/warnings

## Things to Watch Out For

- The timeline uses the CURRENT year dynamically. If the user runs this in 2025, the bars will be positioned in 2025 even though the sample study codes say "STB-2024-XXX". This is intentional so the Today line is always meaningful.
- The "View all notifications" footer link navigates to the admin page (which has the audit log section) — there's no dedicated notifications page. The "Preferences" link is visual-only per the task spec.
- Sample notification timestamps are computed at module-load time via `_mins`/`_hrs`/`_days` helpers so the relative-time labels stay fresh whenever the app is opened.
