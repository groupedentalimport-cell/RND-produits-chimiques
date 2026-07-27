import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const studyId = searchParams.get('studyId')
    const moleculeId = searchParams.get('moleculeId')

    const where: any = {}
    if (studyId) where.studyId = studyId
    if (moleculeId) where.moleculeId = moleculeId

    const batches = await db.batch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        study: { select: { studyCode: true, substanceName: true } },
        molecule: { select: { name: true, formula: true } },
      },
    })

    return NextResponse.json({ batches, total: batches.length })
  } catch (err) {
    console.error('[batches] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchNumber, scale, manufactureDate, expiryDate, containerClosure, batchSize, studyId, moleculeId } = body

    if (!batchNumber) {
      return NextResponse.json({ error: 'batchNumber is required' }, { status: 400 })
    }

    // Check for duplicate batch number
    const existing = await db.batch.findUnique({ where: { batchNumber } })
    if (existing) {
      return NextResponse.json({ error: 'Batch number already exists' }, { status: 409 })
    }

    const batch = await db.batch.create({
      data: {
        batchNumber,
        scale: scale || 'pilot',
        manufactureDate: manufactureDate ? new Date(manufactureDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        containerClosure: containerClosure || null,
        batchSize: batchSize || null,
        studyId: studyId || null,
        moleculeId: moleculeId || null,
      },
    })

    try {
      await db.auditLog.create({
        data: {
          action: 'create',
          tableName: 'Batch',
          recordId: batch.id,
          details: `Created batch ${batchNumber} (scale: ${scale || 'pilot'})`,
          userId: 'system',
        },
      })
    } catch {
      // audit log failure should not fail the API call
    }

    return NextResponse.json({ batch }, { status: 201 })
  } catch (err) {
    console.error('[batches] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
