import { NextRequest, NextResponse } from 'next/server'
import { generateVariantsForDesign, getVariantsForDesign } from '@/lib/variants'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/designs/[id]/variants
 * Generate standard variants for a design based on its product type flags.
 * Body: {} (uses design flags from DB — inductionFriendly, circleFriendly)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params

    const results = await generateVariantsForDesign(designId)

    const totalCreated = Object.values(results).reduce((sum, r) => sum + r.created.length, 0)
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped.length, 0)

    // Mark workflow step as completed if any variants were created
    if (totalCreated > 0) {
      await prisma.workflowStep.upsert({
        where: { designId_step: { designId, step: 'DESIGN_UPLOAD' } },
        create: { designId, step: 'DESIGN_UPLOAD', status: 'COMPLETED', completedAt: new Date() },
        update: { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      summary: { totalCreated, totalSkipped },
      byType: Object.fromEntries(
        Object.entries(results).map(([type, r]) => [
          type,
          { created: r.created.length, skipped: r.skipped.length },
        ])
      ),
    })
  } catch (error) {
    console.error('Variant creation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create variants'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/designs/[id]/variants
 * Returns all variants for a design grouped by product type.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const result = await getVariantsForDesign(designId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching variants:', error)
    return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 })
  }
}
