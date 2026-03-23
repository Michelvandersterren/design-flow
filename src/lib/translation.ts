import { DEEPL_API_KEY } from './env'
import { prisma } from './prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function translateContent(
  contentId: string,
  targetLanguage: 'de' | 'en' | 'fr'
) {
  const content = await prisma.content.findUnique({
    where: { id: contentId }
  })
  
  if (!content) {
    throw new Error('Content not found')
  }
  
  const targetLangCode = targetLanguage === 'de' ? 'DE' : targetLanguage === 'fr' ? 'FR' : 'EN'
  
  let translatedDescription = content.description
  let translatedAltText = content.altText
  let translatedSeoTitle = content.seoTitle
  let translatedSeoDescription = content.seoDescription
  
  if (DEEPL_API_KEY) {
    try {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [content.description, content.altText, content.seoTitle, content.seoDescription].filter(Boolean),
          target_lang: targetLangCode,
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        const translations = data.translations
        
        if (translations && translations.length >= 4) {
          translatedDescription = translations[0].text
          translatedAltText = translations[1].text
          translatedSeoTitle = translations[2].text
          translatedSeoDescription = translations[3].text
        }
      }
    } catch (error) {
      console.error('DeepL translation error:', error)
    }
  }
  
  const existingTranslation = await prisma.content.findUnique({
    where: {
      designId_language: {
        designId: content.designId,
        language: targetLanguage
      }
    }
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
      }
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
      }
    })
  }
  
  return {
    description: translatedDescription,
    altText: translatedAltText,
    seoTitle: translatedSeoTitle,
    seoDescription: translatedSeoDescription,
  }
}
