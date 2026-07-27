import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const favorites = await db.favorite.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ favorites })
  } catch (err) {
    console.error('[favorites] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemType, itemId, itemLabel } = body

    if (!itemType || !itemId || !itemLabel) {
      return NextResponse.json({ error: 'itemType, itemId, and itemLabel are required' }, { status: 400 })
    }

    // Check if already favorited
    const existing = await db.favorite.findFirst({
      where: { itemType, itemId },
    })
    if (existing) {
      // Remove it (toggle off)
      await db.favorite.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: 'removed', id: existing.id })
    }

    // Create new favorite
    const fav = await db.favorite.create({
      data: { itemType, itemId, itemLabel, userId: 'system' },
    })
    return NextResponse.json({ action: 'added', id: fav.id })
  } catch (err) {
    console.error('[favorites] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
