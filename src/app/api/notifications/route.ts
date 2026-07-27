import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ── GET: List notifications from database ───────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
    const category = searchParams.get('category') ?? ''

    const where: Record<string, unknown> = {}
    if (category) where.category = category

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await db.notification.count({
      where: { read: false },
    })

    return NextResponse.json({
      notifications,
      unreadCount,
    })
  } catch (error) {
    console.error('[notifications] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST: Create a new notification ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, message, category, severity, actionLabel, actionPage } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    const notification = await db.notification.create({
      data: {
        title,
        message,
        category: category || 'system',
        severity: severity || 'info',
        read: false,
        actionLabel: actionLabel || null,
        actionPage: actionPage || null,
        userId: 'system',
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('[notifications] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT: Mark notifications as read ─────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, markAll } = body

    if (markAll) {
      await db.notification.updateMany({
        where: { read: false },
        data: { read: true },
      })
      return NextResponse.json({ action: 'all_marked_read' })
    }

    if (!id) {
      return NextResponse.json({ error: 'id or markAll is required' }, { status: 400 })
    }

    const notification = await db.notification.update({
      where: { id },
      data: { read: true },
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('[notifications] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE: Remove a notification ───────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await db.notification.delete({ where: { id } })

    return NextResponse.json({ action: 'deleted' })
  } catch (error) {
    console.error('[notifications] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
