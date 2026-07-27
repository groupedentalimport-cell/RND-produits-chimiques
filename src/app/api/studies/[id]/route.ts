import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────
interface UpdateStudyBody {
  status?: string;
  rejectionReason?: string;
}

// ── GET: Get a single study by ID (include timePoints and signatures) ──
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const study = await db.stabilityStudy.findUnique({
      where: { id },
      include: {
        molecule: { select: { id: true, name: true, formula: true, riskLevel: true } },
        timePoints: { orderBy: { timeDays: 'asc' } },
        signatures: { orderBy: { signedAt: 'desc' } },
      },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ study });
  } catch (error) {
    console.error('GET /api/studies/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study' },
      { status: 500 }
    );
  }
}

// ── POST: Sign a study (create electronic signature + optional status update) ──
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: {
      signerName?: string;
      signerRole?: string;
      meaning?: string;
      signatureHash?: string;
      newStatus?: string;
    } = await request.json();

    const existing = await db.stabilityStudy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    const signerName = body.signerName || 'Dr. Sarah Chen';
    const signerRole = body.signerRole || 'org_admin';
    const meaning = body.meaning || 'Reviewed and Approved';
    const signatureHash =
      body.signatureHash ||
      `${signerName}:${existing.studyCode}:${Date.now()}`.split('').reduce(
        (hash, ch) => ((hash << 5) - hash + ch.charCodeAt(0)) | 0,
        0
      ).toString(16);

    const signature = await db.electronicSignature.create({
      data: {
        signerName,
        signerRole,
        meaning,
        signatureHash,
        studyId: id,
      },
    });

    // Optionally update the study status if requested
    let updatedStudy = existing;
    if (body.newStatus && body.newStatus !== existing.status) {
      updatedStudy = await db.stabilityStudy.update({
        where: { id },
        data: { status: body.newStatus },
      });
    }

    return NextResponse.json({ signature, study: updatedStudy }, { status: 201 });
  } catch (error) {
    console.error('POST /api/studies/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to sign study' },
      { status: 500 }
    );
  }
}

// ── PUT: Update study status ──────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateStudyBody = await request.json();

    const existing = await db.stabilityStudy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    const study = await db.stabilityStudy.update({
      where: { id },
      data: {
        status: body.status,
        rejectionReason: body.rejectionReason ?? (
          body.status === 'rejected' ? null : undefined
        ),
      },
    });

    return NextResponse.json({ study });
  } catch (error) {
    console.error('PUT /api/studies/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update study' },
      { status: 500 }
    );
  }
}
