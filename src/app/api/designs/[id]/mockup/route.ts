import { NextRequest, NextResponse } from 'next/server'
import {
  generateAllMockupsForDesign,
  regenerateSingleMockup,
  deleteAllMockupsForDesign,
  checkTemplateStatus,
} from '@/lib/mockup'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/designs/[id]/mockup
 * Generate mockups for a design.
 *
 * Body (optional):
 *   {}                        — generate ALL mockups (generic + size-specific for real variants)
 *   { templateId: "IB-..." }  — regenerate a single template
 *
 * Returns list of generated mockups with Drive URLs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const body = await request.json().catch(() => ({}))
    const templateId: string | undefined = body?.templateId

    let results
    if (templateId) {
      // Single-template regeneration (may return array for infographic templates with multiple languages)
      const result = await regenerateSingleMockup(designId, templateId)
      results = Array.isArray(result) ? result : [result]
    } else {
      // Generate all (generic + size-specific matched to variants)
      results = await generateAllMockupsForDesign(designId)
    }

    const generated = results.filter((r) => !r.skipped)
    const skipped = results.filter((r) => r.skipped)

    return NextResponse.json({
      success: true,
      generated: generated.length,
      skipped: skipped.length,
      results,
    })
  } catch (error) {
    console.error('Mockup generatie fout:', error)
    const message = error instanceof Error ? error.message : 'Mockup generatie mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/designs/[id]/mockup
 * Delete all mockup records for a design from the DB.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const count = await deleteAllMockupsForDesign(designId)
    return NextResponse.json({ success: true, deleted: count })
  } catch (error) {
    console.error('Mockup verwijderen fout:', error)
    const message = error instanceof Error ? error.message : 'Verwijderen mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/designs/[id]/mockup
 * Check which mockup templates are ready (PSD exists on disk) for this design's product type.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params

    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: { variants: { take: 1 } },
    })

    if (!design) {
      return NextResponse.json({ error: 'Design niet gevonden' }, { status: 404 })
    }

    const productType = design.variants[0]?.productType as 'IB' | 'SP' | 'MC' | undefined

    if (!productType) {
      return NextResponse.json({
        ready: false,
        reason: 'Geen varianten — genereer eerst varianten',
        templates: [],
      })
    }

    const templates = checkTemplateStatus(productType)
    const readyCount = templates.filter((t) => t.ready).length

    return NextResponse.json({
      productType,
      readyCount,
      totalCount: templates.length,
      allReady: readyCount === templates.length,
      templates,
    })
  } catch (error) {
    console.error('Mockup status fout:', error)
    return NextResponse.json({ error: 'Status check mislukt' }, { status: 500 })
  }
}
