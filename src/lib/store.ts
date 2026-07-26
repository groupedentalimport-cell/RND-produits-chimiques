import { create } from 'zustand'

// ── Navigation State ────────────────────────────────────────────────────

type PageId = 'dashboard' | 'molecules' | 'simulator' | 'studies' | 'reports' | 'analytics' | 'degradation' | 'admin'

interface AppState {
  currentPage: PageId
  sidebarOpen: boolean
  darkMode: boolean
  setPage: (page: PageId) => void
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  sidebarOpen: true,
  darkMode: false,
  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
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
