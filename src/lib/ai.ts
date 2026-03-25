import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getFileAsBase64 } from '@/lib/drive'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface GeneratedContent {
  description: string
  longDescription: string
  seoTitle: string
  seoDescription: string
  googleShoppingDescription: string
}

interface BrandVoiceContext {
  companyInfo?: string | null
  mission?: string | null
  targetAudience?: string | null
  partnerInfo?: string | null
  materialIB?: string | null
  materialMC?: string | null
  materialSP?: string | null
  toneOfVoice?: string | null
  doUse?: string | null
  doNotUse?: string | null
  seoKeywordsIB?: string | null
  seoKeywordsMC?: string | null
  seoKeywordsSP?: string | null
  exampleDescriptionIB?: string | null
  exampleDescriptionMC?: string | null
  exampleDescriptionSP?: string | null
  faq?: string | null
}

async function loadBrandVoice(): Promise<BrandVoiceContext | null> {
  try {
    return await prisma.brandVoice.findUnique({ where: { key: 'main' } })
  } catch {
    return null
  }
}

function buildBrandVoiceSection(bv: BrandVoiceContext, productType: 'INDUCTION' | 'CIRCLE' | 'SPLASH'): string {
  const materialMap = {
    INDUCTION: bv.materialIB,
    CIRCLE: bv.materialMC,
    SPLASH: bv.materialSP,
  }
  const seoMap = {
    INDUCTION: bv.seoKeywordsIB,
    CIRCLE: bv.seoKeywordsMC,
    SPLASH: bv.seoKeywordsSP,
  }
  const exampleMap = {
    INDUCTION: bv.exampleDescriptionIB,
    CIRCLE: bv.exampleDescriptionMC,
    SPLASH: bv.exampleDescriptionSP,
  }

  const parts: string[] = ['=== BRAND VOICE DOCUMENT ===']

  if (bv.companyInfo) parts.push(`OVER KITCHENART:\n${bv.companyInfo}`)
  if (bv.mission) parts.push(`MISSIE:\n${bv.mission}`)
  if (bv.targetAudience) parts.push(`DOELGROEP:\n${bv.targetAudience}`)
  if (bv.partnerInfo) parts.push(`PRODUCTIEPARTNER:\n${bv.partnerInfo}`)

  const material = materialMap[productType]
  if (material) parts.push(`MATERIAAL VOOR DIT PRODUCT:\n${material}`)

  if (bv.toneOfVoice) parts.push(`SCHRIJFSTIJL:\n${bv.toneOfVoice}`)
  if (bv.doUse) parts.push(`GEBRUIK DEZE WOORDEN/UITDRUKKINGEN:\n${bv.doUse}`)
  if (bv.doNotUse) parts.push(`VERMIJD DEZE WOORDEN:\n${bv.doNotUse}`)

  const seo = seoMap[productType]
  if (seo) parts.push(`RELEVANTE SEO KEYWORDS:\n${seo}`)

  const example = exampleMap[productType]
  if (example) parts.push(`VOORBEELD PRODUCTBESCHRIJVING (ter referentie, niet kopiëren):\n${example}`)

  if (bv.faq) {
    try {
      const faqItems = JSON.parse(bv.faq) as { q: string; a: string }[]
      if (faqItems.length > 0) {
        const faqText = faqItems.map((item) => `V: ${item.q}\nA: ${item.a}`).join('\n\n')
        parts.push(`FAQ REFERENTIE:\n${faqText}`)
      }
    } catch {
      // ignore parse errors
    }
  }

  parts.push('=== EINDE BRAND VOICE ===')
  return parts.join('\n\n')
}

export async function generateContent(
  designName: string,
  designCode: string,
  collections: string[],
  colorTags: string[],
  productType: 'INDUCTION' | 'CIRCLE' | 'SPLASH',
  driveFileId?: string | null
): Promise<GeneratedContent> {
  const productNames = {
    INDUCTION: 'inductiebeschermer',
    CIRCLE: 'muurcirkel',
    SPLASH: 'spatscherm',
  }

  const productName = productNames[productType]
  const bv = await loadBrandVoice()
  const brandVoiceSection = bv ? buildBrandVoiceSection(bv, productType) : ''

  const textPrompt = `${brandVoiceSection}

Je schrijft productcontent voor KitchenArt, een webshop voor premium keukenproducten.

DESIGN INFORMATIE:
- Design naam: ${designName}
- Design code: ${designCode}
- Collecties: ${collections.join(', ') || 'geen'}
- Kleuren: ${colorTags.join(', ') || 'geen'}
- Product type: ${productName}
${driveFileId ? '- Afbeelding: zie bijgevoegd beeld — gebruik dit als primaire bron voor de visuele beschrijving' : ''}

INSTRUCTIES:
Schrijf in het Nederlands, passend bij de KitchenArt brand voice hierboven.
${driveFileId ? 'Beschrijf het design visueel accuraat op basis van de afbeelding. Noem specifieke patronen, kleuren en sfeer die je ziet.' : ''}

1. Korte beschrijving (description): 1-2 zinnen, wervend en sfeergevend — verschijnt bovenaan de productpagina bij de koop-knop.
2. Lange beschrijving (longDescription): 2-3 paragrafen, meer uitgebreid — verschijnt verder op de pagina. Verwerk materiaal, gebruik, design inspiratie en gevoel. Verwerk het product type natuurlijk.
3. SEO titel: max 60 tekens, bevat design naam + product type + KitchenArt.
4. SEO meta beschrijving: max 160 tekens, wervend, bevat relevante keywords.
5. Google Shopping beschrijving (googleShoppingDescription): 300–500 tekens, feitelijk en feature-gedreven (geen emotionele taal), noem materiaal, afmetingen en gebruik — geschikt voor Google Shopping feed.

Geef het resultaat als JSON met keys: description, longDescription, seoTitle, seoDescription, googleShoppingDescription`

  try {
    // Try to load image from Drive if fileId is provided
    let imageData: { base64: string; mimeType: string } | null = null
    if (driveFileId) {
      try {
        imageData = await getFileAsBase64(driveFileId)
      } catch (err) {
        console.warn(`Could not load Drive image for content generation (${driveFileId}):`, err)
        // Non-fatal — fall back to text-only generation
      }
    }

    // Build message content — with or without image
    type ContentBlock =
      | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } }
      | { type: 'text'; text: string }

    const messageContent: ContentBlock[] = []

    if (imageData) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
      const mediaType = allowedTypes.includes(imageData.mimeType)
        ? (imageData.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif')
        : 'image/png'

      messageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: imageData.base64 },
      })
    }

    messageContent.push({ type: 'text', text: textPrompt })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        description: parsed.description || '',
        longDescription: parsed.longDescription || '',
        seoTitle: parsed.seoTitle || '',
        seoDescription: parsed.seoDescription || '',
        googleShoppingDescription: parsed.googleShoppingDescription || '',
      }
    }

    return {
      description: text,
      longDescription: '',
      seoTitle: `${designName} | Premium ${productName} | KitchenArt`,
      seoDescription: `Bestel nu de ${designName} ${productName} bij KitchenArt. Stijlvol design voor een unieke keuken.`,
      googleShoppingDescription: `${designName} ${productName} van KitchenArt. Gemaakt van hoogwaardig materiaal, geschikt voor dagelijks gebruik in de keuken. Stijlvol design dat past bij elke keukeninrichting.`,
    }
  } catch (error) {
    console.error('Anthropic API error:', error)
    throw new Error('Failed to generate content')
  }
}
