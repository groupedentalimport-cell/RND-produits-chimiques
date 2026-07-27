import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Ensure complianceReport model is available (hot-reload safe)
    if (!db.complianceReport) {
      return NextResponse.json({ reports: [], total: 0 })
    }
    const reports = await db.complianceReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const formatted = reports.map((r) => ({
      id: r.id,
      studyId: r.studyId,
      studyCode: r.studyCode,
      substanceName: r.substanceName,
      overallScore: r.overallScore,
      passCount: r.passCount,
      warningCount: r.warningCount,
      failCount: r.failCount,
      notApplicableCount: r.notApplicableCount,
      readyForSubmission: r.readyForSubmission,
      categoryScores: JSON.parse(r.categoryScores || '[]'),
      blockingIssues: JSON.parse(r.blockingIssues || '[]'),
      checkedBy: r.checkedBy,
      createdAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json({ reports: formatted, total: reports.length })
  } catch (err) {
    console.error('[compliance-history] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
