import { NextRequest, NextResponse } from 'next/server'
import { createShopifyProduct, buildShopifyProduct, isShopifyConfigured } from '@/lib/shopify'
import { pushTranslationsToShopify, pushInfographicTranslations } from '@/lib/shopify-translations'
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
    // Guard: design must be APPROVED with mockups, content and EANs before publishing
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        content: { where: { language: 'nl' }, take: 1 },
        variants: true,
        mockups: { take: 1 },
      },
    })

    if (!design) {
      return NextResponse.json({ error: 'Design niet gevonden' }, { status: 404 })
    }
    if (design.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Design moet status APPROVED hebben om te publiceren (huidige status: ${design.status})` },
        { status: 400 }
      )
    }
    if (design.content.length === 0) {
      return NextResponse.json({ error: 'Nederlandse content ontbreekt' }, { status: 400 })
    }
    if (design.variants.length === 0) {
      return NextResponse.json({ error: 'Geen varianten aangemaakt' }, { status: 400 })
    }
    if (design.mockups.length === 0) {
      return NextResponse.json({ error: 'Mockups ontbreken' }, { status: 400 })
    }
    const missingEan = design.variants.some((v) => !v.ean)
    if (missingEan) {
      return NextResponse.json({ error: 'Niet alle varianten hebben een EAN' }, { status: 400 })
    }
    const alreadyPublished = design.variants.some((v) => v.shopifyProductId)
    if (alreadyPublished) {
      return NextResponse.json({ error: 'Design is al gepubliceerd naar Shopify' }, { status: 400 })
    }

    const result = await createShopifyProduct(designId)

    // --- Phase 1: Text translations + DB/Notion updates in parallel ---
    // Text translations (title, description, SEO) don't depend on metafields,
    // so they can run immediately. DB/Notion are independent of Shopify state.
    const textTranslationPromise = (async () => {
      try {
        const translatedContent = await prisma.content.findMany({
          where: { designId, language: { in: ['de', 'en', 'fr'] } },
          select: { language: true, description: true, longDescription: true, seoTitle: true, seoDescription: true, googleShoppingDescription: true },
        })
        if (translatedContent.length > 0) {
          await pushTranslationsToShopify(result.shopifyProductId, translatedContent)
          console.log(`[Publish] Text translations pushed for ${translatedContent.length} language(s)`)
        }
      } catch (translationError) {
        console.error('Text translation push failed (non-fatal):', translationError)
      }
    })()

    const dbAndNotionPromise = (async () => {
      const updatedDesign = await prisma.design.update({
        where: { id: designId },
        data: { status: 'LIVE' },
      })
      if (updatedDesign.notionId) {
        try {
          await markDesignLiveInNotion(updatedDesign.notionId, result.shopifyProductHandle)
        } catch (notionError) {
          console.error('Notion write-back failed (non-fatal):', notionError)
        }
      }
      return updatedDesign
    })()

    const [, updatedDesign] = await Promise.all([textTranslationPromise, dbAndNotionPromise])

    // --- Phase 2: Infographic translations AFTER a delay ---
    // Infographic translations need to fetch metafield GIDs from Shopify.
    // Those metafields were just created by createShopifyProduct(), and Shopify
    // needs a few seconds to fully commit them. Running this after the parallel
    // phase above provides ~3-5s natural delay; we add an explicit 3s safety buffer.
    if (result.infographicTranslations.length > 0) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        const infResult = await pushInfographicTranslations(
          result.shopifyProductId,
          result.infographicTranslations
        )
        if (infResult.errors.length > 0) {
          console.error('Infographic translation errors (non-fatal):', infResult.errors)
        }
        console.log(`[Publish] Infographic translations pushed: ${infResult.pushed}`)
      } catch (infError) {
        console.error('Infographic translation push failed (non-fatal):', infError)
      }
    }

    return NextResponse.json({
      success: true,
      notionUpdated: !!updatedDesign.notionId,
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
