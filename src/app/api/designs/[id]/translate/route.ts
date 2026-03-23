import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { translateContent } from '@/lib/translation'
import { PRODUCT_SKU_PREFIX } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const { language, contentId } = await request.json()
    
    if (contentId) {
      const result = await translateContent(contentId, language)
      return NextResponse.json({ success: true, ...result })
    }
    
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        content: {
          where: { language: 'nl' }
        }
      }
    })
    
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }
    
    if (design.content.length === 0) {
      return NextResponse.json({ error: 'No Dutch content to translate' }, { status: 400 })
    }
    
    const result = await translateContent(design.content[0].id, language)
    
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Translation error:', error)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
