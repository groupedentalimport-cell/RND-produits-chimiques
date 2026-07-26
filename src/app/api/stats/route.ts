import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET: Dashboard statistics ─────────────────────────────────────────
export async function GET() {
  try {
    // Total molecules
    const totalMolecules = await db.molecule.count();

    // Active studies (status: in_progress, under_review, approved)
    const activeStudies = await db.stabilityStudy.count({
      where: {
        status: { in: ['in_progress', 'under_review', 'approved'] },
      },
    });

    // Average stability score
    const moleculesWithScore = await db.molecule.findMany({
      where: { predictedStabilityScore: { not: null } },
      select: { predictedStabilityScore: true },
    });

    const avgStabilityScore =
      moleculesWithScore.length > 0
        ? moleculesWithScore.reduce(
            (sum, m) => sum + (m.predictedStabilityScore ?? 0),
            0
          ) / moleculesWithScore.length
        : 0;

    // Risk distribution
    const riskDistribution = await db.molecule.groupBy({
      by: ['riskLevel'],
      _count: { riskLevel: true },
    });

    const riskMap: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
    for (const entry of riskDistribution) {
      riskMap[entry.riskLevel] = entry._count.riskLevel;
    }

    // Recent activity (last 5 audit logs)
    const recentActivity = await db.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // Studies by status
    const studiesByStatus = await db.stabilityStudy.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Total reports
    const totalReports = await db.report.count();

    return NextResponse.json({
      totalMolecules,
      activeStudies,
      avgStabilityScore: Math.round(avgStabilityScore * 100) / 100,
      riskDistribution: riskMap,
      recentActivity,
      studiesByStatus,
      totalReports,
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
