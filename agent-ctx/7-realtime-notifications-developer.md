# Task 7 — Real-Time Notifications WebSocket Mini-Service

## Agent: realtime-notifications-developer
## Task ID: 7

## Summary
Created a real-time notifications WebSocket mini-service for the ChemStab platform. The service pushes simulated pharmaceutical events (study completions, risk alerts, new molecules, report readiness, system maintenance, audit-log thresholds) to all connected frontends. The frontend connects via the Caddy gateway using `io("/?XTransformPort=3003")`, receives `notification` events, merges them into the existing `useNotificationStore`, and displays a live connection status indicator in the header.

## Files Created / Modified

### 1. `/home/z/my-project/mini-services/notifications-service/package.json` (new)
- Independent bun project (`"type": "module"`)
- Scripts: `dev` → `bun --hot index.ts` (auto-restart), `start` → `bun index.ts`
- Dependencies: `socket.io@^4.8.3`, `express@^5.2.1`
- DevDeps: `@types/bun`, `@types/express`

### 2. `/home/z/my-project/mini-services/notifications-service/index.ts` (new, ~310 lines)
- Hardcoded port `3003` (NOT from env)
- Socket.io server with `path: '/'` (REQUIRED for Caddy forwarding)
- CORS: `origin: '*'`, methods `['GET', 'POST']`
- `pingTimeout: 60s`, `pingInterval: 25s`, `connectTimeout: 10s`
- Tracks connected clients in a `Map<socketId, { id, connectedAt, userAgent }>`
- Logs `[CONNECT]`, `[DISCONNECT]`, `[SOCKET-ERROR]` events
- Periodic status logger every 60s
- **Periodic broadcaster**: every 30–60s (random), builds a realistic notification and `io.emit('notification', n)` to all connected clients. Skips broadcasting when no clients are connected.
- Realistic pharmaceutical notification templates covering all required event types:
  - `study/success` — "Study STB-2024-XXX completed" (6 study codes × 4 completion messages)
  - `alert/critical` — "Risk alert: Hydrogen Peroxide stability score dropped" (4 molecules × 4 risk messages)
  - `molecule/info` — "New molecule registered" (8 molecules)
  - `report/success` — "ICH Q1A report ready for review" (5 report types)
  - `system/warning` — "System maintenance scheduled" (5 maintenance tasks)
  - `system/warning` — "Audit log threshold reached" (4 audit thresholds)
- Each notification has: `id`, `title`, `message`, `category`, `severity`, `timestamp` (ISO), `read: false`, optional `actionLabel` + `actionPage`
- Supports `request-notification` client event for on-demand testing
- Emits `connected` welcome event on socket connection
- Graceful shutdown via SIGTERM/SIGINT

### 3. `/home/z/my-project/src/hooks/use-realtime-notifications.ts` (new, ~165 lines)
- `'use client'` hook: `useRealtimeNotifications(): ConnectionStatus`
- Returns `'connecting' | 'connected' | 'disconnected'`
- Connects via `io('/?XTransformPort=3003', { path: '/', transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 15000, timeout: 10000, autoConnect: true })`
- **CRITICAL**: Uses relative path `/` + `XTransformPort=3003` query — NEVER direct `http://localhost:3003`
- Listens for `notification` events from the server
- Respects user preferences from `usePreferencesStore`:
  - If `notificationsEnabled === false` → drops all incoming notifications
  - If specific category is disabled → drops that category
  - Category mapping: `study→studies`, `molecule→molecules`, `report→reports`, `system→system`, `alert→alerts`
- Merges incoming notifications into `useNotificationStore.addNotification()`
- Connection status updates on connect/disconnect/reconnect_attempt/connect_error events
- Cleanup: `socket.removeAllListeners()` + `socket.disconnect()` on unmount

### 4. `/home/z/my-project/src/app/page.tsx` (modified)
- Added imports: `Tooltip, TooltipTrigger, TooltipContent`, `useRealtimeNotifications`
- Added `const connectionStatus = useRealtimeNotifications()` at the top of `Home()`
- Added `rtIndicator` derived object mapping status → `{ dotClass, pingClass, label, description }`
  - `connected` → green dot with pulse, "Real-time: Live"
  - `connecting` → amber dot with pulse, "Real-time: Connecting…"
  - `disconnected` → red dot (no pulse), "Real-time: Disconnected"
- Added a real-time connection indicator button in the header (between "All systems operational" pill and the Search button):
  - `hidden lg:flex` — only visible on desktop
  - Pulse animation (`animate-ping`) when connected or connecting
  - Tooltip showing label + description (shadcn Tooltip component)
  - `aria-label` for accessibility

## Dependencies Installed
- Main project: `socket.io@4.8.3`, `socket.io-client@4.8.3`
- Mini-service: `socket.io@4.8.3`, `express@5.2.1`, `@types/express@5.0.6` (dev)

## Verification
- `bun run lint` — 0 errors, 0 warnings ✓
- Next.js dev server on port 3000 — `GET / 200` ✓
- Notifications service on port 3003 — listening, socket.io handshake returns 200 with valid SID ✓
- Caddy gateway forwarding works — `GET http://localhost:81/?XTransformPort=3003&EIO=4&transport=polling` returns 200 ✓
- End-to-end integration confirmed — service log shows `[NOTIFY-BROADCAST] "Study STB-2024-007 completed" | study/success | recipients=1` (real browser client connected and received a broadcast) ✓
- Auto-restart verified — editing `index.ts` triggered `bun --hot` to reload the service cleanly ✓

## Service Management
- Started in background: `cd /home/z/my-project/mini-services/notifications-service && nohup bun --hot index.ts > service.log 2>&1 &`
- PID: 4075
- Log file: `/home/z/my-project/mini-services/notifications-service/service.log`

## Gateway Rules Compliance
✓ Frontend connects using `io("/?XTransformPort=3003")` — NEVER `io("http://localhost:3003")`
✓ Path is always `/` so Caddy can forward correctly
✓ All API requests use relative paths only
✓ Mini-service uses hardcoded port 3003 (not from env)

## Notes / Decisions
- The mini-service does not expose separate HTTP `/health` endpoints because socket.io's `path: '/'` config causes engine.io to intercept ALL HTTP requests on port 3003. Service health is verified via the socket.io polling handshake (`GET /?EIO=4&transport=polling` returns 200 with `{"sid":"...","upgrades":["websocket"],...}`) and the periodic `[STATUS]` log line.
- Express is installed in the mini-service per task requirements but is not actively used for routing — the service is a pure socket.io server.
- The hook reads `usePreferencesStore.getState()` *inside* the `notification` handler (rather than subscribing reactively) so the socket lifecycle is decoupled from preference changes — preferences take effect immediately on the next incoming notification without re-creating the socket.
- Initial state of the hook is `'connecting'` — no `setState` is called synchronously inside the effect (avoids the `react-hooks/set-state-in-effect` lint error).

## Other Agents — Please Note
- The notifications service is running on port 3003 (PID 4075). Logs at `/home/z/my-project/mini-services/notifications-service/service.log`.
- The Next.js dev server was found stopped (EADDRINUSE during init re-run) and was manually restarted with `nohup bun run dev > /home/z/my-project/dev.log 2>&1 &`. New PID: 4967.
- The frontend hook is wired into `Home()` in `src/app/page.tsx` — any future changes to the header layout should preserve the `useRealtimeNotifications()` call and the `<Tooltip>` indicator block.
- Notifications flow into `useNotificationStore` (defined in `src/lib/store.ts`) and appear in the existing `NotificationsButton` bell dropdown automatically — no extra UI work needed to display them.
