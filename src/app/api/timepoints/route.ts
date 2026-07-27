import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface CreateTimePointBody {
  timeDays: number;
  timeMonths?: number;
  concentration?: number;
  percentRemaining?: number;
  degradationPercent?: number;
  isOOS?: boolean;
  isOOT?: boolean;
  studyId: string;
}

// ── GET: List time points (filter by studyId) ─────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studyId = searchParams.get('studyId') ?? '';

    const where: Record<string, unknown> = {};
    if (studyId) where.studyId = studyId;

    const timePoints = await db.timePoint.findMany({
      where,
      orderBy: { timeDays: 'asc' },
    });

    return NextResponse.json({ timePoints });
  } catch (error) {
    console.error('GET /api/timepoints error:', error);
    return NextResponse.json({ error: 'Failed to fetch time points' }, { status: 500 });
  }
}

// ── POST: Create a new time point ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: CreateTimePointBody = await request.json();

    if (!body.studyId || body.timeDays === undefined) {
      return NextResponse.json(
        { error: 'studyId and timeDays are required' },
        { status: 400 }
      );
    }

    const study = await db.stabilityStudy.findUnique({ where: { id: body.studyId } });
    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    const timeMonths = body.timeMonths ?? body.timeDays / 30.44;

    const timePoint = await db.timePoint.create({
      data: {
        timeDays: body.timeDays,
        timeMonths: Math.round(timeMonths * 100) / 100,
        concentration: body.concentration ?? null,
        percentRemaining: body.percentRemaining ?? null,
        degradationPercent: body.degradationPercent ?? null,
        isOOS: body.isOOS ?? false,
        isOOT: body.isOOT ?? false,
        studyId: body.studyId,
      },
    });

    return NextResponse.json({ timePoint }, { status: 201 });
  } catch (error) {
    console.error('POST /api/timepoints error:', error);
    return NextResponse.json({ error: 'Failed to create time point' }, { status: 500 });
  }
}
