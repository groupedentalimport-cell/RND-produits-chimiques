import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────
interface UpdateMoleculeBody {
  name?: string;
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

// ── GET: Get a single molecule by ID ───────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const molecule = await db.molecule.findUnique({ where: { id } });

    if (!molecule) {
      return NextResponse.json(
        { error: 'Molecule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ molecule });
  } catch (error) {
    console.error('GET /api/molecules/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch molecule' },
      { status: 500 }
    );
  }
}

// ── PUT: Update a molecule by ID ──────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateMoleculeBody = await request.json();

    const existing = await db.molecule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Molecule not found' },
        { status: 404 }
      );
    }

    const molecule = await db.molecule.update({
      where: { id },
      data: {
        name: body.name,
        casNumber: body.casNumber,
        smiles: body.smiles,
        formula: body.formula,
        molarMass: body.molarMass,
        logP: body.logP,
        predictedStabilityScore: body.predictedStabilityScore,
        riskLevel: body.riskLevel,
        dataSource: body.dataSource,
        description: body.description,
      },
    });

    return NextResponse.json({ molecule });
  } catch (error) {
    console.error('PUT /api/molecules/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update molecule' },
      { status: 500 }
    );
  }
}

// ── DELETE: Delete a molecule by ID ────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.molecule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Molecule not found' },
        { status: 404 }
      );
    }

    await db.molecule.delete({ where: { id } });

    return NextResponse.json({ message: 'Molecule deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/molecules/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete molecule' },
      { status: 500 }
    );
  }
}
