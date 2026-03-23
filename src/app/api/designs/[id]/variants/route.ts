import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PRODUCT_SKU_PREFIX } from '@/lib/constants'

const STANDARD_INDUCTION_SIZES = [
  '52x35', '59x52', '60x52', '62x52', '65x52', '70x52', '71x52',
  '76x51.5', '77x51', '77x52', '78x52', '80x52', '88x52'
]

const STANDARD_CIRCLE_SIZES = ['40cm', '50cm', '60cm', '80cm']

const STANDARD_SPLASH_SIZES = ['60x45', '70x50', '80x60']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    const { productTypes } = await request.json()
    
    const design = await prisma.design.findUnique({
      where: { id: designId }
    })
    
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 })
    }
    
    const typesToCreate = productTypes || []
    if (design.inductionFriendly && !typesToCreate.includes('INDUCTION')) {
      typesToCreate.push('INDUCTION')
    }
    if (design.circleFriendly && !typesToCreate.includes('CIRCLE')) {
      typesToCreate.push('CIRCLE')
    }
    if (design.splashFriendly && !typesToCreate.includes('SPLASH')) {
      typesToCreate.push('SPLASH')
    }
    
    const variants: any[] = []
    
    for (const productType of typesToCreate) {
      const prefix = PRODUCT_SKU_PREFIX[productType as keyof typeof PRODUCT_SKU_PREFIX]
      let sizes: string[]
      
      switch (productType) {
        case 'INDUCTION':
          sizes = STANDARD_INDUCTION_SIZES
          break
        case 'CIRCLE':
          sizes = STANDARD_CIRCLE_SIZES
          break
        case 'SPLASH':
          sizes = STANDARD_SPLASH_SIZES
          break
        default:
          continue
      }
      
      for (const size of sizes) {
        const sku = `${prefix}-${design.designCode}-${size.replace('cm', '').replace('x', '-')}`
        
        const existing = await prisma.variant.findUnique({
          where: { sku }
        })
        
        if (existing) continue
        
        const variant = await prisma.variant.create({
          data: {
            designId,
            productType,
            size,
            sku,
          }
        })
        
        variants.push(variant)
      }
    }
    
    await prisma.workflowStep.updateMany({
      where: { designId, step: 'DESIGN_UPLOAD' },
      data: { status: 'COMPLETED', completedAt: new Date() }
    })
    
    return NextResponse.json({ success: true, variants })
  } catch (error) {
    console.error('Variant creation error:', error)
    return NextResponse.json({ error: 'Failed to create variants' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: designId } = await params
    
    const variants = await prisma.variant.findMany({
      where: { designId },
      orderBy: { createdAt: 'asc' }
    })
    
    return NextResponse.json({ variants })
  } catch (error) {
    console.error('Error fetching variants:', error)
    return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 })
  }
}
