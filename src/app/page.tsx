'use client'

import { Menu, ChevronRight, Search, Activity, BookOpen, FileText, LifeBuoy, Database, Server, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationsButton } from '@/components/layout/NotificationsButton'
import { AIAssistant } from '@/components/layout/AIAssistant'
import { CommandPalette, useOpenCommandPalette } from '@/components/layout/CommandPalette'
import { LiveClock } from '@/components/layout/LiveClock'
import { PageRouter } from '@/components/PageRouter'
import { SettingsDialog } from '@/components/shared/SettingsDialog'
import { WhatsNewBanner } from '@/components/shared/WhatsNewBanner'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'

export default function Home() {
  const { currentPage } = useAppStore()
  const openCommandPalette = useOpenCommandPalette()
  const connectionStatus = useRealtimeNotifications()

  // Real-time connection indicator metadata
  const rtIndicator =
    connectionStatus === 'connected'
      ? {
          dotClass: 'bg-emerald-500',
          pingClass: 'bg-emerald-400',
          label: 'Real-time: Live',
          description: 'Connected to ChemStab notifications service',
        }
      : connectionStatus === 'connecting'
      ? {
          dotClass: 'bg-amber-500',
          pingClass: 'bg-amber-400',
          label: 'Real-time: Connecting…',
          description: 'Establishing WebSocket connection to notifications service',
        }
      : {
          dotClass: 'bg-red-500',
          pingClass: 'bg-red-400',
          label: 'Real-time: Disconnected',
          description: 'Live notifications are paused — will retry automatically',
        }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-emerald-50/30 dark:from-background dark:via-background dark:to-emerald-950/20 text-foreground">
      {/* Header — with subtle emerald→teal→transparent gradient bottom border */}
      <header className="sticky top-0 z-30 h-14 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center px-4 gap-3 relative">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        {/* Mobile menu button in header */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={useAppStore.getState().toggleSidebar}
        >
          <Menu className="size-4" />
        </Button>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">ChemStab</span>
          <ChevronRight className="size-3" />
          <span className="capitalize">{currentPage.replace('_', ' ')}</span>
        </div>

        {/* Live clock — desktop only, sits next to breadcrumb */}
        <LiveClock />

        <div className="flex items-center gap-2 ml-auto">
          {/* System Health pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 text-[11px] text-emerald-700 dark:text-emerald-300">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span className="font-medium">All systems operational</span>
          </div>

          {/* Real-time connection indicator — desktop only */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full border bg-muted/40 hover:bg-muted transition-colors text-[11px] text-muted-foreground aria-label={rtIndicator.label}"
                aria-label={rtIndicator.label}
              >
                <span className="relative flex size-2">
                  {connectionStatus !== 'disconnected' && (
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full ${rtIndicator.pingClass} opacity-75`}
                    />
                  )}
                  <span
                    className={`relative inline-flex rounded-full size-2 ${rtIndicator.dotClass}`}
                  />
                </span>
                <span className="font-medium">{rtIndicator.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              <div className="space-y-0.5 text-center">
                <p className="font-semibold">{rtIndicator.label}</p>
                <p className="text-[10px] opacity-90 max-w-[220px]">{rtIndicator.description}</p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Command Palette Search button — subtle hover scale + shadow */}
          <Button
            variant="outline"
            size="sm"
            onClick={openCommandPalette}
            className="hidden sm:flex gap-2 text-muted-foreground hover:text-foreground px-2.5 transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-500/40"
            aria-label="Open command palette"
          >
            <Search className="size-4" />
            <span className="text-xs">Search</span>
            <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={openCommandPalette}
            className="sm:hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-500/40"
            aria-label="Open command palette"
          >
            <Search className="size-4" />
          </Button>
          <NotificationsButton />
          <div className="flex items-center gap-2 pl-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-sm font-medium shadow-md shadow-emerald-500/20">
              SC
            </div>
            <span className="text-sm font-medium hidden sm:inline">Dr. Sarah Chen</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <WhatsNewBanner />
          <PageRouter />
        </main>
      </div>

      {/* Sticky Footer — gradient top border + 4-column informative layout */}
      <footer className="mt-auto bg-gradient-to-r from-card via-card to-emerald-50/30 dark:via-card dark:to-emerald-950/20 relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <div className="py-4 px-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
          {/* Product */}
          <div className="space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Product
            </p>
            <p>ChemStab v2.0</p>
            <p>Build #2024.03</p>
            <p className="flex items-center gap-1">
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
              </span>
              Status: Operational
            </p>
          </div>

          {/* Compliance */}
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldIcon />
              Compliance
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">ICH Q1A</Badge>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-teal-500/40 text-teal-700 dark:text-teal-300">21 CFR Part 11</Badge>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-cyan-500/40 text-cyan-700 dark:text-cyan-300">GxP</Badge>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="size-3" />
              Resources
            </p>
            <div className="flex flex-col gap-1">
              <a className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                <FileText className="size-2.5" /> Documentation
              </a>
              <a className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                <CodeIcon /> API Reference
              </a>
              <a className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                <LifeBuoy className="size-2.5" /> Support
              </a>
            </div>
          </div>

          {/* System */}
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Server className="size-3" />
              System
            </p>
            <p className="flex items-center gap-1"><Database className="size-2.5" /> DB latency: <span className="font-mono text-emerald-600 dark:text-emerald-400">12ms</span></p>
            <p className="flex items-center gap-1"><Cpu className="size-2.5" /> Cache hit: <span className="font-mono text-emerald-600 dark:text-emerald-400">98.7%</span></p>
            <p className="flex items-center gap-1"><Activity className="size-2.5" /> Uptime: <span className="font-mono text-emerald-600 dark:text-emerald-400">99.99%</span></p>
          </div>
        </div>

        {/* Bottom bar with copyright + made with love */}
        <div className="border-t border-border/50 py-2 px-4 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
          <span>© 2024 ChemStab Industrial — Chemical Stability Assessment Platform</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              Made with <span className="text-rose-500">❤</span> for pharmaceutical science
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              v5.3.0 · FDA 21 CFR Part 11 Compliant
            </span>
          </span>
        </div>
      </footer>

      {/* AI Assistant Floating Panel */}
      <AIAssistant />

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette />

      {/* Settings Dialog */}
      <SettingsDialog />
    </div>
  )
}

/* tiny inline icons to avoid extra imports */
function ShieldIcon() {
  return (
    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function CodeIcon() {
  return (
    <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}
