import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const { designId, productType } = await request.json()
    
    const design = await prisma.design.findUnique({
      where: { id: designId }
    })
    
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }
    
    await prisma.design.update({
      where: { id: designId },
      data: { status: 'CONTENT_GENERATING' }
    })
    
    await prisma.workflowStep.updateMany({
      where: { designId, step: 'CONTENT_GENERATION' },
      data: { status: 'IN_PROGRESS' }
    })
    
    const collections = design.collections ? JSON.parse(design.collections) : []
    const colorTags = design.colorTags ? JSON.parse(design.colorTags) : []
    
    const content = await generateContent(
      design.designName,
      design.designCode,
      collections,
      colorTags,
      productType || 'INDUCTION'
    )
    
    const existingContent = await prisma.content.findUnique({
      where: {
        designId_language: { designId, language: 'nl' }
      }
    })
    
    if (existingContent) {
      await prisma.content.update({
        where: { id: existingContent.id },
        data: {
          description: content.description,
          altText: content.altText,
          seoTitle: content.seoTitle,
          seoDescription: content.seoDescription,
          translationStatus: 'PENDING',
        }
      })
    } else {
      await prisma.content.create({
        data: {
          designId,
          language: 'nl',
          description: content.description,
          altText: content.altText,
          seoTitle: content.seoTitle,
          seoDescription: content.seoDescription,
          translationStatus: 'PENDING',
        }
      })
    }
    
    await prisma.workflowStep.updateMany({
      where: { designId, step: 'CONTENT_GENERATION' },
      data: { status: 'COMPLETED', completedAt: new Date() }
    })
    
    await prisma.design.update({
      where: { id: designId },
      data: { status: 'REVIEW' }
    })
    
    return NextResponse.json({
      success: true,
      content
    })
  } catch (error) {
    console.error('Content generation error:', error)
    
    if (error instanceof Error && error.message === 'Failed to generate content') {
      return NextResponse.json({ error: 'AI content generation failed' }, { status: 500 })
    }
    
    return NextResponse.json({ error: 'Content generation error' }, { status: 500 })
  }
}
