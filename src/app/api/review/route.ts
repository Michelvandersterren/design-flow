import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkContent } from '@/lib/quality'
import type { Severity, QualityIssue, ContentQuality } from '@/lib/quality'

/**
 * GET /api/review
 *
 * Returns designs that need content review (status REVIEW by default).
 * Includes quality checks per content field with warnings/errors.
 *
 * Query params:
 *   status  — design status filter (default: REVIEW)
 *   search  — search designName or designCode
 *   page    — pagination (default 1)
 *   limit   — results per page (default 20, max 100)
 */

// Re-export types for consumers
export type { Severity, QualityIssue, ContentQuality }

export interface ReviewDesign {
  id: string
  designCode: string
  designName: string
  designType: string | null
  status: string
  collections: string | null
  styleFamily: string | null
  driveFileId: string | null
  content: {
    id: string
    language: string
    description: string | null
    longDescription: string | null
    seoTitle: string | null
    seoDescription: string | null
    googleShoppingDescription: string | null
    translationStatus: string
  }[]
  variantCount: number
  mockupCount: number
  quality: ContentQuality[]
  overallScore: number
}

export interface ReviewResponse {
  designs: ReviewDesign[]
  total: number
  page: number
  limit: number
  pages: number
  stats: {
    review: number
    approved: number
    draft: number
  }
}

// ── Query handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'REVIEW'
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const where: any = { status }
    if (search) {
      where.OR = [
        { designName: { contains: search } },
        { designCode: { contains: search } },
      ]
    }

    const [designs, total, reviewCount, approvedCount, draftCount] = await Promise.all([
      prisma.design.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          content: true,
          variants: true,
          mockups: true,
        },
      }),
      prisma.design.count({ where }),
      prisma.design.count({ where: { status: 'REVIEW' } }),
      prisma.design.count({ where: { status: 'APPROVED' } }),
      prisma.design.count({ where: { status: 'DRAFT' } }),
    ])

    const reviewDesigns: ReviewDesign[] = designs.map((d) => {
      const quality = d.content.map((c) => checkContent({
        language: c.language,
        description: c.description,
        longDescription: c.longDescription,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
        googleShoppingDescription: c.googleShoppingDescription,
      }))

      // Overall score = average of all language scores, or 0 if no content
      const overallScore = quality.length > 0
        ? Math.round(quality.reduce((sum, q) => sum + q.score, 0) / quality.length)
        : 0

      return {
        id: d.id,
        designCode: d.designCode,
        designName: d.designName,
        designType: d.designType,
        status: d.status,
        collections: d.collections,
        styleFamily: d.styleFamily,
        driveFileId: d.driveFileId,
        content: d.content.map((c) => ({
          id: c.id,
          language: c.language,
          description: c.description,
          longDescription: c.longDescription,
          seoTitle: c.seoTitle,
          seoDescription: c.seoDescription,
          googleShoppingDescription: c.googleShoppingDescription,
          translationStatus: c.translationStatus,
        })),
        variantCount: d.variants.length,
        mockupCount: d.mockups.length,
        quality,
        overallScore,
      }
    })

    return NextResponse.json({
      designs: reviewDesigns,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      stats: {
        review: reviewCount,
        approved: approvedCount,
        draft: draftCount,
      },
    } satisfies ReviewResponse)
  } catch (error) {
    console.error('Error in content review:', error)
    return NextResponse.json({ error: 'Content review failed' }, { status: 500 })
  }
}
