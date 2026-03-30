import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/ai'
import { translateContent } from '@/lib/translation'

export const maxDuration = 300

type RegenerateStepResult = {
  step: string
  status: 'ok' | 'skipped' | 'error'
  detail?: string
}

type RegenerateDesignResult = {
  designId: string
  designCode: string
  designName: string
  steps: RegenerateStepResult[]
  error?: string
}

export type RegenerateResponse = {
  success: boolean
  summary: {
    total: number
    regenerated: number
    failed: number
    skipped: number
  }
  results: RegenerateDesignResult[]
}

export type RegeneratePreviewDesign = {
  id: string
  designCode: string
  designName: string
  designType: string | null
  status: string
  collections: string[]
  styleFamily: string | null
  hasNlContent: boolean
  hasDeContent: boolean
  hasEnContent: boolean
  hasFrContent: boolean
  variantCount: number
  onShopify: boolean
}

export type RegeneratePreviewResponse = {
  total: number
  designs: RegeneratePreviewDesign[]
  collections: string[]
  styleFamilies: string[]
}

/**
 * GET /api/regenerate
 * Preview: which designs would be affected by a bulk regeneration.
 * Query params:
 *   - status: filter by design status (default: all statuses with content)
 *   - collection: filter by collection
 *   - styleFamily: filter by style family
 *   - search: search by name or code
 *   - hasContent: 'true' (default) to only show designs that have NL content
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const collection = params.get('collection')
  const styleFamily = params.get('styleFamily')
  const search = params.get('search')
  const hasContentOnly = params.get('hasContent') !== 'false'

  // Build where clause
  const where: Record<string, unknown> = {}

  if (status) {
    where.status = status
  }

  if (search) {
    where.OR = [
      { designName: { contains: search } },
      { designCode: { contains: search } },
    ]
  }

  if (styleFamily) {
    where.styleFamily = styleFamily
  }

  // Fetch designs with their content and variants
  const designs = await prisma.design.findMany({
    where,
    include: {
      content: { select: { language: true } },
      variants: { select: { id: true, shopifyProductId: true } },
    },
    orderBy: { designName: 'asc' },
  })

  // Post-filter: collection (stored as JSON array) and hasContent
  let filtered = designs

  if (collection) {
    filtered = filtered.filter((d) => {
      if (!d.collections) return false
      try {
        const cols = JSON.parse(d.collections) as string[]
        return cols.includes(collection)
      } catch {
        return false
      }
    })
  }

  if (hasContentOnly) {
    filtered = filtered.filter((d) =>
      d.content.some((c) => c.language === 'nl')
    )
  }

  // Collect unique collections and style families for filter dropdowns
  const allCollections = new Set<string>()
  const allStyleFamilies = new Set<string>()

  for (const d of designs) {
    if (d.styleFamily) allStyleFamilies.add(d.styleFamily)
    if (d.collections) {
      try {
        const cols = JSON.parse(d.collections) as string[]
        cols.forEach((c) => allCollections.add(c))
      } catch { /* skip */ }
    }
  }

  const result: RegeneratePreviewResponse = {
    total: filtered.length,
    designs: filtered.map((d) => ({
      id: d.id,
      designCode: d.designCode,
      designName: d.designName,
      designType: d.designType,
      status: d.status,
      collections: d.collections ? (() => { try { return JSON.parse(d.collections!) } catch { return [] } })() : [],
      styleFamily: d.styleFamily,
      hasNlContent: d.content.some((c) => c.language === 'nl'),
      hasDeContent: d.content.some((c) => c.language === 'de'),
      hasEnContent: d.content.some((c) => c.language === 'en'),
      hasFrContent: d.content.some((c) => c.language === 'fr'),
      variantCount: d.variants.length,
      onShopify: d.variants.some((v) => v.shopifyProductId),
    })),
    collections: Array.from(allCollections).sort(),
    styleFamilies: Array.from(allStyleFamilies).sort(),
  }

  return NextResponse.json(result)
}

/**
 * POST /api/regenerate
 * Bulk regenerate NL content (and optionally re-translate) for selected designs.
 *
 * Body:
 *   designIds: string[]         — which designs to regenerate
 *   retranslate: boolean        — also re-translate to DE/EN/FR (default: true)
 *   pushToShopify: boolean      — also push updated content to Shopify (default: false)
 *
 * Flow per design:
 * 1. Re-generate NL content via AI (uses current brand voice)
 * 2. If retranslate: re-translate to DE, EN, FR
 * 3. If pushToShopify: push updated content to Shopify (via shopify-update)
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const {
    designIds,
    retranslate = true,
    pushToShopify = false,
  } = body as {
    designIds?: string[]
    retranslate?: boolean
    pushToShopify?: boolean
  }

  if (!designIds || designIds.length === 0) {
    return NextResponse.json(
      { error: 'Geen designs geselecteerd' },
      { status: 400 }
    )
  }

  // Cap at 50 to prevent timeout
  const cappedIds = designIds.slice(0, 50)

  const designs = await prisma.design.findMany({
    where: { id: { in: cappedIds } },
    include: {
      content: { select: { id: true, language: true } },
      variants: { select: { id: true, shopifyProductId: true } },
    },
    orderBy: { designName: 'asc' },
  })

  const results: RegenerateDesignResult[] = []

  for (const design of designs) {
    const steps: RegenerateStepResult[] = []

    try {
      // ── Step 1: Re-generate NL content ────────────────────────────
      const collections = design.collections ? (() => { try { return JSON.parse(design.collections!) as string[] } catch { return [] } })() : []
      const colorTags = design.colorTags ? (() => { try { return JSON.parse(design.colorTags!) as string[] } catch { return [] } })() : []

      const productType = design.splashFriendly
        ? 'SPLASH'
        : design.circleFriendly
          ? 'CIRCLE'
          : 'INDUCTION'

      try {
        const content = await generateContent(
          design.designName,
          design.designCode,
          collections,
          colorTags,
          productType,
          design.driveFileId ?? null
        )

        await prisma.content.upsert({
          where: { designId_language: { designId: design.id, language: 'nl' } },
          create: {
            designId: design.id,
            language: 'nl',
            description: content.description,
            longDescription: content.longDescription,
            seoTitle: content.seoTitle,
            seoDescription: content.seoDescription,
            googleShoppingDescription: content.googleShoppingDescription,
            translationStatus: 'PENDING',
          },
          update: {
            description: content.description,
            longDescription: content.longDescription,
            seoTitle: content.seoTitle,
            seoDescription: content.seoDescription,
            googleShoppingDescription: content.googleShoppingDescription,
            translationStatus: 'PENDING',
          },
        })

        steps.push({ step: 'regenerate_nl', status: 'ok' })
      } catch (err) {
        steps.push({ step: 'regenerate_nl', status: 'error', detail: String(err) })
        // If NL generation fails, skip translations
        results.push({
          designId: design.id,
          designCode: design.designCode,
          designName: design.designName,
          steps,
        })
        continue
      }

      // ── Step 2: Re-translate (optional) ───────────────────────────
      if (retranslate) {
        const nlContent = await prisma.content.findUnique({
          where: { designId_language: { designId: design.id, language: 'nl' } },
        })

        if (!nlContent) {
          steps.push({ step: 'translate_de', status: 'error', detail: 'NL content niet gevonden na regeneratie' })
        } else {
          for (const lang of ['de', 'en', 'fr'] as const) {
            try {
              await translateContent(nlContent.id, lang)
              steps.push({ step: `translate_${lang}`, status: 'ok' })
            } catch (err) {
              steps.push({ step: `translate_${lang}`, status: 'error', detail: String(err) })
            }
          }
        }
      }

      // ── Step 3: Push to Shopify (optional) ─────────────────────────
      if (pushToShopify) {
        const hasShopifyProduct = design.variants.some((v) => v.shopifyProductId)
        if (!hasShopifyProduct) {
          steps.push({ step: 'shopify_push', status: 'skipped', detail: 'Geen Shopify product' })
        } else {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            const res = await fetch(`${baseUrl}/api/designs/${design.id}/shopify-update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            })

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}))
              throw new Error(errData.error || `HTTP ${res.status}`)
            }

            steps.push({ step: 'shopify_push', status: 'ok' })
          } catch (err) {
            steps.push({ step: 'shopify_push', status: 'error', detail: String(err) })
          }
        }
      }

      results.push({
        designId: design.id,
        designCode: design.designCode,
        designName: design.designName,
        steps,
      })
    } catch (err) {
      results.push({
        designId: design.id,
        designCode: design.designCode,
        designName: design.designName,
        steps,
        error: String(err),
      })
    }
  }

  const regenerated = results.filter(
    (r) => !r.error && r.steps.find((s) => s.step === 'regenerate_nl')?.status === 'ok'
  ).length
  const failed = results.filter(
    (r) => r.error || r.steps.some((s) => s.status === 'error')
  ).length
  const skipped = results.length - regenerated - failed

  const response: RegenerateResponse = {
    success: true,
    summary: {
      total: results.length,
      regenerated,
      failed,
      skipped,
    },
    results,
  }

  return NextResponse.json(response)
}
