'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Sun,
  Moon,
  Monitor,
  Settings,
  Bell,
  Paintbrush,
  SlidersHorizontal,
  Info,
  FileText,
  Code,
  LifeBuoy,
  Shield,
  Check,
} from 'lucide-react'
import { usePreferencesStore, type PrefPageId, type MoleculeView, type StudyView, type RefreshInterval } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

/* ── shared settings-open state so sidebar & page.tsx can coordinate ── */
let _openListeners: Array<(open: boolean) => void> = []
let _openState = false

export function setSettingsOpen(v: boolean) {
  _openState = v
  _openListeners.forEach((l) => l(v))
}

export function useSettingsOpen() {
  const [open, setOpen] = useState(_openState)
  useEffect(() => {
    _openListeners.push(setOpen)
    return () => {
      const idx = _openListeners.indexOf(setOpen)
      if (idx > -1) _openListeners.splice(idx, 1)
    }
  }, [])
  return [open, setSettingsOpen] as const
}

/* ── Theme toggle card ── */
function ThemeCard({
  value,
  label,
  icon,
  active,
  onClick,
}: {
  value: string
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer
        ${
          active
            ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 shadow-md shadow-emerald-500/10'
            : 'border-border bg-card hover:border-emerald-500/40 hover:shadow-sm'
        }
      `}
    >
      <div
        className={`size-10 rounded-full flex items-center justify-center transition-colors
          ${active ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white' : 'bg-muted text-muted-foreground'}
        `}
      >
        {icon}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
        {label}
      </span>
      {active && (
        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="size-3" /> Active
        </span>
      )}
    </button>
  )
}

/* ── Notification category row ── */
function NotificationCategory({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="text-sm font-normal cursor-pointer">{label}</Label>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
    </div>
  )
}

/* ── Select row ── */
function SelectRow({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string
  value: string
  onValueChange: (v: string) => void
  items: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="text-sm font-normal">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/* ── Main dialog ── */
export function SettingsDialog() {
  const [dialogOpen, setDialogOpen] = useSettingsOpen()
  const { theme, setTheme } = useTheme()
  const prefs = usePreferencesStore()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('theme')

  function showToast(message: string) {
    toast({
      title: 'Settings Updated',
      description: message,
    })
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        {/* Emerald gradient header accent */}
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              Settings & Preferences
            </span>
          </DialogTitle>
          <DialogDescription>
            Customize your ChemStab experience
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="theme" className="gap-1">
              <Paintbrush className="size-3.5" />
              <span className="hidden sm:inline">Theme</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1">
              <Bell className="size-3.5" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="defaults" className="gap-1">
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Defaults</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-1">
              <Info className="size-3.5" />
              <span className="hidden sm:inline">About</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Theme Tab ── */}
          <TabsContent value="theme" className="mt-4 space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-3 block">Appearance</Label>
              <div className="grid grid-cols-3 gap-3">
                <ThemeCard
                  value="light"
                  label="Light"
                  icon={<Sun className="size-5" />}
                  active={theme === 'light'}
                  onClick={() => { setTheme('light'); showToast('Theme set to Light') }}
                />
                <ThemeCard
                  value="dark"
                  label="Dark"
                  icon={<Moon className="size-5" />}
                  active={theme === 'dark'}
                  onClick={() => { setTheme('dark'); showToast('Theme set to Dark') }}
                />
                <ThemeCard
                  value="system"
                  label="System"
                  icon={<Monitor className="size-5" />}
                  active={theme === 'system'}
                  onClick={() => { setTheme('system'); showToast('Theme set to System') }}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Sidebar default collapsed</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Start with sidebar collapsed on desktop
                </p>
              </div>
              <Switch
                checked={prefs.sidebarDefaultCollapsed}
                onCheckedChange={(v) => {
                  prefs.setSidebarDefaultCollapsed(v)
                  showToast(v ? 'Sidebar will start collapsed' : 'Sidebar will start expanded')
                }}
              />
            </div>
          </TabsContent>

          {/* ── Notifications Tab ── */}
          <TabsContent value="notifications" className="mt-4 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable notifications</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive in-app notifications and alerts
                </p>
              </div>
              <Switch
                checked={prefs.notificationsEnabled}
                onCheckedChange={(v) => {
                  prefs.setNotificationsEnabled(v)
                  showToast(v ? 'Notifications enabled' : 'Notifications disabled')
                }}
              />
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-semibold mb-2 block">Notification Categories</Label>
              <div className="rounded-lg border bg-card p-3 space-y-0 divide-y divide-border">
                <NotificationCategory
                  label="Studies"
                  checked={prefs.notificationCategories.studies}
                  onChange={(v) => { prefs.setNotificationCategory('studies', v); showToast('Study notifications ' + (v ? 'enabled' : 'disabled')) }}
                />
                <NotificationCategory
                  label="Molecules"
                  checked={prefs.notificationCategories.molecules}
                  onChange={(v) => { prefs.setNotificationCategory('molecules', v); showToast('Molecule notifications ' + (v ? 'enabled' : 'disabled')) }}
                />
                <NotificationCategory
                  label="Reports"
                  checked={prefs.notificationCategories.reports}
                  onChange={(v) => { prefs.setNotificationCategory('reports', v); showToast('Report notifications ' + (v ? 'enabled' : 'disabled')) }}
                />
                <NotificationCategory
                  label="System"
                  checked={prefs.notificationCategories.system}
                  onChange={(v) => { prefs.setNotificationCategory('system', v); showToast('System notifications ' + (v ? 'enabled' : 'disabled')) }}
                />
                <NotificationCategory
                  label="Alerts"
                  checked={prefs.notificationCategories.alerts}
                  onChange={(v) => { prefs.setNotificationCategory('alerts', v); showToast('Alert notifications ' + (v ? 'enabled' : 'disabled')) }}
                />
              </div>
            </div>

            <Separator />

            <SelectRow
              label="Auto-refresh interval"
              value={prefs.autoRefreshInterval}
              onValueChange={(v) => {
                prefs.setAutoRefreshInterval(v as RefreshInterval)
                showToast('Auto-refresh set to ' + (v === 'never' ? 'Never' : v))
              }}
              items={[
                { value: '30s', label: '30 seconds' },
                { value: '1min', label: '1 minute' },
                { value: '5min', label: '5 minutes' },
                { value: '15min', label: '15 minutes' },
                { value: 'never', label: 'Never' },
              ]}
            />
          </TabsContent>

          {/* ── Defaults Tab ── */}
          <TabsContent value="defaults" className="mt-4 space-y-5">
            <SelectRow
              label="Default landing page"
              value={prefs.defaultLandingPage}
              onValueChange={(v) => {
                prefs.setDefaultLandingPage(v as PrefPageId)
                showToast('Landing page set to ' + v.charAt(0).toUpperCase() + v.slice(1))
              }}
              items={[
                { value: 'dashboard', label: 'Dashboard' },
                { value: 'molecules', label: 'Molecules' },
                { value: 'simulator', label: 'Simulator' },
                { value: 'studies', label: 'Studies' },
                { value: 'degradation', label: 'Degradation' },
                { value: 'interactions', label: 'Interactions' },
                { value: 'reports', label: 'Reports' },
                { value: 'analytics', label: 'Analytics' },
                { value: 'compliance', label: 'Compliance' },
                { value: 'admin', label: 'Admin' },
              ]}
            />

            <Separator />

            <SelectRow
              label="Default molecule view"
              value={prefs.defaultMoleculeView}
              onValueChange={(v) => {
                prefs.setDefaultMoleculeView(v as MoleculeView)
                showToast('Molecule view set to ' + (v === 'table' ? 'Table' : 'Grid'))
              }}
              items={[
                { value: 'table', label: 'Table' },
                { value: 'grid', label: 'Grid' },
              ]}
            />

            <Separator />

            <SelectRow
              label="Default study view"
              value={prefs.defaultStudyView}
              onValueChange={(v) => {
                prefs.setDefaultStudyView(v as StudyView)
                showToast('Study view set to ' + (v === 'list' ? 'List' : 'Timeline'))
              }}
              items={[
                { value: 'list', label: 'List' },
                { value: 'timeline', label: 'Timeline' },
              ]}
            />

            <Separator />

            <SelectRow
              label="Molecules per page"
              value={String(prefs.defaultMoleculesPerPage)}
              onValueChange={(v) => {
                prefs.setDefaultMoleculesPerPage(Number(v))
                showToast('Molecules per page set to ' + v)
              }}
              items={[
                { value: '5', label: '5' },
                { value: '10', label: '10' },
                { value: '20', label: '20' },
                { value: '50', label: '50' },
              ]}
            />
          </TabsContent>

          {/* ── About Tab ── */}
          <TabsContent value="about" className="mt-4 space-y-5">
            {/* Version info */}
            <div className="rounded-lg border bg-gradient-to-br from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-500/20">
                  CS
                </div>
                <div>
                  <p className="font-semibold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                    ChemStab v2.0
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Build #2024.03 · Chemical Stability Assessment Platform
                  </p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>Framework: Next.js 16</p>
                <p>UI: shadcn/ui + Tailwind</p>
                <p>Database: Prisma (SQLite)</p>
                <p>State: Zustand</p>
              </div>
            </div>

            {/* Compliance badges */}
            <div>
              <Label className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <Shield className="size-4 text-emerald-600 dark:text-emerald-400" />
                Compliance & Regulatory
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 shadow-sm shadow-emerald-500/20">
                  ICH Q1A
                </Badge>
                <Badge className="bg-gradient-to-r from-teal-500 to-teal-600 text-white border-0 shadow-sm shadow-teal-500/20">
                  21 CFR Part 11
                </Badge>
                <Badge className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-0 shadow-sm shadow-cyan-500/20">
                  GxP
                </Badge>
              </div>
            </div>

            <Separator />

            {/* License */}
            <div className="rounded-lg border bg-card p-4">
              <Label className="text-sm font-semibold mb-1">License</Label>
              <p className="text-xs text-muted-foreground">
                ChemStab Industrial — Enterprise License
              </p>
              <p className="text-xs text-muted-foreground">
                Valid until: December 31, 2025
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Licensed to: PharmaCorp Research Division
              </p>
            </div>

            <Separator />

            {/* Links */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold mb-1">Resources</Label>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="justify-start gap-2 hover:border-emerald-500/40 hover:shadow-sm hover:shadow-emerald-500/10 transition-all"
                  onClick={() => showToast('Opening documentation…')}
                >
                  <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Documentation
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2 hover:border-emerald-500/40 hover:shadow-sm hover:shadow-emerald-500/10 transition-all"
                  onClick={() => showToast('Opening API reference…')}
                >
                  <Code className="size-4 text-emerald-600 dark:text-emerald-400" />
                  API Reference
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2 hover:border-emerald-500/40 hover:shadow-sm hover:shadow-emerald-500/10 transition-all"
                  onClick={() => showToast('Opening support portal…')}
                >
                  <LifeBuoy className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Support
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
