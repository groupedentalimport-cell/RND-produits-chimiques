'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, X, Sun, Moon, Menu, Settings, TrendingUp,
  Atom, Microscope, FileText, Star, ChevronDown, ChevronUp, Bookmark,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip'
import { useAppStore, useFavoriteStore } from '@/lib/store'
import { NAV_ITEMS } from '@/lib/sample-data'
import { setSettingsOpen } from '@/components/shared/SettingsDialog'

const ITEM_TYPE_ICON: Record<string, React.ElementType> = {
  molecule: Atom,
  study: Microscope,
  report: FileText,
}

const ITEM_TYPE_PAGE: Record<string, string> = {
  molecule: 'molecules',
  study: 'studies',
  report: 'reports',
}

export function Sidebar() {
  const { currentPage, setPage, sidebarOpen, toggleSidebar } = useAppStore()
  const { theme, setTheme } = useTheme()
  const { favorites, refreshFavorites } = useFavoriteStore()
  const [favCollapsed, setFavCollapsed] = useState(false)
  const [quickStats, setQuickStats] = useState<{ molecules: number; studies: number; alerts: number } | null>(null)

  useEffect(() => {
    refreshFavorites()
    // Fetch live stats for the Quick Stats mini-card
    const loadStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setQuickStats({
            molecules: data.totalMolecules ?? 0,
            studies: data.activeStudies ?? 0,
            alerts: (data.riskDistribution?.high || 0) + (data.riskDistribution?.critical || 0),
          })
        }
      } catch {
        // keep null — fallback to placeholder
      }
    }
    loadStats()
    // Refresh stats every 60s for live feel
    const interval = setInterval(loadStats, 60_000)
    return () => clearInterval(interval)
  }, [refreshFavorites])

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 64 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed top-0 left-0 z-50 h-full border-r flex flex-col overflow-hidden
          lg:relative lg:z-0
          bg-gradient-to-b from-card to-emerald-50/30 dark:to-emerald-950/20
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 p-4 h-16 border-b relative">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 shrink-0">
            CS
          </div>
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-semibold text-lg whitespace-nowrap bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent"
              >
                ChemStab
              </motion.span>
              {/* PRO badge */}
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/30">
                PRO
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:flex hidden shrink-0"
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden shrink-0"
            onClick={toggleSidebar}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Nav items — with tooltips when collapsed */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          <TooltipProvider delayDuration={150}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id
              const button = (
                <Button
                  key={item.id}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={`group w-full justify-start gap-3 h-10 transition-all relative overflow-hidden
                    ${isActive
                      ? 'bg-gradient-to-r from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-300 font-medium nav-active-pulse'
                      : 'border-l-4 border-transparent'
                    }
                    ${!sidebarOpen ? 'px-0 justify-center' : ''}
                  `}
                  onClick={() => { setPage(item.id); if (window.innerWidth < 1024) toggleSidebar(); }}
                >
                  {/* Active left glow indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  )}
                  {/* Active subtle gradient bg overlay */}
                  {isActive && (
                    <span className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
                  )}
                  <Icon className={`size-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:rotate-6 group-hover:scale-110'}`} />
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="whitespace-nowrap relative"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </Button>
              )
              // When sidebar is collapsed, wrap in a tooltip
              if (!sidebarOpen) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                  </Tooltip>
                )
              }
              return button
            })}
          </TooltipProvider>

          {/* Favorites collapsible section (only shown when sidebar is expanded) */}
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3"
            >
              {/* Favorites header */}
              <button
                onClick={() => setFavCollapsed(!favCollapsed)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Bookmark className="size-3" />
                  <span>Favorites</span>
                  {favorites.length > 0 && (
                    <span className="inline-flex items-center justify-center size-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                      {favorites.length}
                    </span>
                  )}
                </div>
                {favCollapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
              </button>

              {/* Favorites list */}
              <AnimatePresence>
                {!favCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1 max-h-48 overflow-y-auto"
                  >
                    {favorites.length === 0 ? (
                      <div className="px-2 py-3 text-center">
                        <Star className="size-5 text-emerald-300 dark:text-emerald-700 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">No favorites yet</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Star items to bookmark them here
                        </p>
                      </div>
                    ) : (
                      favorites.map((fav) => {
                        const FavIcon = ITEM_TYPE_ICON[fav.itemType] || Star
                        const targetPage = ITEM_TYPE_PAGE[fav.itemType] || 'dashboard'
                        return (
                          <Button
                            key={`${fav.itemType}-${fav.itemId}`}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 h-8 px-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/20 group/fav transition-all"
                            onClick={() => { setPage(targetPage as any); if (window.innerWidth < 1024) toggleSidebar(); }}
                          >
                            <FavIcon className="size-3 shrink-0 text-emerald-500 dark:text-emerald-400 transition-transform group-hover/fav:scale-110" />
                            <span className="truncate text-foreground/80 group-hover/fav:text-foreground transition-colors">
                              {fav.itemLabel}
                            </span>
                          </Button>
                        )
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </nav>

        {/* Quick Stats mini-card (only in expanded sidebar) */}
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-2 pb-1"
          >
            <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 dark:from-emerald-950/60 dark:to-teal-950/40 p-2.5 relative overflow-hidden">
              {/* Subtle animated shimmer sweep */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent shimmer-bg" />
              <div className="flex items-center justify-between mb-1 relative">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
                  </span>
                  Live Stats
                </p>
                <TrendingUp className="size-3 text-emerald-500" />
              </div>
              {quickStats ? (
                <>
                  <p className="text-xs text-muted-foreground relative">
                    <span className="font-bold text-foreground tabular-nums">{quickStats.molecules}</span> molecules ·{' '}
                    <span className="font-bold text-foreground tabular-nums">{quickStats.studies}</span> studies
                  </p>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 relative">
                    <TrendingUp className="size-2.5" />
                    <span className="tabular-nums">{quickStats.alerts}</span>
                    <span>risk alert{quickStats.alerts !== 1 ? 's' : ''}</span>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 relative">
                  <div className="h-3 w-32 rounded shimmer" />
                  <div className="h-2.5 w-20 rounded shimmer" />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Bottom controls */}
        <div className="p-2 border-t space-y-1">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={`group w-full justify-start gap-3 h-10 ${!sidebarOpen ? 'px-0 justify-center' : ''}`}
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="size-4 shrink-0 transition-transform group-hover:rotate-12" /> : <Moon className="size-4 shrink-0 transition-transform group-hover:rotate-12" />}
                  {sidebarOpen && <span className="whitespace-nowrap">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
                </Button>
              </TooltipTrigger>
              {!sidebarOpen && <TooltipContent side="right">Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode</TooltipContent>}
            </Tooltip>

            {/* Settings/gear button at the very bottom */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={`group w-full justify-start gap-3 h-10 ${!sidebarOpen ? 'px-0 justify-center' : ''}`}
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="size-4 shrink-0 transition-transform group-hover:rotate-90 duration-300" />
                  {sidebarOpen && <span className="whitespace-nowrap">Settings</span>}
                </Button>
              </TooltipTrigger>
              {!sidebarOpen && <TooltipContent side="right">Settings</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.aside>

      {/* Mobile toggle button (shown when sidebar closed on mobile) */}
      {!sidebarOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-3 left-3 z-40 lg:hidden shadow-md"
          onClick={toggleSidebar}
        >
          <Menu className="size-4" />
        </Button>
      )}
    </>
  )
}
