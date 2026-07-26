'use client'

import { useState, useEffect, useRef } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  className?: string
  glow?: boolean
}

// Animated number counter for stat cards
// Uses requestAnimationFrame for smooth 60fps animation with ease-out cubic
export function AnimatedNumber({ value, duration = 1000, className = 'text-2xl font-bold tabular-nums', glow = false }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    // Reset on value change
    startRef.current = null
    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(eased * value)
      setDisplay(current)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(value)
      }
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [value, duration])

  return <span className={`${className} ${glow ? 'number-glow' : ''}`}>{display}</span>
}
