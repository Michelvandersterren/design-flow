import { DEEPL_API_KEY } from './env'
import { prisma } from './prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  fr: 'French',
}

async function translateWithClaude(
  texts: { description: string | null; altText: string | null; seoTitle: string | null; seoDescription: string | null },
  targetLanguage: 'de' | 'en' | 'fr'
): Promise<{ description: string | null; altText: string | null; seoTitle: string | null; seoDescription: string | null }> {
  const langName = LANGUAGE_NAMES[targetLanguage]

  const prompt = `You are a professional translator for a Dutch kitchen accessories webshop called KitchenArt. 
Translate the following product content from Dutch to ${langName}.

Keep the commercial, warm tone. Preserve formatting. Translate naturally — do not translate word for word.
Return ONLY a JSON object with the exact same keys as provided. Do not add any explanation.

Content to translate:
${JSON.stringify(texts, null, 2)}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extract JSON from the response
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude did not return valid JSON for translation')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    description: parsed.description ?? texts.description,
    altText: parsed.altText ?? texts.altText,
    seoTitle: parsed.seoTitle ?? texts.seoTitle,
    seoDescription: parsed.seoDescription ?? texts.seoDescription,
  }
}

async function translateWithDeepL(
  texts: (string | null)[],
  targetLangCode: string
): Promise<(string | null)[]> {
  const validTexts = texts.map((t) => t ?? '')

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: validTexts,
      target_lang: targetLangCode,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepL error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.translations.map((t: { text: string }) => t.text)
}

export async function translateContent(
  contentId: string,
  targetLanguage: 'de' | 'en' | 'fr'
) {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
  })

  if (!content) {
    throw new Error('Content not found')
  }

  let translatedDescription = content.description
  let translatedAltText = content.altText
  let translatedSeoTitle = content.seoTitle
  let translatedSeoDescription = content.seoDescription

  if (DEEPL_API_KEY) {
    // Use DeepL when key is available
    try {
      const targetLangCode = targetLanguage === 'de' ? 'DE' : targetLanguage === 'fr' ? 'FR' : 'EN-GB'
      const results = await translateWithDeepL(
        [content.description, content.altText, content.seoTitle, content.seoDescription],
        targetLangCode
      )
      translatedDescription = results[0]
      translatedAltText = results[1]
      translatedSeoTitle = results[2]
      translatedSeoDescription = results[3]
    } catch (error) {
      console.error('DeepL translation failed, falling back to Claude:', error)
      // Fall through to Claude fallback below
      const result = await translateWithClaude(
        {
          description: content.description,
          altText: content.altText,
          seoTitle: content.seoTitle,
          seoDescription: content.seoDescription,
        },
        targetLanguage
      )
      translatedDescription = result.description
      translatedAltText = result.altText
      translatedSeoTitle = result.seoTitle
      translatedSeoDescription = result.seoDescription
    }
  } else {
    // Use Claude as primary translation engine
    try {
      const result = await translateWithClaude(
        {
          description: content.description,
          altText: content.altText,
          seoTitle: content.seoTitle,
          seoDescription: content.seoDescription,
        },
        targetLanguage
      )
      translatedDescription = result.description
      translatedAltText = result.altText
      translatedSeoTitle = result.seoTitle
      translatedSeoDescription = result.seoDescription
    } catch (error) {
      console.error('Claude translation error:', error)
      throw error
    }
  }

  // Upsert the translated content
  const existingTranslation = await prisma.content.findUnique({
    where: {
      designId_language: {
        designId: content.designId,
        language: targetLanguage,
      },
    },
  })

  if (existingTranslation) {
    await prisma.content.update({
      where: { id: existingTranslation.id },
      data: {
        description: translatedDescription,
        altText: translatedAltText,
        seoTitle: translatedSeoTitle,
        seoDescription: translatedSeoDescription,
        translatedFrom: 'nl',
        translationStatus: 'COMPLETED',
      },
    })
  } else {
    await prisma.content.create({
      data: {
        designId: content.designId,
        language: targetLanguage,
        description: translatedDescription,
        altText: translatedAltText,
        seoTitle: translatedSeoTitle,
        seoDescription: translatedSeoDescription,
        translatedFrom: 'nl',
        translationStatus: 'COMPLETED',
      },
    })
  }

  return {
    description: translatedDescription,
    altText: translatedAltText,
    seoTitle: translatedSeoTitle,
    seoDescription: translatedSeoDescription,
  }
}
