import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WORKFLOW_STEP, STEP_STATUS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const collection = searchParams.get('collection')
    const styleFamily = searchParams.get('styleFamily')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const sortField = searchParams.get('sort') || 'updatedAt'
    const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { designName: { contains: search } },
        { designCode: { contains: search } },
      ]
    }
    if (collection) where.collections = { contains: collection }
    if (styleFamily) where.styleFamily = styleFamily

    const allowedSortFields = ['updatedAt', 'createdAt', 'designName', 'designCode', 'status']
    const orderBy = allowedSortFields.includes(sortField)
      ? { [sortField]: sortDir }
      : { updatedAt: 'desc' as const }

    const [designs, total, statusCounts, collectionsRaw, styleFamiliesRaw] = await Promise.all([
      prisma.design.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          variants: true,
          content: true,
        },
      }),
      prisma.design.count({ where }),
      prisma.design.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.design.findMany({
        where: { collections: { not: null } },
        select: { collections: true },
        distinct: ['collections'],
      }),
      prisma.design.groupBy({
        by: ['styleFamily'],
        where: { styleFamily: { not: null } },
      }),
    ])

    const stats: Record<string, number> = {}
    for (const row of statusCounts) {
      stats[row.status] = row._count.status
    }

    // Collections are stored as JSON arrays, e.g. '["Classic Art"]'
    const collectionsSet = new Set<string>()
    for (const row of collectionsRaw) {
      if (row.collections) {
        try {
          const parsed = JSON.parse(row.collections)
          if (Array.isArray(parsed)) {
            parsed.forEach((c: string) => {
              const trimmed = String(c).trim()
              if (trimmed) collectionsSet.add(trimmed)
            })
          }
        } catch {
          // Fallback: treat as plain string
          const trimmed = row.collections.trim()
          if (trimmed) collectionsSet.add(trimmed)
        }
      }
    }
    const collections = [...collectionsSet].sort()
    const styleFamilies = styleFamiliesRaw
      .map((r) => r.styleFamily as string)
      .filter(Boolean)
      .sort()

    return NextResponse.json({
      designs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      stats,
      collections,
      styleFamilies,
    })
  } catch (error) {
    console.error('Error fetching designs:', error)
    return NextResponse.json({ error: 'Failed to fetch designs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { designCode, designName, inductionFriendly, circleFriendly, splashFriendly } = body
    
    const existing = await prisma.design.findUnique({
      where: { designCode }
    })
    
    if (existing) {
      return NextResponse.json({ error: 'Design code already exists' }, { status: 400 })
    }
    
    const design = await prisma.design.create({
      data: {
        designCode,
        designName,
        inductionFriendly: inductionFriendly || false,
        circleFriendly: circleFriendly || false,
        splashFriendly: splashFriendly || false,
        status: 'DRAFT',
        workflowSteps: {
          create: [
            { step: WORKFLOW_STEP.DESIGN_UPLOAD, status: STEP_STATUS.PENDING },
            { step: WORKFLOW_STEP.CONTENT_GENERATION, status: STEP_STATUS.PENDING },
            { step: WORKFLOW_STEP.TRANSLATION, status: STEP_STATUS.PENDING },
            { step: WORKFLOW_STEP.MOCKUP_GENERATION, status: STEP_STATUS.PENDING },
            { step: WORKFLOW_STEP.PRINTFILE_GENERATION, status: STEP_STATUS.PENDING },
            { step: WORKFLOW_STEP.EAN_GENERATION, status: STEP_STATUS.PENDING },
            { step: WORKFLOW_STEP.SHOPIFY_PUBLISH, status: STEP_STATUS.PENDING },
            { step: WORKFLOW_STEP.NOTION_SYNC, status: STEP_STATUS.PENDING },
          ]
        }
      },
      include: {
        workflowSteps: true
      }
    })
    
    return NextResponse.json({ design })
  } catch (error) {
    console.error('Error creating design:', error)
    return NextResponse.json({ error: 'Failed to create design' }, { status: 500 })
  }
}
