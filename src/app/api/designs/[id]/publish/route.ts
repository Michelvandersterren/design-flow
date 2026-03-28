import { NextRequest, NextResponse } from 'next/server'
import { createShopifyProduct, buildShopifyProduct, isShopifyConfigured } from '@/lib/shopify'
import { pushTranslationsToShopify } from '@/lib/shopify-translations'
import { markDesignLiveInNotion } from '@/lib/notion'
import { prisma } from '@/lib/prisma'

export const maxDuration = 180 // 3 minutes — Shopify downloads all mockup images server-side

/**
 * POST /api/designs/[id]/publish
 * Create a draft product on Shopify from a design.
 *
 * Body: {} (uses all design data from DB)
 *
 * Returns the Shopify product ID and handle.
 * The product is created as a DRAFT on Shopify.
 * After creation, the design status is set to LIVE and Notion is updated.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: designId } = await params

  if (!isShopifyConfigured()) {
    return NextResponse.json(
      { error: 'Shopify is not configured. Add SHOPIFY_ACCESS_TOKEN to .env' },
      { status: 503 }
    )
  }

  try {
    const result = await createShopifyProduct(designId)

    // Run translations and DB+Notion updates in parallel.
    // Translations are non-fatal; DB status and Notion write-back are independent of translations.
    const translationPromise = (async () => {
      try {
        const translatedContent = await prisma.content.findMany({
          where: { designId, language: { in: ['de', 'en', 'fr'] } },
          select: { language: true, description: true, longDescription: true, seoTitle: true, seoDescription: true, googleShoppingDescription: true },
        })
        if (translatedContent.length > 0) {
          await pushTranslationsToShopify(result.shopifyProductId, translatedContent)
        }
      } catch (translationError) {
        console.error('Translation push failed (non-fatal):', translationError)
      }
    })()

    const dbAndNotionPromise = (async () => {
      // Set design status to LIVE in DB
      const design = await prisma.design.update({
        where: { id: designId },
        data: { status: 'LIVE' },
      })
      // Write back to Notion if notionId is available
      if (design.notionId) {
        try {
          await markDesignLiveInNotion(design.notionId, result.shopifyProductHandle)
        } catch (notionError) {
          console.error('Notion write-back failed (non-fatal):', notionError)
        }
      }
      return design
    })()

    const [, design] = await Promise.all([translationPromise, dbAndNotionPromise])

    return NextResponse.json({
      success: true,
      notionUpdated: !!design.notionId,
      ...result,
    })
  } catch (error) {
    console.error('Shopify publish error:', error)
    const message = error instanceof Error ? error.message : 'Failed to publish to Shopify'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/designs/[id]/publish
 * Preview the Shopify payload that would be sent — without actually publishing.
 * Useful for review before going live.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: designId } = await params

  try {
    const payload = await buildShopifyProduct(designId)
    return NextResponse.json({
      shopifyConfigured: isShopifyConfigured(),
      payload,
    })
  } catch (error) {
    console.error('Shopify preview error:', error)
    const message = error instanceof Error ? error.message : 'Failed to build Shopify payload'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
