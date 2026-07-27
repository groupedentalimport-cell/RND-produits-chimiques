import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────
interface CreateMoleculeBody {
  name: string;
  casNumber?: string;
  smiles?: string;
  formula?: string;
  molarMass?: number;
  logP?: number;
  predictedStabilityScore?: number;
  riskLevel?: string;
  dataSource?: string;
  description?: string;
}

// ── GET: List molecules with search, pagination, risk filter ───────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const risk = searchParams.get('risk') ?? '';
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { casNumber: { contains: q } },
        { smiles: { contains: q } },
        { formula: { contains: q } },
      ];
    }

    if (risk) {
      where.riskLevel = risk;
    }

    const [molecules, total] = await Promise.all([
      db.molecule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.molecule.count({ where }),
    ]);

    return NextResponse.json({
      molecules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/molecules error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch molecules' },
      { status: 500 }
    );
  }
}

// ── POST: Create a new molecule ────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: CreateMoleculeBody = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Molecule name is required' },
        { status: 400 }
      );
    }

    const molecule = await db.molecule.create({
      data: {
        name: body.name,
        casNumber: body.casNumber ?? null,
        smiles: body.smiles ?? null,
        formula: body.formula ?? null,
        molarMass: body.molarMass ?? null,
        logP: body.logP ?? null,
        predictedStabilityScore: body.predictedStabilityScore ?? null,
        riskLevel: body.riskLevel ?? 'low',
        dataSource: body.dataSource ?? 'manual',
        description: body.description ?? null,
      },
    });

    return NextResponse.json({ molecule }, { status: 201 });
  } catch (error) {
    console.error('POST /api/molecules error:', error);
    return NextResponse.json(
      { error: 'Failed to create molecule' },
      { status: 500 }
    );
  }
}
