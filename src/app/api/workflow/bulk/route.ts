import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/ai'
import { translateContent } from '@/lib/translation'
import { generateVariantsForDesign } from '@/lib/variants'

export const maxDuration = 300 // 5 minuten timeout voor bulk operaties

type StepResult = {
  step: string
  status: 'ok' | 'skipped' | 'error'
  detail?: string
}

type DesignResult = {
  designId: string
  designCode: string
  designName: string
  steps: StepResult[]
  error?: string
}

/**
 * POST /api/workflow/bulk
 * Voert de volledige workflow uit voor alle DRAFT designs (of een opgegeven lijst):
 * 1. AI content genereren (NL)
 * 2. Vertalen naar DE
 * 3. Vertalen naar EN
 * 4. Vertalen naar FR
 * 5. Varianten aanmaken
 *
 * Body (optioneel):
 *   { designIds: string[] }   — specifieke designs
 *   {}                        — alle DRAFT designs
 *
 * Returns per design de stap-resultaten.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { designIds } = body as { designIds?: string[] }

  // Haal de te verwerken designs op
  const designs = await prisma.design.findMany({
    where: designIds
      ? { id: { in: designIds } }
      : { status: 'DRAFT' },
    orderBy: { designName: 'asc' },
  })

  if (designs.length === 0) {
    return NextResponse.json({ success: true, message: 'Geen DRAFT designs gevonden', results: [] })
  }

  const results: DesignResult[] = []

  for (const design of designs) {
    const steps: StepResult[] = []

    try {
      // ── Stap 1: NL content genereren ────────────────────────────────
      const existingNl = await prisma.content.findUnique({
        where: { designId_language: { designId: design.id, language: 'nl' } },
      })

      if (existingNl?.description) {
        steps.push({ step: 'content_nl', status: 'skipped', detail: 'Al aanwezig' })
      } else {
        try {
          await prisma.design.update({ where: { id: design.id }, data: { status: 'CONTENT_GENERATING' } })

          const collections = design.collections ? JSON.parse(design.collections) : []
          const colorTags = design.colorTags ? JSON.parse(design.colorTags) : []

          const productType = design.splashFriendly
            ? 'SPLASH'
            : design.circleFriendly
            ? 'CIRCLE'
            : 'INDUCTION'

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

          steps.push({ step: 'content_nl', status: 'ok' })
        } catch (err) {
          steps.push({ step: 'content_nl', status: 'error', detail: String(err) })
          // Als content mislukt, sla vertaling ook over
          results.push({ designId: design.id, designCode: design.designCode, designName: design.designName, steps })
          continue
        }
      }

      // ── Stap 2: Vertalen naar DE ─────────────────────────────────────
      const existingDe = await prisma.content.findUnique({
        where: { designId_language: { designId: design.id, language: 'de' } },
      })

      if (existingDe?.description) {
        steps.push({ step: 'translate_de', status: 'skipped', detail: 'Al aanwezig' })
      } else {
        try {
          const nlContent = await prisma.content.findUnique({
            where: { designId_language: { designId: design.id, language: 'nl' } },
          })
          if (!nlContent) throw new Error('NL content niet gevonden')

          await translateContent(nlContent.id, 'de')
          steps.push({ step: 'translate_de', status: 'ok' })
        } catch (err) {
          steps.push({ step: 'translate_de', status: 'error', detail: String(err) })
          // Vertaalfouten stoppen de workflow niet
        }
      }

      // ── Stap 3: Vertalen naar EN ─────────────────────────────────────
      const existingEn = await prisma.content.findUnique({
        where: { designId_language: { designId: design.id, language: 'en' } },
      })

      if (existingEn?.description) {
        steps.push({ step: 'translate_en', status: 'skipped', detail: 'Al aanwezig' })
      } else {
        try {
          const nlContentForEn = await prisma.content.findUnique({
            where: { designId_language: { designId: design.id, language: 'nl' } },
          })
          if (!nlContentForEn) throw new Error('NL content niet gevonden')

          await translateContent(nlContentForEn.id, 'en')
          steps.push({ step: 'translate_en', status: 'ok' })
        } catch (err) {
          steps.push({ step: 'translate_en', status: 'error', detail: String(err) })
          // Vertaalfouten stoppen de workflow niet
        }
      }

      // ── Stap 4: Vertalen naar FR ─────────────────────────────────────
      const existingFr = await prisma.content.findUnique({
        where: { designId_language: { designId: design.id, language: 'fr' } },
      })

      if (existingFr?.description) {
        steps.push({ step: 'translate_fr', status: 'skipped', detail: 'Al aanwezig' })
      } else {
        try {
          const nlContentForFr = await prisma.content.findUnique({
            where: { designId_language: { designId: design.id, language: 'nl' } },
          })
          if (!nlContentForFr) throw new Error('NL content niet gevonden')

          await translateContent(nlContentForFr.id, 'fr')
          steps.push({ step: 'translate_fr', status: 'ok' })
        } catch (err) {
          steps.push({ step: 'translate_fr', status: 'error', detail: String(err) })
        }
      }

      // ── Stap 5: Varianten aanmaken ───────────────────────────────────
      try {
        const variantResult = await generateVariantsForDesign(design.id)
        const totalCreated = Object.values(variantResult).reduce((s, r) => s + r.created.length, 0)
        const totalSkipped = Object.values(variantResult).reduce((s, r) => s + r.skipped.length, 0)

        if (totalCreated === 0 && totalSkipped === 0) {
          steps.push({ step: 'variants', status: 'skipped', detail: 'Geen product types ingesteld' })
        } else {
          steps.push({
            step: 'variants',
            status: 'ok',
            detail: `${totalCreated} aangemaakt, ${totalSkipped} al aanwezig`,
          })
        }
      } catch (err) {
        steps.push({ step: 'variants', status: 'error', detail: String(err) })
      }

      // ── Status updaten naar REVIEW ───────────────────────────────────
      const hasErrors = steps.some((s) => s.status === 'error')
      await prisma.design.update({
        where: { id: design.id },
        data: { status: hasErrors ? 'DRAFT' : 'REVIEW' },
      })

      results.push({ designId: design.id, designCode: design.designCode, designName: design.designName, steps })
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

  const succeeded = results.filter((r) => !r.error && r.steps.every((s) => s.status !== 'error')).length
  const failed = results.filter((r) => r.error || r.steps.some((s) => s.status === 'error')).length

  return NextResponse.json({
    success: true,
    summary: {
      total: results.length,
      succeeded,
      failed,
    },
    results,
  })
}

/**
 * GET /api/workflow/bulk
 * Geeft een overzicht van alle DRAFT designs en hun workflow-status.
 */
export async function GET() {
  const designs = await prisma.design.findMany({
    where: { status: { in: ['DRAFT', 'REVIEW', 'CONTENT_GENERATING'] } },
    include: {
      content: { select: { language: true, translationStatus: true } },
      variants: { select: { id: true, productType: true } },
      workflowSteps: { select: { step: true, status: true } },
    },
    orderBy: { designName: 'asc' },
  })

  return NextResponse.json({
    count: designs.length,
    designs: designs.map((d) => ({
      id: d.id,
      designCode: d.designCode,
      designName: d.designName,
      status: d.status,
      hasNlContent: d.content.some((c) => c.language === 'nl'),
      hasDeContent: d.content.some((c) => c.language === 'de'),
      hasEnContent: d.content.some((c) => c.language === 'en'),
      hasFrContent: d.content.some((c) => c.language === 'fr'),
      variantCount: d.variants.length,
      productTypes: Array.from(new Set(d.variants.map((v) => v.productType))),
    })),
  })
}
