import { prisma } from './prisma'
import { SP_SIZES, SP_MATERIALS } from './constants'
import { getDriveDirectUrl } from './drive'

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || ''
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-04'

function shopifyApiUrl(path: string) {
  return `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}${path}`
}

async function shopifyFetch(path: string, options: RequestInit = {}) {
  if (!SHOPIFY_ACCESS_TOKEN) {
    throw new Error('SHOPIFY_ACCESS_TOKEN is not configured')
  }

  const url = shopifyApiUrl(path)
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000),
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify API error ${response.status}: ${body}`)
  }

  return response.json()
}

/**
 * Build a Shopify product payload from a design + its content + variants.
 * Supports NL and DE content. NL = default store language.
 */
export async function buildShopifyProduct(designId: string) {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      content: true,
      variants: { orderBy: [{ productType: 'asc' }, { size: 'asc' }] },
      mockups: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!design) throw new Error(`Design not found: ${designId}`)

  const nlContent = design.content.find((c) => c.language === 'nl')
  if (!nlContent) throw new Error('Dutch content required before publishing to Shopify')

  // Determine product type label
  const firstType = design.variants[0]?.productType
  const productTypeLabel =
    firstType === 'IB' ? 'Inductie Beschermer'
    : firstType === 'MC' ? 'Muurcirkel'
    : firstType === 'SP' ? 'Spatscherm'
    : 'Product'

  // Build tags — fields are stored as JSON arrays or comma-separated strings
  const tags: string[] = []
  const parseField = (value: string | null): string[] => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {}
    return value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  if (design.styleFamily) tags.push(design.styleFamily)
  tags.push(...parseField(design.collections))
  tags.push(...parseField(design.colorTags))

  // Lookup helpers for SP labels
  const spSizeLabel = (size: string): string => {
    const [w, h] = size.split('x').map(Number)
    return SP_SIZES.find((s) => s.width === w && s.height === h)?.label ?? size
  }
  const spMaterialLabel = (code: string): string => {
    return SP_MATERIALS.find((m) => m.code === code)?.label ?? code
  }

  // Build Shopify variants
  const isSpProduct = firstType === 'SP'
  const shopifyVariants = design.variants.map((v) => {
    let option1: string
    let option2: string | undefined

    if (v.productType === 'SP') {
      option1 = spSizeLabel(v.size)
      option2 = spMaterialLabel(v.material ?? '')
    } else if (v.productType === 'IB') {
      const [w, h] = v.size.split('x')
      option1 = formatIbLabel(Number(w), Number(h))
    } else {
      // MC
      option1 = `${Math.round(Number(v.size) / 10)} cm`
    }

    return {
      option1,
      ...(option2 !== undefined ? { option2 } : {}),
      sku: v.sku,
      price: v.price?.toFixed(2) ?? '33.50',
      weight: v.weight ? Math.round(v.weight * 1000) : 300,
      weight_unit: 'g',
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      requires_shipping: true,
      taxable: true,
      barcode: v.ean ?? undefined,
    }
  })

  // Convert plain-text description to HTML paragraphs for Shopify
  const toBodyHtml = (text: string | null): string => {
    if (!text) return ''
    return text
      .split(/\n{2,}/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('\n')
  }

  // SP needs two option definitions
  const options = isSpProduct
    ? [{ name: 'Formaat' }, { name: 'Materiaal' }]
    : [{ name: 'Formaten' }]

  // Build images array from saved mockups.
  // Use absolute=true to get the direct drive.usercontent.google.com URL —
  // Shopify fetches this server-side so there is no browser CORP restriction.
  const images = (design.mockups ?? []).map((m) => ({
    src: getDriveDirectUrl(m.driveFileId, true),
    alt: m.altText ?? undefined,
  }))

  return {
    product: {
      title: design.designName,
      body_html: toBodyHtml(nlContent.description),
      vendor: 'KitchenArt',
      product_type: productTypeLabel,
      tags: tags.join(', '),
      status: 'draft', // always create as draft first
      options,
      variants: shopifyVariants,
      ...(images.length > 0 ? { images } : {}),
      metafields: [
        {
          namespace: 'custom',
          key: 'design_code',
          value: design.designCode,
          type: 'single_line_text_field',
        },
        ...(nlContent.longDescription
          ? [
              {
                namespace: 'custom',
                key: 'long_description',
                value: toBodyHtml(nlContent.longDescription),
                type: 'multi_line_text_field',
              },
            ]
          : []),
        ...(nlContent.seoTitle
          ? [
              {
                namespace: 'global',
                key: 'title_tag',
                value: nlContent.seoTitle,
                type: 'single_line_text_field',
              },
            ]
          : []),
        ...(nlContent.seoDescription
          ? [
              {
                namespace: 'global',
                key: 'description_tag',
                value: nlContent.seoDescription,
                type: 'single_line_text_field',
              },
            ]
          : []),
      ],
    },
  }
}

function formatIbLabel(widthMm: number, heightMm: number): string {
  const w = widthMm / 10
  const h = heightMm / 10
  // Format with one decimal only if needed
  const wStr = w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)
  const hStr = h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)
  return `${wStr} × ${hStr} cm`
}

/**
 * Create a product on Shopify (as draft).
 * Saves the Shopify product ID back to the design's variants.
 */
export async function createShopifyProduct(designId: string) {
  const payload = await buildShopifyProduct(designId)
  const data = await shopifyFetch('/products.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const shopifyProduct = data.product
  const shopifyProductId = String(shopifyProduct.id)

  // Save Shopify IDs back to variants
  for (const shopifyVariant of shopifyProduct.variants) {
    const sku = shopifyVariant.sku
    if (!sku) continue
    await prisma.variant.updateMany({
      where: { designId, sku },
      data: {
        shopifyProductId,
        shopifyVariantId: String(shopifyVariant.id),
      },
    })
  }

  // Mark workflow step as completed
  await prisma.workflowStep.upsert({
    where: { designId_step: { designId, step: 'SHOPIFY_PUBLISH' } },
    create: {
      designId,
      step: 'SHOPIFY_PUBLISH',
      status: 'COMPLETED',
      completedAt: new Date(),
      data: JSON.stringify({ shopifyProductId }),
    },
    update: {
      status: 'COMPLETED',
      completedAt: new Date(),
      data: JSON.stringify({ shopifyProductId }),
    },
  })

  return {
    shopifyProductId,
    shopifyProductHandle: shopifyProduct.handle,
    variantsCreated: shopifyProduct.variants.length,
  }
}

/**
 * Publish a draft Shopify product (set status to active).
 */
export async function publishShopifyProduct(shopifyProductId: string) {
  const data = await shopifyFetch(`/products/${shopifyProductId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ product: { id: shopifyProductId, status: 'active' } }),
  })
  return data.product
}

/**
 * Get a product from Shopify by ID.
 */
export async function getShopifyProduct(shopifyProductId: string) {
  const data = await shopifyFetch(`/products/${shopifyProductId}.json`)
  return data.product
}

/**
 * Check if Shopify credentials are configured.
 */
export function isShopifyConfigured(): boolean {
  return !!(SHOPIFY_STORE_URL && SHOPIFY_ACCESS_TOKEN)
}
