/**
 * POST /api/ean/gs1-sync
 *
 * Backfill endpoint: registers all existing variants that have an EAN
 * but gs1Registered = false.
 *
 * Processes variants one-by-one to avoid overwhelming the GS1 API.
 * Safe to run multiple times (idempotent).
 *
 * Response: { processed: number, registered: number, failed: number, skipped: number }
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerGtin } from '@/lib/gs1'

/**
 * GET /api/ean/gs1-sync
 * Preview: how many variants need GS1 registration.
 */
export async function GET() {
  const unregistered = await prisma.variant.count({
    where: { ean: { not: null }, gs1Registered: false },
  })
  const registered = await prisma.variant.count({
    where: { gs1Registered: true },
  })

  return NextResponse.json({
    unregistered,
    registered,
    message: unregistered > 0
      ? `${unregistered} variant(s) ready for GS1 registration. POST to this endpoint to register.`
      : 'All variants with EANs are already registered with GS1.',
  })
}

export async function POST() {
  // Fetch all variants with an EAN that haven't been registered yet
  const variants = await prisma.variant.findMany({
    where: {
      ean: { not: null },
      gs1Registered: false,
    },
    select: {
      id: true,
      ean: true,
      productType: true,
      size: true,
      material: true,
    },
  })

  let registered = 0
  let failed = 0
  const skipped = 0

  for (const variant of variants) {
    if (!variant.ean) continue

    // Build a human-readable description based on product type
    let description: string
    if (variant.productType === 'SP') {
      description = `Spatscherm ${variant.size}mm ${variant.material ?? ''}`.trim()
    } else if (variant.productType === 'IB') {
      description = `Inductieplaat ${variant.size}mm`
    } else if (variant.productType === 'MC') {
      description = `Muurcirkel ${variant.size}mm`
    } else {
      description = `Product ${variant.productType} ${variant.size}`
    }

    try {
      const ok = await registerGtin({
        gtin: variant.ean,
        description,
        brandName: 'KitchenArt',
        productType: variant.productType,
      })
      if (ok) {
        await prisma.variant.update({
          where: { id: variant.id },
          data: { gs1Registered: true },
        })
        registered++
      }
    } catch (err) {
      console.warn(`[GS1 sync] Failed for EAN ${variant.ean}:`, err)
      failed++
    }
  }

  return NextResponse.json({
    processed: variants.length,
    registered,
    failed,
    skipped,
  })
}
