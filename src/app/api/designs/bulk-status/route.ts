import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_TRANSITIONS: Record<string, string[]> = {
  REVIEW: ['APPROVED'],
  APPROVED: ['REVIEW', 'LIVE'],
  DRAFT: ['REVIEW', 'APPROVED'],
}

// POST /api/designs/bulk-status  { designIds: string[], status: string }
export async function POST(request: NextRequest) {
  try {
    const { designIds, status } = await request.json()

    if (!Array.isArray(designIds) || designIds.length === 0) {
      return NextResponse.json(
        { error: 'designIds moet een niet-lege array zijn' },
        { status: 400 }
      )
    }
    if (!status || typeof status !== 'string') {
      return NextResponse.json(
        { error: 'status is verplicht' },
        { status: 400 }
      )
    }

    // Verify all designs exist and have a valid current status for this transition
    const designs = await prisma.design.findMany({
      where: { id: { in: designIds } },
      select: { id: true, status: true },
    })

    if (designs.length !== designIds.length) {
      const found = new Set(designs.map((d) => d.id))
      const missing = designIds.filter((id: string) => !found.has(id))
      return NextResponse.json(
        { error: `Designs niet gevonden: ${missing.join(', ')}` },
        { status: 404 }
      )
    }

    const invalid = designs.filter((d) => {
      const allowed = VALID_TRANSITIONS[d.status]
      return !allowed || !allowed.includes(status)
    })

    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Ongeldige statusovergang voor ${invalid.length} design(s)`,
          details: invalid.map((d) => ({
            id: d.id,
            currentStatus: d.status,
            requestedStatus: status,
          })),
        },
        { status: 409 }
      )
    }

    // Single batch update
    const result = await prisma.design.updateMany({
      where: { id: { in: designIds } },
      data: { status },
    })

    return NextResponse.json({
      success: true,
      updated: result.count,
    })
  } catch (error) {
    console.error('Bulk status update fout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk status update mislukt' },
      { status: 500 }
    )
  }
}
