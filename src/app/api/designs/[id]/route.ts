import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const design = await prisma.design.findUnique({
      where: { id },
      include: {
        variants: true,
        content: true,
        workflowSteps: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }
    
    return NextResponse.json({ design })
  } catch (error) {
    console.error('Error fetching design:', error)
    return NextResponse.json({ error: 'Failed to fetch design' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const design = await prisma.design.update({
      where: { id },
      data: {
        designName: body.designName,
        designType: body.designType,
        styleFamily: body.styleFamily,
        collections: body.collections,
        colorTags: body.colorTags,
        inductionFriendly: body.inductionFriendly,
        circleFriendly: body.circleFriendly,
        splashFriendly: body.splashFriendly,
        status: body.status,
      },
      include: {
        variants: true,
        content: true,
        workflowSteps: true
      }
    })
    
    return NextResponse.json({ design })
  } catch (error) {
    console.error('Error updating design:', error)
    return NextResponse.json({ error: 'Failed to update design' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await prisma.design.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting design:', error)
    return NextResponse.json({ error: 'Failed to delete design' }, { status: 500 })
  }
}
