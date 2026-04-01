import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateShopifyProduct, isShopifyConfigured } from '@/lib/shopify'
import { pushTranslationsToShopify, pushInfographicTranslations } from '@/lib/shopify-translations'

export const maxDuration = 180 // 3 minutes — full sync re-uploads all mockup images

/**
 * POST /api/designs/[id]/shopify-update
 * Full sync of an already-published Shopify product: title, body_html, tags,
 * product category, variant prices, all metafields, and all images.
 *
 * Requires the design to already have a shopifyProductId on at least one variant.
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
    // Find the Shopify product ID from any variant
    const variant = await prisma.variant.findFirst({
      where: { designId, shopifyProductId: { not: null } },
      select: { shopifyProductId: true },
    })

    if (!variant?.shopifyProductId) {
      return NextResponse.json(
        { error: 'Product is nog niet gepubliceerd op Shopify — gebruik eerst Publiceren' },
        { status: 400 }
      )
    }

    const result = await updateShopifyProduct(designId, variant.shopifyProductId)

    // Push translations (DE/EN/FR) — non-fatal
    try {
      const translatedContent = await prisma.content.findMany({
        where: { designId, language: { in: ['de', 'en', 'fr'] } },
        select: { language: true, description: true, longDescription: true, seoTitle: true, seoDescription: true, googleShoppingDescription: true },
      })
      if (translatedContent.length > 0) {
        await pushTranslationsToShopify(variant.shopifyProductId, translatedContent)
      }
    } catch (translationError) {
      console.error('Translation push failed (non-fatal):', translationError)
    }

    // Push infographic file_reference translations (DE/EN/FR) — non-fatal
    try {
      if (result.infographicTranslations && result.infographicTranslations.length > 0) {
        await pushInfographicTranslations(variant.shopifyProductId, result.infographicTranslations)
      }
    } catch (infographicError) {
      console.error('Infographic translation push failed (non-fatal):', infographicError)
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Shopify update error:', error)
    const message = error instanceof Error ? error.message : 'Shopify update mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
