'use client'

import { useEffect, useMemo, useCallback } from 'react'
import { create } from 'zustand'
import { useTheme } from 'next-themes'
import {
  Search, LayoutDashboard, Atom, Beaker, Microscope, FlaskConical,
  FileText, BarChart3, ShieldCheck, Plus, Play, FileCheck, Moon, Sun,
  SearchX, CornerDownLeft, ClipboardCheck, GitCompareArrows,
} from 'lucide-react'
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore, useMoleculeStore } from '@/lib/store'
import { SAMPLE_MOLECULES, SAMPLE_STUDIES, NAV_ITEMS } from '@/lib/sample-data'

// ── Tiny open-state store so the header Search button can toggle the palette ─
interface PaletteState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}
export const usePaletteStore = create<PaletteState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}))

// Icons for navigation items (kept in sync with NAV_ITEMS)
const NAV_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  molecules: Atom,
  simulator: Beaker,
  studies: Microscope,
  degradation: FlaskConical,
  interactions: GitCompareArrows,
  compliance: ClipboardCheck,
  reports: FileText,
  analytics: BarChart3,
  admin: ShieldCheck,
}

export function CommandPalette() {
  const open = usePaletteStore((s) => s.open)
  const setOpen = usePaletteStore((s) => s.setOpen)
  const { setPage } = useAppStore()
  const { setSelectedMolecule } = useMoleculeStore()
  const { theme, setTheme } = useTheme()

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!usePaletteStore.getState().open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setOpen])

  const close = useCallback(() => setOpen(false), [setOpen])

  const navigate = useCallback((page: Parameters<typeof setPage>[0]) => {
    setPage(page)
    close()
  }, [setPage, close])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    close()
  }, [setTheme, theme, close])

  const selectMolecule = useCallback((id: string) => {
    const mol = SAMPLE_MOLECULES.find((m) => m.id === id) || null
    setSelectedMolecule(mol)
    navigate('molecules')
  }, [setSelectedMolecule, navigate])

  const navItems = useMemo(() => NAV_ITEMS.map((n) => ({
    id: n.id, label: n.label, Icon: NAV_ICONS[n.id] || LayoutDashboard,
  })), [])

  const quickActions = useMemo(() => ([
    { id: 'add-molecule', label: 'Add New Molecule', Icon: Plus, hint: 'A', run: () => navigate('molecules') },
    { id: 'run-sim', label: 'Run Simulation', Icon: Play, hint: 'S', run: () => navigate('simulator') },
    { id: 'create-study', label: 'Create Study', Icon: Microscope, hint: 'C', run: () => navigate('studies') },
    { id: 'generate-report', label: 'Generate Report', Icon: FileCheck, hint: 'G', run: () => navigate('reports') },
    {
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      Icon: theme === 'dark' ? Sun : Moon,
      hint: 'D',
      run: toggleTheme,
    },
  ]), [navigate, toggleTheme, theme])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 max-w-[640px] w-[calc(100%-2rem)] gap-0 border-emerald-200/40 dark:border-emerald-800/40 shadow-2xl shadow-emerald-900/10"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <Command
          className="[&_[cmdk-group-heading]]:text-emerald-700 dark:[&_[cmdk-group-heading]]:text-emerald-400
            **:data-[slot=command-input-wrapper]:h-12
            [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[11px]
            [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider
            [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0
            [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4
            [&_[cmdk-input]]:h-12 [&_[cmdk-input]]:text-sm
            [&_[cmdk-item]]:px-2.5 [&_[cmdk-item]]:py-2
            [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4
            [&_[cmdk-item][data-selected=true]]:bg-emerald-50 dark:[&_[cmdk-item][data-selected=true]]:bg-emerald-900/30
            [&_[cmdk-item][data-selected=true]]:text-emerald-900 dark:[&_[cmdk-item][data-selected=true]]:text-emerald-100"
          loop
        >
          <CommandInput placeholder="Search commands, pages, molecules, studies…" autoFocus />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <SearchX className="size-7 opacity-50" />
                <span className="text-sm">No results found</span>
              </div>
            </CommandEmpty>

            {/* Navigation */}
            <CommandGroup heading="Navigation">
              {navItems.map(({ id, label, Icon }) => (
                <CommandItem
                  key={`nav-${id}`}
                  value={`navigation ${label}`}
                  onSelect={() => navigate(id)}
                >
                  <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{label}</span>
                  <span className="ml-auto inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    ↵
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* Quick Actions */}
            <CommandGroup heading="Quick Actions">
              {quickActions.map(({ id, label, Icon, hint, run }) => (
                <CommandItem
                  key={`qa-${id}`}
                  value={`action ${label}`}
                  onSelect={run}
                >
                  <Icon className="size-4 text-teal-600 dark:text-teal-400" />
                  <span>{label}</span>
                  <span className="ml-auto inline-flex items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {hint}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* Molecules */}
            <CommandGroup heading="Molecules">
              {SAMPLE_MOLECULES.map((mol) => (
                <CommandItem
                  key={`mol-${mol.id}`}
                  value={`molecule ${mol.name} ${mol.casNumber} ${mol.formula}`}
                  onSelect={() => selectMolecule(mol.id)}
                >
                  <Atom className="size-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="flex flex-col">
                    <span>{mol.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {mol.formula} · {mol.casNumber}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* Studies */}
            <CommandGroup heading="Studies">
              {SAMPLE_STUDIES.map((s) => (
                <CommandItem
                  key={`std-${s.id}`}
                  value={`study ${s.studyCode} ${s.substanceName} ${s.studyType}`}
                  onSelect={() => navigate('studies')}
                >
                  <Microscope className="size-4 text-amber-600 dark:text-amber-400" />
                  <span className="flex flex-col">
                    <span>{s.studyCode}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {s.substanceName} · {s.studyType.replace('_', ' ')}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>

          {/* Footer hint */}
          <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CornerDownLeft className="size-3" />
              <span><kbd className="rounded bg-background px-1 py-0.5 border">↑</kbd> <kbd className="rounded bg-background px-1 py-0.5 border">↓</kbd> to navigate</span>
            </span>
            <span className="flex items-center gap-2">
              <span><kbd className="rounded bg-background px-1 py-0.5 border">↵</kbd> to select</span>
              <span><kbd className="rounded bg-background px-1 py-0.5 border">esc</kbd> to close</span>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

// Hook for the header Search button to open the palette
export function useOpenCommandPalette() {
  return usePaletteStore((s) => s.toggle)
}

// Re-export so page.tsx can grab Search icon without an extra import side-effect
export { Search as SearchIconCmd }
