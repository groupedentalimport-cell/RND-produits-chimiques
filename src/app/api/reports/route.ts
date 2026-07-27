import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────
interface CreateReportBody {
  title: string;
  reportType: string;
  studyId?: string;
}

// ── GET: List all reports ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const skip = (page - 1) * limit;
    const reportType = searchParams.get('type') ?? '';

    const where: Record<string, unknown> = {};
    if (reportType) {
      where.reportType = reportType;
    }

    const [reports, total] = await Promise.all([
      db.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.report.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/reports error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// ── POST: Create a new report ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body: CreateReportBody = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: 'Report title is required' },
        { status: 400 }
      );
    }
    if (!body.reportType) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      );
    }

    const report = await db.report.create({
      data: {
        title: body.title,
        reportType: body.reportType,
        studyId: body.studyId ?? null,
        status: 'draft',
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('POST /api/reports error:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}
