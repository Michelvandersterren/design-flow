import { NextRequest, NextResponse } from 'next/server'
import {
  generateAllPrintFilesForDesign,
  regenerateSinglePrintFile,
  deleteAllPrintFilesForDesign,
} from '@/lib/print'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/designs/[id]/printfile
 * Generate print PDFs for a design.
 *
 * Body (optional):
 *   {}                     — generate ALL print files (one per variant size)
 *   { sizeKey: "520x350" } — regenerate a single size
 *
 * Returns list of generated print files with Drive URLs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const body    = await request.json().catch(() => ({}))
    const sizeKey: string | undefined = body?.sizeKey

    let results
    if (sizeKey) {
      const result = await regenerateSinglePrintFile(designId, sizeKey)
      results = [result]
    } else {
      results = await generateAllPrintFilesForDesign(designId)
    }

    const generated = results.filter((r) => !r.skipped)
    const skipped   = results.filter((r) => r.skipped)

    return NextResponse.json({
      success:   true,
      generated: generated.length,
      skipped:   skipped.length,
      results,
    })
  } catch (error) {
    console.error('Printbestand generatie fout:', error)
    const message = error instanceof Error ? error.message : 'Printbestand generatie mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/designs/[id]/printfile
 * Returns all saved print file records for a design.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params

    const printFiles = await prisma.designPrintFile.findMany({
      where: { designId },
      orderBy: [{ widthMM: 'asc' }, { heightMM: 'asc' }],
    })

    return NextResponse.json({ printFiles })
  } catch (error) {
    console.error('Printbestand ophalen fout:', error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

/**
 * DELETE /api/designs/[id]/printfile
 * Delete all print file records for a design from the DB.
 * Does NOT delete the Drive files.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const count = await deleteAllPrintFilesForDesign(designId)
    return NextResponse.json({ success: true, deleted: count })
  } catch (error) {
    console.error('Printbestand verwijderen fout:', error)
    const message = error instanceof Error ? error.message : 'Verwijderen mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
