import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ── Drug Interaction Knowledge Base ──────────────────────────────────────
// A curated database of known drug-drug and drug-food interactions relevant
// to pharmaceutical stability assessment. Each interaction has a severity
// level, mechanism, clinical effect, and management recommendation.

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor' | 'none'

export interface DrugInteraction {
  id: string
  substanceA: string
  substanceB: string
  severity: InteractionSeverity
  mechanism: string
  clinicalEffect: string
  onset: 'rapid' | 'delayed' | 'not_specified'
  management: string
  evidenceLevel: 'established' | 'probable' | 'suspected' | 'theoretical'
  literatureRef?: string
}

// ── Curated interaction database ─────────────────────────────────────────

const INTERACTIONS_DB: DrugInteraction[] = [
  {
    id: 'int-001',
    substanceA: 'Aspirin',
    substanceB: 'Ibuprofen',
    severity: 'major',
    mechanism: 'Ibuprofen competitively inhibits aspirin binding to platelet COX-1, reducing aspirin\'s antiplatelet cardioprotective effect.',
    clinicalEffect: 'Reduced antiplatelet efficacy of aspirin; increased cardiovascular risk in patients taking aspirin for secondary prevention.',
    onset: 'rapid',
    management: 'Take aspirin at least 30 minutes before ibuprofen, or use an alternative NSAID (e.g., naproxen). Consider paracetamol for analgesia.',
    evidenceLevel: 'established',
    literatureRef: 'FDA Drug Safety Communication (2014)',
  },
  {
    id: 'int-002',
    substanceA: 'Aspirin',
    substanceB: 'Acetaminophen',
    severity: 'minor',
    mechanism: 'No significant pharmacokinetic interaction. Both can be used together for synergistic analgesic/antipyretic effects.',
    clinicalEffect: 'Generally safe combination; additive antipyretic effect.',
    onset: 'not_specified',
    management: 'No dose adjustment required. Monitor for gastric irritation with prolonged use.',
    evidenceLevel: 'established',
  },
  {
    id: 'int-003',
    substanceA: 'Ibuprofen',
    substanceB: 'Caffeine',
    severity: 'moderate',
    mechanism: 'Caffeine may enhance the analgesic effect of ibuprofen but can also increase GI irritation risk.',
    clinicalEffect: 'Enhanced analgesia; potential for increased gastric acid secretion.',
    onset: 'rapid',
    management: 'Generally safe at standard OTC doses. Take with food to reduce GI irritation.',
    evidenceLevel: 'probable',
  },
  {
    id: 'int-004',
    substanceA: 'Aspirin',
    substanceB: 'Hydrogen Peroxide',
    severity: 'contraindicated',
    mechanism: 'Aspirin (acetylsalicylic acid) undergoes oxidative degradation in the presence of strong oxidizers like H₂O₂, producing toxic salicylic acid derivatives and oxygen gas.',
    clinicalEffect: 'Chemical incompatibility — formulation instability, potential for container rupture from gas evolution.',
    onset: 'rapid',
    management: 'Never co-formulate or co-administer. Store separately. Use antioxidant packaging if both must be in the same facility.',
    evidenceLevel: 'established',
    literatureRef: 'USP <1074> Stability Considerations',
  },
  {
    id: 'int-005',
    substanceA: 'Caffeine',
    substanceB: 'Acetaminophen',
    severity: 'minor',
    mechanism: 'Caffeine enhances absorption rate of acetaminophen; common fixed-dose combination products exist.',
    clinicalEffect: 'Faster onset of analgesia; no clinically significant safety concern at therapeutic doses.',
    onset: 'rapid',
    management: 'Safe combination. Many OTC products combine these. Monitor total daily caffeine intake.',
    evidenceLevel: 'established',
  },
  {
    id: 'int-006',
    substanceA: 'Acetaminophen',
    substanceB: 'Hydrogen Peroxide',
    severity: 'major',
    mechanism: 'H₂O₂ oxidizes the amide bond in acetaminophen, producing N-acetyl-p-benzoquinone imine (NAPQI) — a hepatotoxic metabolite.',
    clinicalEffect: 'Increased risk of hepatotoxicity; chemical incompatibility in formulation.',
    onset: 'delayed',
    management: 'Avoid co-formulation. Ensure no oxidizing residue in manufacturing equipment. Monitor liver enzymes if co-administered.',
    evidenceLevel: 'established',
    literatureRef: 'Mitchell et al., J Pharmacol Exp Ther (1973)',
  },
  {
    id: 'int-007',
    substanceA: 'Ibuprofen',
    substanceB: 'Acetaminophen',
    severity: 'minor',
    mechanism: 'No significant pharmacokinetic interaction. Different mechanisms of action (COX inhibition vs. central COX/serotonin).',
    clinicalEffect: 'Additive or synergistic analgesia; commonly alternated in pediatric fever management.',
    onset: 'not_specified',
    management: 'Safe combination at therapeutic doses. Useful for multimodal analgesia.',
    evidenceLevel: 'established',
  },
  {
    id: 'int-008',
    substanceA: 'Aspirin',
    substanceB: 'Caffeine',
    severity: 'moderate',
    mechanism: 'Caffeine may increase aspirin absorption rate and enhance analgesic effect; can increase gastric irritation.',
    clinicalEffect: 'Enhanced analgesia; potential increased GI side effects.',
    onset: 'rapid',
    management: 'Common in OTC combination products. Take with food. Monitor for GI symptoms.',
    evidenceLevel: 'established',
  },
  {
    id: 'int-009',
    substanceA: 'Formaldehyde',
    substanceB: 'Aspirin',
    severity: 'major',
    mechanism: 'Formaldehyde can react with aspirin\'s carboxyl group, forming unstable adducts and accelerating hydrolysis.',
    clinicalEffect: 'Formulation instability; potential for toxic byproduct formation.',
    onset: 'delayed',
    management: 'Avoid co-formulation. Ensure formaldehyde-free manufacturing environments. Test for residual formaldehyde in excipients.',
    evidenceLevel: 'probable',
  },
  {
    id: 'int-010',
    substanceA: 'Ethanol',
    substanceB: 'Acetaminophen',
    severity: 'major',
    mechanism: 'Ethanol induces CYP2E1, increasing conversion of acetaminophen to NAPQI hepatotoxic metabolite.',
    clinicalEffect: 'Increased risk of severe hepatotoxicity, especially with chronic alcohol use or overdose.',
    onset: 'delayed',
    management: 'Patients consuming ≥3 alcoholic drinks daily should avoid acetaminophen or limit to ≤2 g/day. Warn patients about OTC products containing acetaminophen.',
    evidenceLevel: 'established',
    literatureRef: 'FDA Hepatotoxicity Warning Label (2011)',
  },
]

// ── Helper: find interactions for given substance names ──────────────────

function findInteractions(substances: string[]): DrugInteraction[] {
  if (substances.length < 2) return []
  const normalized = substances.map((s) => s.trim().toLowerCase())
  const found: DrugInteraction[] = []
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i]
      const b = normalized[j]
      // Check both directions in the database
      const match = INTERACTIONS_DB.find(
        (int) =>
          (int.substanceA.toLowerCase() === a && int.substanceB.toLowerCase() === b) ||
          (int.substanceA.toLowerCase() === b && int.substanceB.toLowerCase() === a),
      )
      if (match) found.push(match)
    }
  }
  return found
}

// ── GET /api/drug-interactions ───────────────────────────────────────────
// Returns the full interaction knowledge base (for the reference catalog UI)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const substancesParam = searchParams.get('substances')

  // If substances param provided, return only matching interactions
  if (substancesParam) {
    const substances = substancesParam.split(',').map((s) => s.trim()).filter(Boolean)
    const interactions = findInteractions(substances)
    return NextResponse.json({
      substances,
      interactions,
      total: interactions.length,
      severityBreakdown: {
        contraindicated: interactions.filter((i) => i.severity === 'contraindicated').length,
        major: interactions.filter((i) => i.severity === 'major').length,
        moderate: interactions.filter((i) => i.severity === 'moderate').length,
        minor: interactions.filter((i) => i.severity === 'minor').length,
      },
    })
  }

  // Otherwise return the full catalog
  return NextResponse.json({
    interactions: INTERACTIONS_DB,
    total: INTERACTIONS_DB.length,
    substances: Array.from(
      new Set(INTERACTIONS_DB.flatMap((i) => [i.substanceA, i.substanceB])),
    ).sort(),
  })
}
