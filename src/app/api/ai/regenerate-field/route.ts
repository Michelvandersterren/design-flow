import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadBrandVoice, buildBrandVoiceSection } from '@/lib/ai'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const FIELD_LABELS: Record<string, string> = {
  description: 'korte beschrijving (1-2 zinnen, wervend, sfeergevend)',
  longDescription: 'lange beschrijving (2-3 paragrafen, materiaal, gebruik, design inspiratie)',
  seoTitle: 'SEO titel (max 60 tekens, bevat design naam + product type + KitchenArt)',
  seoDescription: 'SEO meta beschrijving (max 160 tekens, wervend, bevat keywords)',
  googleShoppingDescription: 'Google Shopping beschrijving (300-500 tekens, feitelijk, noem materiaal, maten, gebruik)',
}

const PRODUCT_TYPE_MAP: Record<string, 'INDUCTION' | 'CIRCLE' | 'SPLASH'> = {
  IB: 'INDUCTION',
  MC: 'CIRCLE',
  SP: 'SPLASH',
}

const PRODUCT_NAMES: Record<string, string> = {
  IB: 'inductiebeschermer',
  MC: 'muurcirkel',
  SP: 'spatscherm',
}

type SupportedLang = 'nl' | 'de' | 'en' | 'fr'

/**
 * POST /api/ai/regenerate-field
 *
 * Regenerates a single content field using AI with full brand voice context.
 *
 * Body: { designId: string, field: string, language: string }
 *   - field: one of description, longDescription, seoTitle, seoDescription, googleShoppingDescription
 *   - language: the content language (nl, de, en, fr)
 */
export async function POST(request: NextRequest) {
  try {
    const { designId, field, language } = await request.json()

    if (!designId || !field || !language) {
      return NextResponse.json({ error: 'designId, field en language zijn verplicht' }, { status: 400 })
    }

    if (!FIELD_LABELS[field]) {
      return NextResponse.json({ error: `Ongeldig veld: ${field}` }, { status: 400 })
    }

    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: { content: { where: { language } } },
    })

    if (!design) {
      return NextResponse.json({ error: 'Design niet gevonden' }, { status: 404 })
    }

    const existingContent = design.content[0]
    if (!existingContent) {
      return NextResponse.json({ error: `Geen ${language} content gevonden voor dit design` }, { status: 400 })
    }

    const collections = design.collections ? JSON.parse(design.collections) : []
    const colorTags = design.colorTags ? JSON.parse(design.colorTags) : []
    const designTypeKey = design.designType || 'IB'
    const productName = PRODUCT_NAMES[designTypeKey] || 'inductiebeschermer'
    const productType = PRODUCT_TYPE_MAP[designTypeKey] || 'INDUCTION'

    // Load full brand voice with language-specific fields
    const bv = await loadBrandVoice()
    const lang = (['nl', 'de', 'en', 'fr'].includes(language) ? language : 'nl') as SupportedLang
    const brandVoiceSection = bv ? buildBrandVoiceSection(bv, productType, lang) : ''

    // Show the other fields as context
    const otherFields = Object.entries(FIELD_LABELS)
      .filter(([key]) => key !== field)
      .map(([key]) => {
        const val = (existingContent as unknown as Record<string, string | null>)[key]
        return val ? `${key}: ${val}` : null
      })
      .filter(Boolean)

    const otherFieldsContext = otherFields.length > 0
      ? '\nBestaande content (ter referentie, niet herhalen):\n' + otherFields.join('\n')
      : ''

    const langLabel = language === 'nl' ? 'Nederlands'
      : language === 'de' ? 'Duits'
      : language === 'en' ? 'Engels'
      : language === 'fr' ? 'Frans'
      : language

    const prompt = `${brandVoiceSection}

Je schrijft productcontent voor KitchenArt, een webshop voor premium keukenproducten.

Design: ${design.designName} (${design.designCode})
Product type: ${productName}
Collecties: ${collections.join(', ') || 'geen'}
Kleuren: ${colorTags.join(', ') || 'geen'}
${otherFieldsContext}

OPDRACHT:
Schrijf ALLEEN een nieuwe ${FIELD_LABELS[field]} in het ${langLabel}.
Het huidige veld bevat: "${(existingContent as unknown as Record<string, string | null>)[field] || '(leeg)'}"

Schrijf een verbeterde versie. Let specifiek op:
- Geen em-dashes (\u2014), geen uitroeptekens, geen retorische vragen als opening
- Geen "echt", "werkelijk", "daadwerkelijk" als versterker
- Varieer in zinsopbouw ten opzichte van de bestaande content

Geef ALLEEN de nieuwe tekst terug, zonder aanhalingstekens, uitleg of JSON-wrapper.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const newValue = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : ''

    if (!newValue) {
      return NextResponse.json({ error: 'AI gaf geen bruikbare output' }, { status: 500 })
    }

    // Update just this field
    await prisma.content.update({
      where: { id: existingContent.id },
      data: { [field]: newValue },
    })

    return NextResponse.json({
      success: true,
      field,
      oldValue: (existingContent as unknown as Record<string, string | null>)[field],
      newValue,
    })
  } catch (error) {
    console.error('Field regeneration error:', error)
    return NextResponse.json({ error: 'Veld hergenereren mislukt' }, { status: 500 })
  }
}
