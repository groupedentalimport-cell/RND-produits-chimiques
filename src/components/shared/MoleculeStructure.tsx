'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Atom } from 'lucide-react'

interface MoleculeStructureProps {
  /** SMILES string representing the molecular structure */
  smiles: string
  /** Width of the rendering area in pixels (default: 300) */
  width?: number
  /** Height of the rendering area in pixels (default: 200) */
  height?: number
  /** Additional CSS class names */
  className?: string
}

/**
 * Renders a 2D molecular structure from a SMILES string using smiles-drawer.
 *
 * Uses SVG rendering (more reliable than canvas). Supports light/dark themes
 * via next-themes, handles empty and invalid SMILES with a fallback placeholder.
 */
export function MoleculeStructure({
  smiles,
  width = 300,
  height = 200,
  className = '',
}: MoleculeStructureProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const { resolvedTheme } = useTheme()

  // Determine the effective theme for smiles-drawer
  const drawerTheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  const drawMolecule = useCallback(() => {
    const svgEl = svgRef.current
    if (!svgEl || !smiles.trim()) {
      setStatus('error')
      return
    }

    setStatus('loading')

    // Dynamic import to avoid SSR issues
    import('smiles-drawer').then((SmilesDrawerModule) => {
      const SmilesDrawer = SmilesDrawerModule.default

      if (!SmilesDrawer) {
        setStatus('error')
        return
      }

      // Calculate responsive dimensions
      const container = containerRef.current
      const effectiveWidth = container
        ? Math.min(width, container.clientWidth - 4)
        : width
      const effectiveHeight = height

      // Ensure SVG element has correct dimensions
      svgEl.setAttribute('width', String(effectiveWidth))
      svgEl.setAttribute('height', String(effectiveHeight))
      svgEl.style.width = `${effectiveWidth}px`
      svgEl.style.height = `${effectiveHeight}px`

      // Clear any previous content
      while (svgEl.firstChild) {
        svgEl.removeChild(svgEl.firstChild)
      }

      try {
        // Use SvgDrawer directly for SVG rendering (more reliable than canvas)
        const SvgDrawerClass = SmilesDrawer.SvgDrawer
        const drawerOptions = {
          width: effectiveWidth,
          height: effectiveHeight,
          bondThickness: 1.0,
          bondLength: 15,
          shortBondLength: 0.85,
          bondSpacing: 0.18 * 15,
          atomVisualization: 'default',
          isomeric: true,
          debug: false,
          terminalCarbons: false,
          compactDrawing: true,
          fontSizeLarge: 11,
          fontSizeSmall: 3,
          padding: 12,
        }

        const svgDrawer = new SvgDrawerClass(drawerOptions)

        // Parse the SMILES and draw to SVG
        SmilesDrawer.parse(
          smiles,
          (tree: any) => {
            // Success parsing — now draw
            try {
              svgDrawer.draw(tree, svgEl, drawerTheme, null, false)
              setStatus('success')
            } catch {
              setStatus('error')
            }
          },
          (err: Error) => {
            // Error parsing SMILES
            setStatus('error')
          }
        )
      } catch {
        setStatus('error')
      }
    }).catch(() => {
      setStatus('error')
    })
  }, [smiles, width, height, drawerTheme])

  useEffect(() => {
    if (!smiles.trim()) {
      setStatus('error')
      return
    }

    setStatus('loading')
    // Small delay to ensure SVG element is mounted in DOM
    const timer = setTimeout(() => {
      drawMolecule()
    }, 50)
    return () => clearTimeout(timer)
  }, [smiles, drawMolecule])

  // Handle window resize for responsiveness
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (smiles.trim()) {
          drawMolecule()
        }
      }, 200)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [smiles, drawMolecule])

  // Show fallback for empty SMILES or rendering errors
  const showFallback = !smiles.trim() || status === 'error'
  const showLoading = status === 'loading' && !showFallback

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg border border-border/60 bg-card ${
        resolvedTheme === 'dark' ? 'bg-muted/20' : 'bg-muted/10'
      } ${className}`}
      style={{ maxWidth: '100%', minHeight: height }}
    >
      {/* Loading state */}
      {showLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted/10 z-10"
          style={{ width: '100%', height }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="size-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            <span className="text-[10px] text-muted-foreground">Rendering...</span>
          </div>
        </div>
      )}

      {/* Fallback for empty/invalid SMILES */}
      {showFallback ? (
        <div
          className="flex flex-col items-center justify-center gap-2 text-muted-foreground"
          style={{ width: '100%', height }}
        >
          <Atom className="h-8 w-8 opacity-40" />
          <span className="text-sm font-medium opacity-60">No structure available</span>
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="block mx-auto"
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
          aria-label={`Molecular structure for SMILES: ${smiles}`}
          role="img"
        />
      )}
    </div>
  )
}
