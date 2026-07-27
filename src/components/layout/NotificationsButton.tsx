'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, CheckCheck, Settings, ChevronRight, X, BellOff, Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover'
import { useAppStore, useNotificationStore } from '@/lib/store'
import {
  NOTIF_CATEGORY_ICON, NOTIF_CATEGORY_LABEL, NOTIF_SEVERITY_BG,
  formatRelativeTime,
  type NotificationCategory,
} from '@/lib/sample-data'

type FilterValue = 'all' | NotificationCategory

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'study',    label: NOTIF_CATEGORY_LABEL.study },
  { value: 'molecule', label: NOTIF_CATEGORY_LABEL.molecule },
  { value: 'report',   label: NOTIF_CATEGORY_LABEL.report },
  { value: 'system',   label: NOTIF_CATEGORY_LABEL.system },
  { value: 'alert',    label: NOTIF_CATEGORY_LABEL.alert },
]

export function NotificationsButton() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterValue>('all')

  const notifications   = useNotificationStore((s) => s.notifications)
  const unreadCount     = useNotificationStore((s) => s.unreadCount)
  const markAsRead      = useNotificationStore((s) => s.markAsRead)
  const markAllAsRead   = useNotificationStore((s) => s.markAllAsRead)
  const removeNotification = useNotificationStore((s) => s.removeNotification)
  const setPage         = useAppStore((s) => s.setPage)

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications
    return notifications.filter((n) => n.category === filter)
  }, [notifications, filter])

  const handleAction = (id: string, page?: Parameters<typeof setPage>[0]) => {
    markAsRead(id)
    if (page) setPage(page)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <motion.div
            animate={unreadCount > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
            transition={{ duration: 0.6, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 4 }}
          >
            <Bell className="size-4" />
          </motion.div>
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold shadow-md shadow-red-500/30 z-10"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
          {/* subtle pulsing ring around the badge when unread */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-[18px] rounded-full bg-red-500/40 animate-ping pointer-events-none" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-emerald-50/40 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">Notifications</p>
              {unreadCount > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1 p-2 border-b">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`text-[11px] px-2 py-1 rounded-full transition-colors ${
                  filter === opt.value
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Notifications list */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '24rem' }}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <Inbox className="size-8 opacity-40" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs opacity-70">
                  {filter === 'all' ? "You're all caught up" : `No ${NOTIF_CATEGORY_LABEL[filter as NotificationCategory] || ''} notifications`}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((n) => {
                  const Icon = NOTIF_CATEGORY_ICON[n.category]
                  const sevBg = NOTIF_SEVERITY_BG[n.severity]
                  const isCritical = n.severity === 'critical'
                  const isUnread = !n.read
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`group relative flex gap-2.5 p-3 border-b last:border-b-0 transition-colors hover:bg-muted/40 ${
                        isUnread ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : ''
                      } ${
                        isCritical
                          ? 'border-l-2 border-l-red-500'
                          : isUnread
                          ? 'border-l-2 border-l-emerald-500'
                          : 'border-l-2 border-l-transparent'
                      }`}
                    >
                      {/* Unread / critical dot indicator — sits in the left padding area */}
                      {isUnread && (
                        <div className="absolute left-1 top-4 flex">
                          {isCritical ? (
                            <span className="relative flex size-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                              <span className="relative inline-flex rounded-full size-2 bg-red-500" />
                            </span>
                          ) : (
                            <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                          )}
                        </div>
                      )}

                      {/* Category icon */}
                      <div className={`shrink-0 size-8 rounded-full flex items-center justify-center ${sevBg}`}>
                        <Icon className="size-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold leading-tight">{n.title}</p>
                        <p className="text-xs text-muted-foreground leading-snug line-clamp-3">{n.message}</p>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatRelativeTime(n.timestamp)}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {n.actionLabel && n.actionPage && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] px-2 gap-0.5 text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30"
                                onClick={() => handleAction(n.id, n.actionPage)}
                              >
                                {n.actionLabel}
                                <ChevronRight className="size-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeNotification(n.id)}
                              aria-label="Dismiss notification"
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-2 border-t bg-muted/20">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-1.5 py-1 rounded"
              onClick={() => { setPage('admin'); setOpen(false) }}
            >
              <BellOff className="size-3" /> View all notifications
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-1.5 py-1 rounded"
            >
              <Settings className="size-3" /> Preferences
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
