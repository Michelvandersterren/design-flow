import { NextRequest, NextResponse } from 'next/server'
import { assignMissingEans, generateNextEan, isValidEan13 } from '@/lib/ean'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/ean/assign
 * Assign EAN-13 codes to all variants that don't have one yet.
 * Safe to call multiple times (idempotent — only fills gaps).
 */
export async function POST(request: NextRequest) {
  try {
    const result = await assignMissingEans()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('EAN assign error:', error)
    const message = error instanceof Error ? error.message : 'EAN assignment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/ean/assign
 * Preview: how many variants are missing EANs + what the next EAN would be.
 */
export async function GET() {
  try {
    const missing = await prisma.variant.count({ where: { ean: null } })
    const total = await prisma.variant.count()
    const nextEan = await generateNextEan()
    const valid = isValidEan13(nextEan)

    return NextResponse.json({
      total,
      withEan: total - missing,
      missingEan: missing,
      nextEan,
      nextEanValid: valid,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
