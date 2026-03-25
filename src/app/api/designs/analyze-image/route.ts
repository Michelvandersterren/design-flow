import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// KitchenArt collecties als context voor de AI
const IB_COLLECTIONS = [
  'Animal Art', 'Azure Gold', 'Botanical Bloom', 'Classic Art', 'Concrete',
  'Dolce Vita', 'Geometric Elegance', 'Granite Luxe', 'Japandi', 'Landscape',
  'Luxury Gold', 'Luxury Pink', 'Modern Marble', 'Pops of Color', 'Soft Botanical',
  'Solid Elegance', 'Vintage Flowers', 'World of Spices',
]

const MC_COLLECTIONS = [
  'Bloemen', 'Schotse Hooglanders', 'Serenity Landscapes', 'Katten', 'Paarden',
  'Exotic', 'Black & White', 'Kitchen Quotes', 'Modern Abstract', 'Kitchen Pops',
]

export interface ImageAnalysisResult {
  suggestedName: string
  suggestedCode: string
  suggestedCollections: string[]
  suggestedColors: string[]
  suggestedProductTypes: {
    inductionFriendly: boolean
    circleFriendly: boolean
    splashFriendly: boolean
  }
  styleDescription: string
  confidence: 'high' | 'medium' | 'low'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand meegegeven' }, { status: 400 })
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Bestandstype niet ondersteund voor analyse' }, { status: 400 })
    }

    // Convert to base64 — resize to max 1500px to stay under Claude's 5MB limit
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const resizedBuffer = await sharp(rawBuffer)
      .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const base64 = resizedBuffer.toString('base64')
    const mediaType = 'image/jpeg'

    // Load brand voice for context
    let brandVoiceContext = ''
    try {
      const bv = await prisma.brandVoice.findUnique({ where: { key: 'main' } })
      if (bv) {
        brandVoiceContext = `
COLLECTIES INDUCTIEBESCHERMER: ${IB_COLLECTIONS.join(', ')}
COLLECTIES MUURCIRKEL: ${MC_COLLECTIONS.join(', ')}
STIJLOMSCHRIJVING KITCHENART: ${bv.toneOfVoice || ''}
`
      }
    } catch {
      // brand voice not critical for image analysis
    }

    const prompt = `Je analyseert een design afbeelding voor KitchenArt, een Nederlandse webshop voor keukenproducten (inductiebeschermers, muurcirkels, spatschermen).

${brandVoiceContext}

Bekijk de afbeelding zorgvuldig en geef de volgende informatie terug als JSON:

1. suggestedName: Een passende Nederlandse productnaam voor dit design (2-4 woorden, stijlvol, past bij KitchenArt). Denk aan namen zoals "Almond Granite", "Japandi Forest", "Azure Gold Swirl".
2. suggestedCode: Een korte unieke code gebaseerd op de naam (4-6 hoofdletters, geen spaties). Bijv. ALMGR, JPFRS, AZGLD.
3. suggestedCollections: Array van 1-3 collectienamen uit de KitchenArt lijst die het beste passen bij dit design. Kies ALLEEN uit de bekende collecties.
4. suggestedColors: Array van 3-6 kleuromschrijvingen die in dit design voorkomen (bijv. "beige", "goud", "donkergroen", "off-white").
5. suggestedProductTypes: Object met drie booleans:
   - inductionFriendly: true als het design geschikt is voor inductiebeschermers (herhalend patroon of rustig design dat past op een kookplaat)
   - circleFriendly: true als het design geschikt is voor muurcirkels (sfeervol, decoratief, werkt goed in een cirkel)
   - splashFriendly: true als het design geschikt is voor spatschermen (horizontaal of neutraal design dat past achter een fornuis)
6. styleDescription: Korte Nederlandse omschrijving van het design in 1-2 zinnen (sfeer, stijl, kleuren). Dit helpt bij het schrijven van productcontent.
7. confidence: "high" als je zeker bent van de analyse, "medium" als er twijfel is, "low" als de afbeelding onduidelijk is.

Geef ALLEEN het JSON object terug, geen andere tekst.

Voorbeeld output:
{
  "suggestedName": "Marble Luxe Cream",
  "suggestedCode": "MBLXC",
  "suggestedCollections": ["Modern Marble", "Luxury Pink"],
  "suggestedColors": ["crème", "wit", "goud", "lichtgrijs"],
  "suggestedProductTypes": {
    "inductionFriendly": true,
    "circleFriendly": true,
    "splashFriendly": true
  },
  "styleDescription": "Elegant marmerpatroon in zachte crème- en goudtinten met subtiele aders. Past perfect in een moderne of klassieke keuken.",
  "confidence": "high"
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse JSON — strip markdown code blocks if present
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI gaf geen geldig JSON antwoord terug')
    }

    const result: ImageAnalysisResult = JSON.parse(jsonMatch[0])

    // Sanitize — ensure arrays are arrays
    if (!Array.isArray(result.suggestedCollections)) result.suggestedCollections = []
    if (!Array.isArray(result.suggestedColors)) result.suggestedColors = []
    if (!result.suggestedProductTypes) {
      result.suggestedProductTypes = { inductionFriendly: true, circleFriendly: false, splashFriendly: false }
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analyse mislukt' },
      { status: 500 }
    )
  }
}
