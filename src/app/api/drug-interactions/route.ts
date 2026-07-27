import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ── Drug Interaction API — now database-driven ──────────────────────────────
// Previously used a hardcoded INTERACTIONS_DB array. Now all interactions are
// stored in the DrugInteraction Prisma model and queried from SQLite.

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor' | 'none'

export interface DrugInteractionDTO {
  id: string
  substanceA: string
  substanceB: string
  severity: InteractionSeverity
  mechanism: string
  clinicalEffect: string
  onset: string
  management: string
  evidenceLevel: string
  literatureRef?: string | null
}

function toDTO(row: any): DrugInteractionDTO {
  return {
    id: row.id,
    substanceA: row.substanceA,
    substanceB: row.substanceB,
    severity: row.severity as InteractionSeverity,
    mechanism: row.mechanism,
    clinicalEffect: row.clinicalEffect,
    onset: row.onset,
    management: row.management,
    evidenceLevel: row.evidenceLevel,
    literatureRef: row.literatureRef ?? undefined,
  }
}

// ── GET /api/drug-interactions ───────────────────────────────────────────
// Returns the full interaction catalog from DB, or filters by substance names.

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const substancesParam = searchParams.get('substances')

    // Fetch all interactions from the database
    const allInteractions = await db.drugInteraction.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const dtoList = allInteractions.map(toDTO)

    // If substances param provided, return only matching interactions
    if (substancesParam) {
      const substances = substancesParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      const matched = dtoList.filter((int) => {
        const a = int.substanceA.toLowerCase()
        const b = int.substanceB.toLowerCase()
        // Check both directions
        return substances.some((s) => s === a) && substances.some((s) => s === b)
      })

      return NextResponse.json({
        substances: substancesParam.split(',').map((s) => s.trim()).filter(Boolean),
        interactions: matched,
        total: matched.length,
        severityBreakdown: {
          contraindicated: matched.filter((i) => i.severity === 'contraindicated').length,
          major: matched.filter((i) => i.severity === 'major').length,
          moderate: matched.filter((i) => i.severity === 'moderate').length,
          minor: matched.filter((i) => i.severity === 'minor').length,
        },
      })
    }

    // Otherwise return the full catalog
    const uniqueSubstances = Array.from(
      new Set(dtoList.flatMap((i) => [i.substanceA, i.substanceB])),
    ).sort()

    return NextResponse.json({
      interactions: dtoList,
      total: dtoList.length,
      substances: uniqueSubstances,
    })
  } catch (error) {
    console.error('[drug-interactions] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/drug-interactions ──────────────────────────────────────────
// Create a new drug interaction entry.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { substanceA, substanceB, severity, mechanism, clinicalEffect, onset, management, evidenceLevel, literatureRef } = body

    if (!substanceA || !substanceB) {
      return NextResponse.json({ error: 'substanceA and substanceB are required' }, { status: 400 })
    }

    const interaction = await db.drugInteraction.create({
      data: {
        substanceA,
        substanceB,
        severity: severity || 'minor',
        mechanism: mechanism || '',
        clinicalEffect: clinicalEffect || '',
        onset: onset || 'not_specified',
        management: management || '',
        evidenceLevel: evidenceLevel || 'suspected',
        literatureRef: literatureRef || null,
      },
    })

    return NextResponse.json({ interaction: toDTO(interaction) }, { status: 201 })
  } catch (error) {
    console.error('[drug-interactions] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
