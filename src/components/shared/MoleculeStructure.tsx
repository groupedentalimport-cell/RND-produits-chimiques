'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Atom } from 'lucide-react'

interface MoleculeStructureProps {
  /** SMILES string representing the molecular structure */
  smiles: string
  /** Width of the canvas in pixels (default: 300) */
  width?: number
  /** Height of the canvas in pixels (default: 200) */
  height?: number
  /** Additional CSS class names */
  className?: string
}

/**
 * Renders a 2D molecular structure from a SMILES string using smiles-drawer.
 *
 * Supports light/dark themes via next-themes, handles empty and invalid
 * SMILES with a fallback placeholder, and adapts to its parent container.
 */
export function MoleculeStructure({
  smiles,
  width = 300,
  height = 200,
  className = '',
}: MoleculeStructureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isValid, setIsValid] = useState(true)
  const [hasDrawn, setHasDrawn] = useState(false)
  const { resolvedTheme } = useTheme()

  // Determine the effective theme for smiles-drawer
  const drawerTheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  const drawMolecule = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !smiles.trim()) return

    // Dynamic import to avoid SSR issues
    import('smiles-drawer').then((SmilesDrawerModule) => {
      const SmilesDrawer = SmilesDrawerModule.default

      // Calculate responsive dimensions
      const container = containerRef.current
      const effectiveWidth = container
        ? Math.min(width, container.clientWidth - 2)
        : width
      const effectiveHeight = height

      // Set canvas dimensions (accounting for device pixel ratio for sharpness)
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      canvas.width = effectiveWidth * dpr
      canvas.height = effectiveHeight * dpr
      canvas.style.width = `${effectiveWidth}px`
      canvas.style.height = `${effectiveHeight}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }

      // Create a SmiDrawer instance with molecule options
      const drawer = new SmilesDrawer.SmiDrawer({
        width: effectiveWidth,
        height: effectiveHeight,
      })

      // Draw the molecule onto the canvas
      drawer.draw(
        smiles,
        canvas,
        drawerTheme,
        () => {
          // Success callback
          setIsValid(true)
          setHasDrawn(true)
        },
        () => {
          // Error callback - invalid SMILES
          setIsValid(false)
          setHasDrawn(true)
        }
      )
    }).catch(() => {
      setIsValid(false)
      setHasDrawn(true)
    })
  }, [smiles, width, height, drawerTheme])

  useEffect(() => {
    if (!smiles.trim()) {
      setIsValid(false)
      setHasDrawn(true)
      return
    }

    setIsValid(true)
    setHasDrawn(false)
    drawMolecule()
  }, [smiles, drawMolecule])

  // Handle window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (smiles.trim()) {
        drawMolecule()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [smiles, drawMolecule])

  // Empty or invalid SMILES fallback
  const showFallback = hasDrawn && (!smiles.trim() || !isValid)

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg border border-border bg-card ${
        resolvedTheme === 'dark' ? 'bg-muted/30' : 'bg-muted/20'
      } ${className}`}
      style={{ maxWidth: '100%' }}
    >
      {showFallback ? (
        <div
          className="flex flex-col items-center justify-center gap-2 text-muted-foreground"
          style={{ width: Math.min(width, containerRef.current?.clientWidth ?? width), height }}
        >
          <Atom className="h-8 w-8 opacity-40" />
          <span className="text-sm font-medium opacity-60">No structure available</span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="block"
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
