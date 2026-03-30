import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/designs/[id]/fork
 * Maakt een nieuw design aan als kopie van het huidige design, maar met een ander producttype.
 *
 * Body: { targetType: 'IB' | 'SP' | 'MC' }
 *
 * - Kopieert designName, designCode, driveFileId, driveFileName, collections, colorTags, styleFamily
 * - Zet het juiste *Friendly vlag op true, de rest false
 * - Zet designType op targetType
 * - Kopieert geen varianten, content of mockups — die worden opnieuw gegenereerd
 * - Stuurt het nieuwe design ID terug zodat de UI er naartoe kan navigeren
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const targetType: 'IB' | 'SP' | 'MC' = body?.targetType

    if (!['IB', 'SP', 'MC'].includes(targetType)) {
      return NextResponse.json({ error: 'Ongeldig targetType — gebruik IB, SP of MC' }, { status: 400 })
    }

    const source = await prisma.design.findUnique({ where: { id } })
    if (!source) {
      return NextResponse.json({ error: 'Brondesign niet gevonden' }, { status: 404 })
    }

    // Strip bestaande producttype-suffix van naam en code zodat er geen
    // dubbele suffixen ontstaan (bijv. "Name (IB) (SP)" of "CODE-IB-SP").
    const cleanName = source.designName.replace(/\s*\((IB|SP|MC)\)$/i, '')
    const cleanCode = source.designCode.replace(/-(IB|SP|MC)$/i, '')

    // Genereer een suffix voor code/naam zodat er geen collision is
    const suffix = `-${targetType}`
    const newCode = (cleanCode + suffix).slice(0, 20).toUpperCase()

    // Check of er al een design bestaat met deze code
    const existing = await prisma.design.findFirst({ where: { designCode: newCode } })
    if (existing) {
      return NextResponse.json(
        { error: `Er bestaat al een design met code ${newCode} (ID: ${existing.id})`, existingId: existing.id },
        { status: 409 }
      )
    }

    const newDesign = await prisma.design.create({
      data: {
        designCode: newCode,
        designName: `${cleanName} (${targetType})`,
        designType: targetType,
        styleFamily: source.styleFamily,
        collections: source.collections,
        colorTags: source.colorTags,
        driveFileId: source.driveFileId,
        driveFileName: source.driveFileName,
        inductionFriendly: targetType === 'IB',
        circleFriendly: targetType === 'MC',
        splashFriendly: targetType === 'SP',
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ success: true, design: newDesign })
  } catch (error) {
    console.error('Fork fout:', error)
    return NextResponse.json({ error: 'Fork mislukt' }, { status: 500 })
  }
}
