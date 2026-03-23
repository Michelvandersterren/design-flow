import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from './env'

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
})

export interface GeneratedContent {
  description: string
  altText: string
  seoTitle: string
  seoDescription: string
}

export async function generateContent(
  designName: string,
  designCode: string,
  collections: string[],
  colorTags: string[],
  productType: 'INDUCTION' | 'CIRCLE' | 'SPLASH'
): Promise<GeneratedContent> {
  const productNames = {
    INDUCTION: 'inductiebeschermer',
    CIRCLE: 'muurcirkel',
    SPLASH: 'spatscherm',
  }
  
  const productName = productNames[productType]
  
  const prompt = `Je schrijft productcontent voor een ${productName} webshop.

Design informatie:
- Design naam: ${designName}
- Design code: ${designCode}
- Collecties: ${collections.join(', ') || 'geen'}
- Kleuren: ${colorTags.join(', ') || 'geen'}
- Product type: ${productName}

Schrijf in het Nederlands:
1. Een aantrekkelijke productbeschrijving (2-3 paragrafen, marketinggericht)
2. Alt-tekst voor productafbeelding (SEO-vriendelijk, beschrijvend)
3. SEO titel (max 60 tekens)
4. SEO meta beschrijving (max 160 tekens)

Formatteer als JSON met keys: description, altText, seoTitle, seoDescription`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
    
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        description: parsed.description || '',
        altText: parsed.altText || '',
        seoTitle: parsed.seoTitle || '',
        seoDescription: parsed.seoDescription || '',
      }
    }
    
    return {
      description: text,
      altText: `${designName} - ${productName}`,
      seoTitle: `${designName} | Premium ${productName}`,
      seoDescription: `Bestel nu de ${designName} ${productName} voor een stijlvolle keuken.`,
    }
  } catch (error) {
    console.error('Anthropic API error:', error)
    throw new Error('Failed to generate content')
  }
}
