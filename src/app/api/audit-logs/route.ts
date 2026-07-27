import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET: List audit logs with filtering ───────────────────────────────
// Supports: ?action=create|update|delete|approve|sign&table=Molecule&userId=xxx&q=&limit=20&page=1&from=&to=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') ?? '';
    const tableName = searchParams.get('table') ?? '';
    const userId = searchParams.get('userId') ?? '';
    const q = searchParams.get('q') ?? '';
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (tableName) where.tableName = tableName;
    if (userId) where.userId = userId;
    if (q) {
      where.OR = [
        { details: { contains: q } },
        { recordId: { contains: q } },
      ];
    }

    // Date range filter
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.createdAt = dateFilter;
    }

    const [logs, total, actionCounts, tableCounts] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
      db.auditLog.groupBy({ by: ['action'], _count: { action: true } }),
      db.auditLog.groupBy({ by: ['tableName'], _count: { tableName: true } }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page, limit, total, totalPages: Math.ceil(total / limit),
      },
      facets: {
        actions: actionCounts.map(a => ({ action: a.action, count: a._count.action })),
        tables: tableCounts.map(t => ({ table: t.tableName, count: t._count.tableName })),
      },
    });
  } catch (error) {
    console.error('GET /api/audit-logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
