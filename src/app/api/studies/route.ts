import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────
interface CreateStudyBody {
  studyCode: string;
  substanceName: string;
  studyType?: string;
  temperatureC?: number;
  humidityPercent?: number;
  durationMonths?: number;
  status?: string;
  moleculeId?: string;
}

// ── GET: List studies with optional filter by status and type ──────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? '';
    const type = searchParams.get('type') ?? '';
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (type) {
      where.studyType = type;
    }

    const [studies, total] = await Promise.all([
      db.stabilityStudy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          molecule: { select: { id: true, name: true, formula: true } },
        },
      }),
      db.stabilityStudy.count({ where }),
    ]);

    return NextResponse.json({
      studies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/studies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch studies' },
      { status: 500 }
    );
  }
}

// ── POST: Create a new study ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: CreateStudyBody = await request.json();

    if (!body.studyCode) {
      return NextResponse.json(
        { error: 'studyCode is required' },
        { status: 400 }
      );
    }
    if (!body.substanceName) {
      return NextResponse.json(
        { error: 'substanceName is required' },
        { status: 400 }
      );
    }

    const study = await db.stabilityStudy.create({
      data: {
        studyCode: body.studyCode,
        substanceName: body.substanceName,
        studyType: body.studyType ?? 'long_term',
        temperatureC: body.temperatureC ?? 25,
        humidityPercent: body.humidityPercent ?? null,
        durationMonths: body.durationMonths ?? 24,
        status: body.status ?? 'draft',
        moleculeId: body.moleculeId ?? null,
      },
    });

    return NextResponse.json({ study }, { status: 201 });
  } catch (error) {
    console.error('POST /api/studies error:', error);
    return NextResponse.json(
      { error: 'Failed to create study' },
      { status: 500 }
    );
  }
}
