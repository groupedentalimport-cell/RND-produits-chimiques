'use client'

import { formatFormula } from '@/lib/sample-data'

// React element version (in case we want richer rendering later)
export function Formula({ children }: { children: string | null | undefined }) {
  return <span className="font-mono">{formatFormula(children)}</span>
}
