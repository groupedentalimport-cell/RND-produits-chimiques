/**
 * ChemStab Notifications Mini-Service
 *
 * Real-time WebSocket service that pushes simulated pharmaceutical events
 * (study completions, risk alerts, new molecules, report readiness, system
 * maintenance, audit-log thresholds) to all connected ChemStab frontends.
 *
 * Gateway rules:
 *  - The Caddy gateway forwards traffic based on the `XTransformPort=3003`
 *    query parameter. The client only ever connects to
 *    `/?XTransformPort=3003` (path MUST be `/`).
 *  - This server exposes socket.io on path `/` so the gateway can forward.
 *
 * Note: Because socket.io's `path` is `/`, engine.io intercepts ALL HTTP
 * requests on this port — so we do not expose separate express HTTP routes.
 * Service health is verified via the socket.io handshake (HTTP 200 with
 * `{"sid":"...","upgrades":["websocket"],...}` when polling
 * `/?EIO=4&transport=polling`) and via the periodic status log line.
 *
 * Port: 3003 (hardcoded — NOT from env)
 */

import { createServer } from 'http'
import { Server } from 'socket.io'

// ── Types ────────────────────────────────────────────────────────────────────

type NotificationCategory = 'study' | 'molecule' | 'report' | 'system' | 'alert'
type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical'

interface ChemStabNotification {
  id: string
  title: string
  message: string
  category: NotificationCategory
  severity: NotificationSeverity
  timestamp: string // ISO 8601
  read: boolean
  actionLabel?: string
  actionPage?: 'dashboard' | 'molecules' | 'simulator' | 'studies' | 'reports' | 'analytics' | 'degradation' | 'admin'
}

interface ConnectedClient {
  id: string
  connectedAt: Date
  userAgent?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const PORT = 3003 // hardcoded per requirements

const MIN_INTERVAL_MS = 30_000 // 30 seconds
const MAX_INTERVAL_MS = 60_000 // 60 seconds

// ── HTTP server (raw — engine.io will intercept everything on path `/`) ─────

const httpServer = createServer()

// ── Socket.io Server (path MUST be `/` for Caddy) ───────────────────────────

const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  connectTimeout: 10_000,
})

// ── Connected client tracking ────────────────────────────────────────────────

const connectedClients = new Map<string, ConnectedClient>()

// ── Notification generator ───────────────────────────────────────────────────

const STUDY_CODES = [
  'STB-2024-001',
  'STB-2024-007',
  'STB-2024-012',
  'STB-2024-019',
  'STB-2024-024',
  'STB-2024-031',
]

const MOLECULES = [
  { name: 'Aspirin', formula: 'C₉H₈O₄' },
  { name: 'Hydrogen Peroxide', formula: 'H₂O₂' },
  { name: 'Formaldehyde', formula: 'CH₂O' },
  { name: 'Caffeine', formula: 'C₈H₁₀N₄O₂' },
  { name: 'Ibuprofen', formula: 'C₁₃H₁₈O₂' },
  { name: 'Paracetamol', formula: 'C₈H₉NO₂' },
  { name: 'Metformin', formula: 'C₄H₁₁N₅' },
  { name: 'Omeprazole', formula: 'C₁₇H₁₉N₃O₃S' },
]

const REPORT_TYPES = [
  'ICH Q1A',
  'CTD Module 3',
  'FMEA Report',
  'DoE Analysis',
  'Validation Protocol',
]

const MAINTENANCE_TASKS = [
  'Database backup and vacuum',
  'ML model retraining pipeline',
  'Audit log archival',
  'Cache warmup and index rebuild',
  'Compliance certification renewal',
]

const AUDIT_THRESHOLDS = [
  '10,000 audit entries logged in the past 24 hours',
  '50 failed authentication attempts detected',
  '100 data export operations recorded today',
  'Unusual admin privilege escalation pattern detected',
]

const STUDY_COMPLETION_MESSAGES = [
  'long-term stability study (24 months) has finished data collection. Predicted shelf life: 36 months.',
  'accelerated stability study completed. No significant degradation observed at 40°C/75% RH over 6 months.',
  'intermediate study (12 months, 30°C/65% RH) concluded. Predicted shelf life extended to 48 months.',
  'photostability study (ICH Q1B) finished — no photodegradation products above qualification threshold.',
]

const RISK_ALERT_MESSAGES = [
  'stability score dropped from 78 to 41 — exceeds OOS threshold. Immediate review required.',
  'assay value fell below 90% of label claim at the 18-month timepoint. Investigate root cause.',
  'degradation product exceeded 1.0% specification limit. CAPA recommended.',
  'forced degradation study identified 3 new impurities above identification threshold.',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateId(): string {
  return `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface NotificationTemplate {
  category: NotificationCategory
  severity: NotificationSeverity
  title: string
  message: string
  actionLabel?: string
  actionPage?: ChemStabNotification['actionPage']
}

function buildNotification(): ChemStabNotification {
  const templates: NotificationTemplate[] = [
    // Study completed
    ...STUDY_CODES.map<NotificationTemplate>((code) => ({
      category: 'study',
      severity: 'success',
      title: `Study ${code} completed`,
      message: `${pick(MOLECULES).name} ${pick(STUDY_COMPLETION_MESSAGES)}`,
      actionLabel: 'View Study',
      actionPage: 'studies',
    })),
    // Risk alerts — specifically mention "stability score dropped" per requirements
    ...MOLECULES.slice(0, 4).map<NotificationTemplate>((m) => ({
      category: 'alert',
      severity: 'critical',
      title: `Risk alert: ${m.name} stability score dropped`,
      message: `${m.name} (${m.formula}) ${pick(RISK_ALERT_MESSAGES)}`,
      actionLabel: 'View Study',
      actionPage: 'studies',
    })),
    // New molecule registered
    ...MOLECULES.map<NotificationTemplate>((m) => ({
      category: 'molecule',
      severity: 'info',
      title: 'New molecule registered',
      message: `${m.name} (${m.formula}) was added to the library by Dr. Sarah Chen. Initial risk assessment pending.`,
      actionLabel: 'View Molecules',
      actionPage: 'molecules',
    })),
    // ICH Q1A report ready
    ...REPORT_TYPES.map<NotificationTemplate>((type) => ({
      category: 'report',
      severity: 'success',
      title: `${type} report ready for review`,
      message: `The ${type} report for ${pick(MOLECULES).name} has been generated and is awaiting QA review before submission.`,
      actionLabel: 'View Reports',
      actionPage: 'reports',
    })),
    // System maintenance scheduled
    ...MAINTENANCE_TASKS.map<NotificationTemplate>((task) => ({
      category: 'system',
      severity: 'warning',
      title: 'System maintenance scheduled',
      message: `${task} will run tonight at 02:00 UTC. Brief service interruption (5–10 min) expected. Please save your work.`,
      actionLabel: 'View Admin',
      actionPage: 'admin',
    })),
    // Audit log threshold reached
    ...AUDIT_THRESHOLDS.map<NotificationTemplate>((msg) => ({
      category: 'system',
      severity: 'warning',
      title: 'Audit log threshold reached',
      message: `${msg}. Review the audit trail in the Admin section for compliance verification.`,
      actionLabel: 'View Admin',
      actionPage: 'admin',
    })),
  ]

  const tpl = pick(templates)
  return {
    id: generateId(),
    title: tpl.title,
    message: tpl.message,
    category: tpl.category,
    severity: tpl.severity,
    timestamp: new Date().toISOString(),
    read: false,
    actionLabel: tpl.actionLabel,
    actionPage: tpl.actionPage,
  }
}

// ── Connection handling ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const client: ConnectedClient = {
    id: socket.id,
    connectedAt: new Date(),
    userAgent: socket.handshake.headers['user-agent'],
  }
  connectedClients.set(socket.id, client)

  console.log(
    `[CONNECT] client ${socket.id} | total=${connectedClients.size} | ua="${client.userAgent ?? 'unknown'}"`
  )

  // Send a welcome event so the client knows the connection is alive
  socket.emit('connected', {
    message: 'Connected to ChemStab real-time notifications service',
    clientId: socket.id,
    serverTime: new Date().toISOString(),
  })

  // Allow client to request an immediate notification (used for testing)
  socket.on('request-notification', () => {
    const n = buildNotification()
    console.log(
      `[NOTIFY-PUSH] requested → ${socket.id} | ${n.category}/${n.severity} | ${n.title}`
    )
    socket.emit('notification', n)
  })

  socket.on('disconnect', (reason) => {
    connectedClients.delete(socket.id)
    console.log(
      `[DISCONNECT] client ${socket.id} | reason="${reason}" | total=${connectedClients.size}`
    )
  })

  socket.on('error', (err) => {
    console.error(`[SOCKET-ERROR] client ${socket.id}:`, err)
  })
})

// ── Periodic notification broadcaster ────────────────────────────────────────

let broadcastTimer: ReturnType<typeof setTimeout> | null = null

function scheduleNextBroadcast() {
  const delay = randomInt(MIN_INTERVAL_MS, MAX_INTERVAL_MS)
  broadcastTimer = setTimeout(() => {
    const n = buildNotification()
    const recipientCount = io.engine.clientsCount

    if (recipientCount > 0) {
      io.emit('notification', n)
      console.log(
        `[NOTIFY-BROADCAST] "${n.title}" | ${n.category}/${n.severity} | recipients=${recipientCount}`
      )
    } else {
      // Skip broadcasting when nobody is connected (avoid log noise)
      console.log(
        `[NOTIFY-SKIP] no clients connected | would-have-sent "${n.title}" (${n.category}/${n.severity})`
      )
    }

    scheduleNextBroadcast()
  }, delay)
}

scheduleNextBroadcast()

// ── Status logger (every 60s) ────────────────────────────────────────────────

setInterval(() => {
  console.log(
    `[STATUS] connectedClients=${connectedClients.size} | uptime=${Math.floor(process.uptime())}s | port=${PORT}`
  )
}, 60_000)

// ── Start server ─────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  ChemStab Notifications Service`)
  console.log(`  WebSocket:  ws://localhost:${PORT}  (path: /)`)
  console.log(`  Handshake:  GET http://localhost:${PORT}/?EIO=4&transport=polling`)
  console.log(`  Broadcast:  every ${MIN_INTERVAL_MS / 1000}–${MAX_INTERVAL_MS / 1000}s`)
  console.log('═══════════════════════════════════════════════════════════════')
})

// ── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`\n[${signal}] shutting down notifications service...`)
  if (broadcastTimer) clearTimeout(broadcastTimer)
  io.disconnectSockets(true)
  httpServer.close(() => {
    console.log('[SHUTDOWN] server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT-EXCEPTION]', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED-REJECTION]', reason)
})
