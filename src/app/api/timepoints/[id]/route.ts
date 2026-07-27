import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface UpdateTimePointBody {
  timeDays?: number;
  concentration?: number;
  percentRemaining?: number;
  degradationPercent?: number;
  isOOS?: boolean;
  isOOT?: boolean;
}

// ── PUT: Update a time point ──────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateTimePointBody = await request.json();

    const existing = await db.timePoint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Time point not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.timeDays !== undefined) {
      data.timeDays = body.timeDays;
      data.timeMonths = Math.round((body.timeDays / 30.44) * 100) / 100;
    }
    if (body.concentration !== undefined) data.concentration = body.concentration;
    if (body.percentRemaining !== undefined) data.percentRemaining = body.percentRemaining;
    if (body.degradationPercent !== undefined) data.degradationPercent = body.degradationPercent;
    if (body.isOOS !== undefined) data.isOOS = body.isOOS;
    if (body.isOOT !== undefined) data.isOOT = body.isOOT;

    const timePoint = await db.timePoint.update({ where: { id }, data });
    return NextResponse.json({ timePoint });
  } catch (error) {
    console.error('PUT /api/timepoints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update time point' }, { status: 500 });
  }
}

// ── DELETE: Delete a time point ───────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.timePoint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Time point not found' }, { status: 404 });
    }

    await db.timePoint.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/timepoints/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete time point' }, { status: 500 });
  }
}
