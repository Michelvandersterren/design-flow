import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteDesignFromDrive } from '@/lib/drive'

// POST /api/designs/approve  { designId, action: 'approve' | 'reject' }
export async function POST(request: NextRequest) {
  try {
    const { designId, action } = await request.json()

    if (!designId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Ongeldige parameters' }, { status: 400 })
    }

    const design = await prisma.design.findUnique({ where: { id: designId } })
    if (!design) {
      return NextResponse.json({ error: 'Design niet gevonden' }, { status: 404 })
    }
    if (design.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: `Design heeft status "${design.status}", niet PENDING_APPROVAL` },
        { status: 409 }
      )
    }

    if (action === 'approve') {
      const updated = await prisma.design.update({
        where: { id: designId },
        data: { status: 'DRAFT' },
      })
      return NextResponse.json({ success: true, status: updated.status })
    }

    // reject: verwijder uit Drive en DB
    if (design.driveFileId) {
      try {
        await deleteDesignFromDrive(design.driveFileId)
      } catch (e) {
        console.warn('Drive verwijderen mislukt (wordt toch uit DB verwijderd):', e)
      }
    }
    await prisma.design.delete({ where: { id: designId } })

    return NextResponse.json({ success: true, status: 'REJECTED', deleted: true })
  } catch (error) {
    console.error('Approve fout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Actie mislukt' },
      { status: 500 }
    )
  }
}
