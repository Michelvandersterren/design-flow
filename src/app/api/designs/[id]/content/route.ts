import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/designs/[id]/content
 * Handmatig aanpassen van content-velden voor een specifieke taal.
 *
 * Body: { language: 'nl' | 'de' | 'en', description?, longDescription?, altText?, seoTitle?, seoDescription? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const body = await request.json()
    const { language, description, longDescription, altText, seoTitle, seoDescription, googleShoppingDescription } = body

    if (!language || !['nl', 'de', 'en'].includes(language)) {
      return NextResponse.json({ error: 'Ongeldige taal — gebruik nl, de of en' }, { status: 400 })
    }

    // Only update fields that are explicitly provided (not undefined)
    const data: Record<string, string> = {}
    if (description !== undefined) data.description = description
    if (longDescription !== undefined) data.longDescription = longDescription
    if (altText !== undefined) data.altText = altText
    if (seoTitle !== undefined) data.seoTitle = seoTitle
    if (seoDescription !== undefined) data.seoDescription = seoDescription
    if (googleShoppingDescription !== undefined) data.googleShoppingDescription = googleShoppingDescription

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Geen velden om bij te werken' }, { status: 400 })
    }

    const content = await prisma.content.upsert({
      where: { designId_language: { designId, language } },
      create: { designId, language, ...data },
      update: data,
    })

    return NextResponse.json({ success: true, content })
  } catch (error) {
    console.error('Content update fout:', error)
    return NextResponse.json({ error: 'Content bijwerken mislukt' }, { status: 500 })
  }
}
