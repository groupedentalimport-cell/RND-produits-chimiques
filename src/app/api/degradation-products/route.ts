import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface CreateDegradationProductBody {
  name: string;
  smiles?: string;
  percentage?: number;
  hazardLevel?: string;
  moleculeId: string;
}

// ── GET: List degradation products (filter by moleculeId) ─────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moleculeId = searchParams.get('moleculeId') ?? '';

    const where: Record<string, unknown> = {};
    if (moleculeId) where.moleculeId = moleculeId;

    const products = await db.degradationProduct.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        molecule: { select: { id: true, name: true, formula: true, riskLevel: true } },
      },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('GET /api/degradation-products error:', error);
    return NextResponse.json({ error: 'Failed to fetch degradation products' }, { status: 500 });
  }
}

// ── POST: Create a new degradation product ────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: CreateDegradationProductBody = await request.json();

    if (!body.name || !body.moleculeId) {
      return NextResponse.json(
        { error: 'Name and moleculeId are required' },
        { status: 400 }
      );
    }

    // Validate molecule exists
    const molecule = await db.molecule.findUnique({ where: { id: body.moleculeId } });
    if (!molecule) {
      return NextResponse.json({ error: 'Molecule not found' }, { status: 404 });
    }

    const product = await db.degradationProduct.create({
      data: {
        name: body.name,
        smiles: body.smiles ?? null,
        percentage: body.percentage ?? null,
        hazardLevel: body.hazardLevel ?? 'low',
        moleculeId: body.moleculeId,
      },
      include: {
        molecule: { select: { id: true, name: true, formula: true, riskLevel: true } },
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('POST /api/degradation-products error:', error);
    return NextResponse.json({ error: 'Failed to create degradation product' }, { status: 500 });
  }
}
