'use client'

/**
 * useRealtimeNotifications
 *
 * Connects to the ChemStab notifications WebSocket mini-service
 * (mini-services/notifications-service on port 3003) via the Caddy
 * gateway. Pushed notifications are merged into the shared
 * `useNotificationStore` so the bell icon / dropdown picks them up
 * automatically.
 *
 * Gateway rules:
 *  - Connect using `io("/?XTransformPort=3003")` — NEVER a direct
 *    `http://localhost:3003` URL. The path MUST be `/` so Caddy can
 *    forward the request to the correct mini-service port.
 *
 * Returns the live connection status so callers can render a small
 * status indicator in the header.
 */

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useNotificationStore } from '@/lib/store'
import { usePreferencesStore } from '@/lib/store'
import type { AppNotification } from '@/lib/sample-data'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface ServerNotification {
  id: string
  title: string
  message: string
  category: AppNotification['category']
  severity: AppNotification['severity']
  timestamp: string
  read: boolean
  actionLabel?: string
  actionPage?: AppNotification['actionPage']
}

/**
 * Map a server notification category to the user's preferences key.
 * The preferences store uses `alerts` (plural) — keep this in sync.
 */
function categoryToPrefKey(
  category: AppNotification['category']
): keyof ReturnType<typeof usePreferencesStore.getState>['notificationCategories'] | null {
  switch (category) {
    case 'study':
      return 'studies'
    case 'molecule':
      return 'molecules'
    case 'report':
      return 'reports'
    case 'system':
      return 'system'
    case 'alert':
      return 'alerts'
    default:
      return null
  }
}

export function useRealtimeNotifications(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const socketRef = useRef<Socket | null>(null)
  const addNotification = useNotificationStore((s) => s.addNotification)

  // Read preferences outside the effect so re-renders pick up changes,
  // but the socket itself is only created once.
  const notificationsEnabled = usePreferencesStore((s) => s.notificationsEnabled)

  useEffect(() => {
    // Bail out on the server (SSR) — only run in the browser
    if (typeof window === 'undefined') return

    // Build the socket.io client.
    // CRITICAL: use relative path "/" + XTransformPort query param.
    // Never use http://localhost:3003 — the Caddy gateway requires this.
    const socket = io('/?XTransformPort=3003', {
      transports: ['polling'],
      path: '/',
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 15_000,
      timeout: 10_000,
      autoConnect: true,
      upgrade: false,
    })

    socketRef.current = socket
    // Initial state is already 'connecting' — no need to call setStatus()
    // synchronously here (that would trigger an unnecessary extra render per
    // the react-hooks/set-state-in-effect rule).

    socket.on('connect', () => {
      setStatus('connected')
      console.log('[realtime-notifications] connected:', socket.id)
    })

    socket.on('disconnect', (reason) => {
      setStatus('disconnected')
      console.warn('[realtime-notifications] disconnected:', reason)
    })

    socket.io.on('reconnect_attempt', (attempt) => {
      setStatus('connecting')
      console.log(`[realtime-notifications] reconnect attempt #${attempt}`)
    })

    socket.io.on('reconnect_error', (err) => {
      console.warn('[realtime-notifications] reconnect error:', err.message)
    })

    socket.on('connect_error', (err) => {
      setStatus('disconnected')
      console.warn('[realtime-notifications] connect_error:', err.message)
    })

    // Main event: incoming notification from the service
    socket.on('notification', (n: ServerNotification) => {
      // Respect user preferences: if notifications are globally disabled,
      // skip entirely. Otherwise, also check the per-category toggle.
      if (!usePreferencesStore.getState().notificationsEnabled) return

      const prefKey = categoryToPrefKey(n.category)
      if (prefKey && !usePreferencesStore.getState().notificationCategories[prefKey]) {
        // Category disabled by user — silently drop
        return
      }

      const notification: AppNotification = {
        id: n.id,
        title: n.title,
        message: n.message,
        category: n.category,
        severity: n.severity,
        timestamp: n.timestamp,
        read: false,
        actionLabel: n.actionLabel,
        actionPage: n.actionPage,
      }

      addNotification(notification)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
    // We intentionally only run this once — the socket lifecycle is tied
    // to the page mount, not to changes in `notificationsEnabled` (which
    // is read live inside the `notification` handler).
  }, [])

  // When notifications are toggled off, we don't tear down the socket —
  // we still want the connection status indicator to reflect reality.
  // The per-notification filtering happens in the handler above.
  void notificationsEnabled

  return status
}
