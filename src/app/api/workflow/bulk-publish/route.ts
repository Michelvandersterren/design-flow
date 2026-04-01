import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createShopifyProduct, isShopifyConfigured } from '@/lib/shopify'
import { pushTranslationsToShopify, pushInfographicTranslations } from '@/lib/shopify-translations'
import { markDesignLiveInNotion } from '@/lib/notion'

export const maxDuration = 300 // 5 minutes for bulk operations

type PublishResult = {
  designId: string
  designCode: string
  designName: string
  status: 'ok' | 'skipped' | 'error'
  shopifyProductId?: string
  detail?: string
}

/**
 * POST /api/workflow/bulk-publish
 * Publishes all REVIEW or APPROVED designs to Shopify (as drafts).
 *
 * Body (optional):
 *   { designIds: string[] }  — specific designs
 *   {}                       — all APPROVED designs
 *
 * Skips designs that are already LIVE or already have a Shopify product ID on their variants.
 */
export async function POST(request: NextRequest) {
  if (!isShopifyConfigured()) {
    return NextResponse.json(
      { error: 'Shopify is not configured. Add SHOPIFY_ACCESS_TOKEN to .env' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const { designIds } = body as { designIds?: string[] }

  const designs = await prisma.design.findMany({
    where: designIds
      ? { id: { in: designIds } }
      : { status: 'APPROVED' },
    include: {
      variants: { select: { shopifyProductId: true } },
      content: { select: { language: true } },
    },
    orderBy: { designName: 'asc' },
  })

  if (designs.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Geen APPROVED designs gevonden',
      results: [],
    })
  }

  const results: PublishResult[] = []

  for (const design of designs) {
    // Skip if already published (any variant has a shopifyProductId)
    const alreadyPublished = design.variants.some((v) => v.shopifyProductId)
    if (alreadyPublished) {
      results.push({
        designId: design.id,
        designCode: design.designCode,
        designName: design.designName,
        status: 'skipped',
        detail: 'Al gepubliceerd op Shopify',
      })
      continue
    }

    // Skip if no NL content
    const hasNl = design.content.some((c) => c.language === 'nl')
    if (!hasNl) {
      results.push({
        designId: design.id,
        designCode: design.designCode,
        designName: design.designName,
        status: 'skipped',
        detail: 'Geen NL content aanwezig',
      })
      continue
    }

    try {
      const result = await createShopifyProduct(design.id)

      // Run translations and DB+Notion updates in parallel
      const translationPromise = (async () => {
        try {
          const translatedContent = await prisma.content.findMany({
            where: { designId: design.id, language: { in: ['de', 'en', 'fr'] } },
            select: { language: true, description: true, longDescription: true, seoTitle: true, seoDescription: true, googleShoppingDescription: true },
          })
          if (translatedContent.length > 0) {
            await pushTranslationsToShopify(result.shopifyProductId, translatedContent)
          }
        } catch (translationError) {
          console.error(`Translation push failed for ${design.designCode} (non-fatal):`, translationError)
        }
        // Push infographic file_reference translations (DE/EN/FR)
        try {
          if (result.infographicTranslations && result.infographicTranslations.length > 0) {
            await pushInfographicTranslations(result.shopifyProductId, result.infographicTranslations)
          }
        } catch (infographicError) {
          console.error(`Infographic translation push failed for ${design.designCode} (non-fatal):`, infographicError)
        }
      })()

      const dbAndNotionPromise = (async () => {
        // Set design status to LIVE
        const updated = await prisma.design.update({
          where: { id: design.id },
          data: { status: 'LIVE' },
        })
        // Write back to Notion if notionId is available
        if (updated.notionId) {
          try {
            await markDesignLiveInNotion(updated.notionId, result.shopifyProductHandle)
          } catch (notionError) {
            console.error(`Notion write-back failed for ${design.designCode} (non-fatal):`, notionError)
          }
        }
      })()

      await Promise.all([translationPromise, dbAndNotionPromise])

      results.push({
        designId: design.id,
        designCode: design.designCode,
        designName: design.designName,
        status: 'ok',
        shopifyProductId: result.shopifyProductId,
        detail: `${result.variantsCreated} varianten`,
      })
    } catch (err) {
      results.push({
        designId: design.id,
        designCode: design.designCode,
        designName: design.designName,
        status: 'error',
        detail: String(err),
      })
    }
  }

  const succeeded = results.filter((r) => r.status === 'ok').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const failed = results.filter((r) => r.status === 'error').length

  return NextResponse.json({
    success: true,
    summary: { total: results.length, succeeded, skipped, failed },
    results,
  })
}
