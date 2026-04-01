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

    // Run translations and DB+Notion updates in parallel.
    // Translations are non-fatal; DB status and Notion write-back are independent of translations.
    const translationPromise = (async () => {
      try {
        // Push text content translations (DE/EN/FR)
        const translatedContent = await prisma.content.findMany({
          where: { designId, language: { in: ['de', 'en', 'fr'] } },
          select: { language: true, description: true, longDescription: true, seoTitle: true, seoDescription: true, googleShoppingDescription: true },
        })
        if (translatedContent.length > 0) {
          await pushTranslationsToShopify(result.shopifyProductId, translatedContent)
        }

        // Push infographic image translations (file_reference metafields)
        if (result.infographicTranslations.length > 0) {
          const infResult = await pushInfographicTranslations(
            result.shopifyProductId,
            result.infographicTranslations
          )
          if (infResult.errors.length > 0) {
            console.error('Infographic translation errors (non-fatal):', infResult.errors)
          }
          console.log(`[Publish] Infographic translations pushed: ${infResult.pushed}`)
        }
      } catch (translationError) {
        console.error('Translation push failed (non-fatal):', translationError)
      }
    })()

    const dbAndNotionPromise = (async () => {
      // Set design status to LIVE in DB
      const updatedDesign = await prisma.design.update({
        where: { id: designId },
        data: { status: 'LIVE' },
      })
      // Write back to Notion if notionId is available
      if (updatedDesign.notionId) {
        try {
          await markDesignLiveInNotion(updatedDesign.notionId, result.shopifyProductHandle)
        } catch (notionError) {
          console.error('Notion write-back failed (non-fatal):', notionError)
        }
      }
      return updatedDesign
    })()

    const [, updatedDesign] = await Promise.all([translationPromise, dbAndNotionPromise])

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
