import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { updateStyleFamilyInNotion } from '@/lib/notion'
import { ANTHROPIC_API_KEY } from '@/lib/env'

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

/**
 * GET /api/designs/style-families
 * Returns current style family distribution across all designs.
 */
export async function GET() {
  const designs = await prisma.design.findMany({
    select: { id: true, designCode: true, designName: true, styleFamily: true },
    orderBy: { styleFamily: 'asc' },
  })

  const grouped: Record<string, { code: string; name: string }[]> = {}
  for (const d of designs) {
    const key = d.styleFamily ?? '(geen)'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ code: d.designCode, name: d.designName })
  }

  return NextResponse.json({
    total: designs.length,
    withFamily: designs.filter((d) => d.styleFamily).length,
    families: grouped,
  })
}

/**
 * POST /api/designs/style-families
 * Uses Claude to group all designs into style families,
 * saves to DB, and writes back to Notion.
 *
 * Body (optional):
 *   { overwrite?: boolean }  — default false: only fills in designs without a family
 *   { notionSync?: boolean } — default true: write back to Notion
 *   { dryRun?: boolean }     — default false: preview without saving
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const overwrite: boolean = body?.overwrite ?? false
    const notionSync: boolean = body?.notionSync ?? true
    const dryRun: boolean = body?.dryRun ?? false

    // Fetch all designs (only those without a family unless overwrite=true)
    const designs = await prisma.design.findMany({
      where: overwrite ? {} : { OR: [{ styleFamily: null }, { styleFamily: '' }] },
      select: {
        id: true,
        notionId: true,
        designCode: true,
        designName: true,
        designType: true,
        collections: true,
        colorTags: true,
        styleFamily: true,
      },
      orderBy: { designCode: 'asc' },
    })

    if (designs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Alle designs hebben al een stijlfamilie.',
        assigned: 0,
        families: [],
      })
    }

    // Build compact input for Claude
    const designList = designs.map((d) => {
      const cols = d.collections ? (JSON.parse(d.collections) as string[]).join(', ') : ''
      const colors = d.colorTags ? (JSON.parse(d.colorTags) as string[]).join(', ') : ''
      return `${d.designCode} | ${d.designName}${d.designType ? ` (${d.designType})` : ''}${cols ? ` | collecties: ${cols}` : ''}${colors ? ` | kleuren: ${colors}` : ''}`
    }).join('\n')

    const prompt = `Je bent een productmanager voor KitchenArt, een webshop die print-on-demand keukendecoratie verkoopt: inductiebeschermers, spatschermen en muurcirkels.

Je taak: groepeer onderstaande designs in **stijlfamilies**. Een stijlfamilie is een samenhangend visueel thema (bijv. "Modern Marble", "Botanisch", "Bold Bistro", "Scandinavisch", "Tropisch").

Regels:
- Gebruik **8 tot 16** stijlfamilies totaal
- Elke familie heeft een korte, herkenbare Nederlandse of Engelse naam (2-4 woorden)
- Elk design krijgt exact één familie
- Baseer je op naam, type en collecties — niet op productnaam
- Geef ALLEEN een JSON-array terug, geen uitleg

Format:
[
  { "family": "Modern Marble", "codes": ["CALMM", "MIDGL", ...] },
  { "family": "Botanisch", "codes": ["ACU", ...] },
  ...
]

Designs (${designs.length} stuks):
${designList}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from response (Claude may wrap it in markdown)
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Claude gaf geen geldige JSON terug', raw: rawText.slice(0, 500) },
        { status: 500 }
      )
    }

    const families: { family: string; codes: string[] }[] = JSON.parse(jsonMatch[0])

    // Build lookup: designCode → family
    const codeToFamily: Record<string, string> = {}
    for (const f of families) {
      for (const code of f.codes) {
        codeToFamily[code] = f.family
      }
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        families,
        unassigned: designs.filter((d) => !codeToFamily[d.designCode]).map((d) => d.designCode),
      })
    }

    // Save to DB + optionally sync to Notion
    let assigned = 0
    let notionErrors = 0
    const notionBatchSize = 5
    const notionDelayMs = 400 // stay well under Notion rate limit (3 req/s)

    for (const design of designs) {
      const family = codeToFamily[design.designCode]
      if (!family) continue

      // Update DB
      await prisma.design.update({
        where: { id: design.id },
        data: { styleFamily: family },
      })
      assigned++

      // Notion write-back (batched with delay)
      if (notionSync && design.notionId) {
        try {
          await updateStyleFamilyInNotion(design.notionId, family)
          // Small delay to respect Notion rate limits
          await new Promise((r) => setTimeout(r, notionDelayMs))
        } catch (err) {
          console.error(`Notion write-back mislukt voor ${design.designCode}:`, err)
          notionErrors++
        }
        // Extra pause every batch
        if (assigned % notionBatchSize === 0) {
          await new Promise((r) => setTimeout(r, 500))
        }
      }
    }

    return NextResponse.json({
      success: true,
      total: designs.length,
      assigned,
      notionErrors,
      families: families.map((f) => ({ family: f.family, count: f.codes.length })),
    })
  } catch (error) {
    console.error('Stijlfamilie generatie fout:', error)
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
