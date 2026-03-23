import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WORKFLOW_STEP, STEP_STATUS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    
    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { designName: { contains: search } },
        { designCode: { contains: search } },
      ]
    }
    
    const designs = await prisma.design.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        variants: true,
        content: true,
      }
    })
    
    return NextResponse.json({ designs })
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
