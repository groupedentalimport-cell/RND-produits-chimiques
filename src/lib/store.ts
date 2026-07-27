import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type AppNotification } from '@/lib/sample-data'

// ── Navigation State ────────────────────────────────────────────────────

type PageId = 'dashboard' | 'molecules' | 'simulator' | 'studies' | 'reports' | 'analytics' | 'degradation' | 'admin' | 'compliance' | 'interactions'

interface AppState {
  currentPage: PageId
  sidebarOpen: boolean
  setPage: (page: PageId) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  sidebarOpen: true,
  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))

// ── Molecules State ─────────────────────────────────────────────────────

interface MoleculeState {
  molecules: any[]
  searchQuery: string
  selectedMolecule: any | null
  loading: boolean
  setMolecules: (molecules: any[]) => void
  setSearchQuery: (query: string) => void
  setSelectedMolecule: (molecule: any | null) => void
  setLoading: (loading: boolean) => void
}

export const useMoleculeStore = create<MoleculeState>((set) => ({
  molecules: [],
  searchQuery: '',
  selectedMolecule: null,
  loading: false,
  setMolecules: (molecules) => set({ molecules }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedMolecule: (molecule) => set({ selectedMolecule: molecule }),
  setLoading: (loading) => set({ loading }),
}))

// ── Analysis State ──────────────────────────────────────────────────────

interface AnalysisResult {
  analysisId: string
  overallScore: number
  riskLevel: string
  risks: Record<string, any>
  kinetics: any
  recommendations: string[]
}

interface AnalysisState {
  substances: { name: string; concentration: number; unit: string }[]
  conditions: {
    ph: number
    temperature: number
    dissolvedOxygen: number
    lightExposure: number
  }
  result: AnalysisResult | null
  running: boolean
  addSubstance: () => void
  removeSubstance: (index: number) => void
  updateSubstance: (index: number, field: string, value: any) => void
  setConditions: (conditions: Partial<AnalysisState['conditions']>) => void
  setResult: (result: AnalysisResult | null) => void
  setRunning: (running: boolean) => void
  reset: () => void
}

const defaultSubstance = { name: '', concentration: 10, unit: 'g/L' }
const defaultConditions = { ph: 7, temperature: 25, dissolvedOxygen: 8, lightExposure: 0 }

export const useAnalysisStore = create<AnalysisState>((set) => ({
  substances: [{ ...defaultSubstance }],
  conditions: { ...defaultConditions },
  result: null,
  running: false,
  addSubstance: () => set((s) => ({ substances: [...s.substances, { ...defaultSubstance }] })),
  removeSubstance: (index) => set((s) => ({ substances: s.substances.filter((_, i) => i !== index) })),
  updateSubstance: (index, field, value) =>
    set((s) => ({
      substances: s.substances.map((sub, i) => i === index ? { ...sub, [field]: value } : sub),
    })),
  setConditions: (conditions) => set((s) => ({ conditions: { ...s.conditions, ...conditions } })),
  setResult: (result) => set({ result }),
  setRunning: (running) => set({ running }),
  reset: () => set({
    substances: [{ ...defaultSubstance }],
    conditions: { ...defaultConditions },
    result: null,
    running: false,
  }),
}))

// ── Studies State ───────────────────────────────────────────────────────

interface StudyState {
  studies: any[]
  selectedStudy: any | null
  loading: boolean
  setStudies: (studies: any[]) => void
  setSelectedStudy: (study: any | null) => void
  setLoading: (loading: boolean) => void
}

export const useStudyStore = create<StudyState>((set) => ({
  studies: [],
  selectedStudy: null,
  loading: false,
  setStudies: (studies) => set({ studies }),
  setSelectedStudy: (study) => set({ selectedStudy: study }),
  setLoading: (loading) => set({ loading }),
}))

// ── Molecule Comparison State ───────────────────────────────────────────

interface CompareState {
  selectedIds: string[]
  compareOpen: boolean
  toggleId: (id: string, opts?: { max?: number; onMaxReached?: () => void }) => void
  clear: () => void
  setCompareOpen: (open: boolean) => void
}

const MAX_COMPARE = 3

export const useCompareStore = create<CompareState>((set, get) => ({
  selectedIds: [],
  compareOpen: false,
  toggleId: (id, opts) => {
    const max = opts?.max ?? MAX_COMPARE
    const cur = get().selectedIds
    if (cur.includes(id)) {
      set({ selectedIds: cur.filter((x) => x !== id) })
      return
    }
    if (cur.length >= max) {
      // Replace the oldest selected entry to make room
      opts?.onMaxReached?.()
      set({ selectedIds: [...cur.slice(1), id] })
      return
    }
    set({ selectedIds: [...cur, id] })
  },
  clear: () => set({ selectedIds: [], compareOpen: false }),
  setCompareOpen: (open) => set({ compareOpen: open }),
}))

// ── Notifications State ─────────────────────────────────────────────────
// Notifications are loaded from the database via /api/notifications.

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  addNotification: (n: AppNotification) => void
  refreshNotifications: () => Promise<void>
}

function _recount(list: AppNotification[]): number {
  return list.reduce((acc, n) => acc + (n.read ? 0 : 1), 0)
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  markAsRead: (id) => {
    // Update locally + send to API
    set((s) => {
      const next = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      return { notifications: next, unreadCount: _recount(next) }
    })
    // Also update in DB
    fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  },
  markAllAsRead: () => {
    set((s) => {
      const next = s.notifications.map((n) => ({ ...n, read: true }))
      return { notifications: next, unreadCount: 0 }
    })
    // Also update in DB
    fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => {})
  },
  removeNotification: (id) => {
    set((s) => {
      const next = s.notifications.filter((n) => n.id !== id)
      return { notifications: next, unreadCount: _recount(next) }
    })
    // Also delete from DB
    fetch(`/api/notifications?id=${id}`, { method: 'DELETE' }).catch(() => {})
  },
  addNotification: (n) =>
    set((s) => {
      const next = [n, ...s.notifications]
      return {
        notifications: next,
        unreadCount: _recount(next),
      }
    }),
  refreshNotifications: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        // Map DB records to AppNotification format
        const mapped: AppNotification[] = (data.notifications || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          category: n.category as any,
          severity: n.severity as any,
          timestamp: new Date(n.createdAt).toISOString(),
          read: n.read,
          actionLabel: n.actionLabel || undefined,
          actionPage: n.actionPage as any || undefined,
        }))
        set({ notifications: mapped, unreadCount: data.unreadCount || _recount(mapped) })
      }
    } catch (err) {
      console.error('[notifications] refresh error:', err)
    } finally {
      set({ loading: false })
    }
  },
}))

// ── Preferences State (persisted to localStorage) ───────────────────────

export type PrefPageId = 'dashboard' | 'molecules' | 'simulator' | 'studies' | 'degradation' | 'reports' | 'analytics' | 'admin' | 'compliance' | 'interactions'
export type MoleculeView = 'table' | 'grid'
export type StudyView = 'list' | 'timeline'
export type RefreshInterval = '30s' | '1min' | '5min' | '15min' | 'never'

interface PreferencesState {
  // Theme
  sidebarDefaultCollapsed: boolean
  // Notifications
  notificationsEnabled: boolean
  notificationCategories: {
    studies: boolean
    molecules: boolean
    reports: boolean
    system: boolean
    alerts: boolean
  }
  autoRefreshInterval: RefreshInterval
  // Defaults
  defaultLandingPage: PrefPageId
  defaultMoleculeView: MoleculeView
  defaultStudyView: StudyView
  defaultMoleculesPerPage: number
  // Setters
  setSidebarDefaultCollapsed: (v: boolean) => void
  setNotificationsEnabled: (v: boolean) => void
  setNotificationCategory: (cat: keyof PreferencesState['notificationCategories'], v: boolean) => void
  setAutoRefreshInterval: (v: RefreshInterval) => void
  setDefaultLandingPage: (v: PrefPageId) => void
  setDefaultMoleculeView: (v: MoleculeView) => void
  setDefaultStudyView: (v: StudyView) => void
  setDefaultMoleculesPerPage: (v: number) => void
}

// ── Favorites State ──────────────────────────────────────────────────────

export interface FavoriteItem {
  itemType: string
  itemId: string
  itemLabel: string
}

interface FavoriteState {
  favorites: FavoriteItem[]
  loading: boolean
  setFavorites: (favorites: FavoriteItem[]) => void
  setLoading: (loading: boolean) => void
  toggleFavorite: (itemType: string, itemId: string, itemLabel: string) => Promise<void>
  refreshFavorites: () => Promise<void>
  isFavorite: (itemType: string, itemId: string) => boolean
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: [],
  loading: false,
  setFavorites: (favorites) => set({ favorites }),
  setLoading: (loading) => set({ loading }),
  toggleFavorite: async (itemType, itemId, itemLabel) => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, itemId, itemLabel }),
      })
      if (res.ok) {
        const data = await res.json()
        // Refresh the list to reflect the toggle
        await get().refreshFavorites()
      }
    } catch (err) {
      console.error('[favorites] toggle error:', err)
    }
  },
  refreshFavorites: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/favorites')
      if (res.ok) {
        const data = await res.json()
        set({ favorites: data.favorites || [] })
      }
    } catch (err) {
      console.error('[favorites] refresh error:', err)
    } finally {
      set({ loading: false })
    }
  },
  isFavorite: (itemType, itemId) => {
    return get().favorites.some((f) => f.itemType === itemType && f.itemId === itemId)
  },
}))

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      // Theme
      sidebarDefaultCollapsed: false,
      // Notifications
      notificationsEnabled: true,
      notificationCategories: {
        studies: true,
        molecules: true,
        reports: true,
        system: true,
        alerts: true,
      },
      autoRefreshInterval: '1min',
      // Defaults
      defaultLandingPage: 'dashboard',
      defaultMoleculeView: 'table',
      defaultStudyView: 'list',
      defaultMoleculesPerPage: 10,
      // Setters
      setSidebarDefaultCollapsed: (v) => set({ sidebarDefaultCollapsed: v }),
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setNotificationCategory: (cat, v) =>
        set((s) => ({
          notificationCategories: { ...s.notificationCategories, [cat]: v },
        })),
      setAutoRefreshInterval: (v) => set({ autoRefreshInterval: v }),
      setDefaultLandingPage: (v) => set({ defaultLandingPage: v }),
      setDefaultMoleculeView: (v) => set({ defaultMoleculeView: v }),
      setDefaultStudyView: (v) => set({ defaultStudyView: v }),
      setDefaultMoleculesPerPage: (v) => set({ defaultMoleculesPerPage: v }),
    }),
    {
      name: 'chemstab-preferences',
    }
  )
)

