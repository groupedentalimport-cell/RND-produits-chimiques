'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import type { PageId } from '@/lib/types'
import { DashboardPage } from '@/components/pages/DashboardPage'
import { MoleculesPage } from '@/components/pages/MoleculesPage'
import { SimulatorPage } from '@/components/pages/SimulatorPage'
import { StudiesPage } from '@/components/pages/StudiesPage'
import { DegradationPage } from '@/components/pages/DegradationPage'
import { ReportsPage } from '@/components/pages/ReportsPage'
import { AnalyticsPage } from '@/components/pages/AnalyticsPage'
import { AdminPage } from '@/components/pages/AdminPage'
import { PageSkeleton } from '@/components/shared/PageSkeleton'

export function PageRouter() {
  const { currentPage } = useAppStore()
  // Brief loading shimmer when switching pages for a sense of polish
  const [showSkeleton, setShowSkeleton] = useState(false)

  const pages: Record<PageId, React.ReactNode> = {
    dashboard: <DashboardPage />,
    molecules: <MoleculesPage />,
    simulator: <SimulatorPage />,
    studies: <StudiesPage />,
    degradation: <DegradationPage />,
    reports: <ReportsPage />,
    analytics: <AnalyticsPage />,
    admin: <AdminPage />,
  }

  // Scroll to top when page changes + brief skeleton flash for polish.
  // The synchronous setState here is intentional — we explicitly want a brief
  // loading state on every navigation, which is a legitimate use of an effect.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowSkeleton(true)
    const t = setTimeout(() => setShowSkeleton(false), 400)
    return () => clearTimeout(t)
  }, [currentPage])

  return (
    <AnimatePresence mode="wait">
      {showSkeleton ? (
        <motion.div
          key={`skeleton-${currentPage}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <PageSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key={currentPage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto"
        >
          {pages[currentPage]}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
