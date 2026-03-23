import { NextRequest, NextResponse } from 'next/server'
import { createShopifyProduct, buildShopifyProduct, isShopifyConfigured } from '@/lib/shopify'

/**
 * POST /api/designs/[id]/publish
 * Create a draft product on Shopify from a design.
 *
 * Body: {} (uses all design data from DB)
 *
 * Returns the Shopify product ID and handle.
 * The product is created as a DRAFT — use /api/designs/[id]/publish/activate to make it live.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: designId } = await params

  if (!isShopifyConfigured()) {
    return NextResponse.json(
      { error: 'Shopify is not configured. Add SHOPIFY_ACCESS_TOKEN to .env' },
      { status: 503 }
    )
  }

  try {
    const result = await createShopifyProduct(designId)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Shopify publish error:', error)
    const message = error instanceof Error ? error.message : 'Failed to publish to Shopify'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/designs/[id]/publish
 * Preview the Shopify payload that would be sent — without actually publishing.
 * Useful for review before going live.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: designId } = await params

  try {
    const payload = await buildShopifyProduct(designId)
    return NextResponse.json({
      shopifyConfigured: isShopifyConfigured(),
      payload,
    })
  } catch (error) {
    console.error('Shopify preview error:', error)
    const message = error instanceof Error ? error.message : 'Failed to build Shopify payload'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
