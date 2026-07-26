import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface UpdateUserBody {
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

// ── GET: Single user ──────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        orgId: true, createdAt: true, updatedAt: true,
        auditLogs: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('GET /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// ── PUT: Update user ──────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateUserBody = await request.json();

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Email uniqueness check if changing
    if (body.email && body.email !== existing.email) {
      const emailTaken = await db.user.findUnique({ where: { email: body.email } });
      if (emailTaken) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    const user = await db.user.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        isActive: body.isActive,
      },
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// ── DELETE: Soft-delete by deactivating ───────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete: deactivate instead of deleting to preserve audit trail
    const user = await db.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });

    return NextResponse.json({ user, deactivated: true });
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
