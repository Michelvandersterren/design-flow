import { prisma } from './prisma'
import { IB_SIZES, SP_SIZES, SP_MATERIALS, MC_MATERIALS, MC_SIZES } from './constants'
import { getDriveDirectUrl } from './drive'

// Static material labels per product type (matches BrandVoice materialIB/SP).
// MC is excluded: material varies per variant (Aluminium Dibond / Forex).
const PRODUCT_MATERIAL: Record<string, string> = {
  IB: 'Vinyl texture overlay',
  SP: 'Aluminium-Dibond matte',
}

// Plain material label for feeds (Bol.com, Google Shopping etc.).
// MC is excluded: material varies per variant.
const MATERIAL_PLAIN: Record<string, string> = {
  IB: 'Vinyl',
  SP: 'Aluminium-Dibond',
}

// Dutch product type label for Custom Label 0 in Google Shopping feed
const PRODUCT_TYPE_CUSTOM_LABEL: Record<string, string> = {
  IB: 'Inductie Beschermer',
  MC: 'Muurcirkel',
  SP: 'Spatscherm',
}

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || ''
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-04'

function shopifyApiUrl(path: string) {
  return `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}${path}`
}

async function shopifyFetch(path: string, options: RequestInit & { timeoutMs?: number } = {}) {
  if (!SHOPIFY_ACCESS_TOKEN) {
    throw new Error('SHOPIFY_ACCESS_TOKEN is not configured')
  }

  const { timeoutMs = 30000, ...fetchOptions } = options
  const url = shopifyApiUrl(path)
  const response = await fetch(url, {
    ...fetchOptions,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
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

  // Determine product type label and Shopify template suffix
  const firstType = design.variants[0]?.productType
  const productTypeLabel =
    firstType === 'IB' ? 'Inductie Beschermer'
    : firstType === 'MC' ? 'Muurcirkel'
    : firstType === 'SP' ? 'Keuken Spatscherm'
    : 'Product'

  const templateSuffix =
    firstType === 'IB' ? 'inductie-beschermers-cta'
    : firstType === 'MC' ? 'muurcirkel'
    : firstType === 'SP' ? 'spatwand-keuken'
    : undefined

  // Product title: consistent with existing Shopify products
  // IB: "{naam} - Inductie Beschermer" (hyphen-minus)
  // MC: "{naam} – Muurcirkel" (en dash)
  // SP: "{naam} Spatscherm" (no separator, product_type is "Keuken Spatscherm" but title uses "Spatscherm")
  // Strip "(IB)", "(SP)", "(MC)" suffix from forked design names
  const cleanName = design.designName.replace(/\s*\((IB|SP|MC)\)$/i, '')
  const productTitle =
    firstType === 'SP'
      ? `${cleanName} Spatscherm`
      : firstType === 'MC'
      ? `${cleanName} \u2013 ${productTypeLabel}`
      : `${cleanName} - ${productTypeLabel}`

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

  // Lookup helpers for MC labels
  const mcSizeLabel = (diameter: string): string => {
    const d = Math.round(Number(diameter))
    return MC_SIZES.find((s) => s.diameter === d)?.label ?? `ø ${d / 10} cm`
  }
  const mcMaterialLabel = (code: string): string => {
    return MC_MATERIALS.find((m) => m.code === code)?.label ?? code
  }

  // Build Shopify variants
  const hasTwoOptions = firstType === 'SP' || firstType === 'MC'
  const shopifyVariants = design.variants.map((v) => {
    let option1: string
    let option2: string | undefined
    let compareAtPrice: string | undefined

    if (v.productType === 'SP') {
      option1 = spSizeLabel(v.size)
      option2 = spMaterialLabel(v.material ?? '')
      // SP has no compare_at_price
    } else if (v.productType === 'MC') {
      option1 = mcSizeLabel(v.size)
      option2 = mcMaterialLabel(v.material ?? '')
      // MC compare_at_price depends on diameter + material
      const d = Math.round(Number(v.size))
      const mcSize = MC_SIZES.find((s) => s.diameter === d)
      if (mcSize) {
        compareAtPrice = (v.material === 'ADI' ? mcSize.compareAtAdi : mcSize.compareAtFrx).toFixed(2)
      }
    } else if (v.productType === 'IB') {
      const [w, h] = v.size.split('x')
      option1 = formatIbLabel(Number(w), Number(h))
      // IB compare_at_price from IB_SIZES lookup
      const ibSize = IB_SIZES.find((s) => s.width === Number(w) && s.height === Number(h))
      if (ibSize) {
        compareAtPrice = ibSize.compareAt.toFixed(2)
      }
    } else {
      option1 = v.size
    }

    // Build variant metafields
    const variantMetafields: { namespace: string; key: string; value: string; type: string }[] = []

    // Dimensions
    if (v.productType === 'MC') {
      variantMetafields.push({ namespace: 'custom', key: 'diameter_mm',    value: String(Math.round(Number(v.size))),  type: 'number_integer' })
    } else {
      const [wStr, hStr] = v.size.split('x')
      variantMetafields.push({ namespace: 'custom', key: 'width_mm',       value: String(Math.round(Number(wStr))),    type: 'number_integer' })
      variantMetafields.push({ namespace: 'custom', key: 'height_mm',      value: String(Math.round(Number(hStr))),    type: 'number_integer' })
    }

    // Material per variant (SP and MC have material per variant, IB is uniform)
    if (v.productType === 'SP' && v.material) {
      variantMetafields.push({ namespace: 'custom', key: 'materiaal',      value: spMaterialLabel(v.material),         type: 'single_line_text_field' })
    } else if (v.productType === 'MC' && v.material) {
      variantMetafields.push({ namespace: 'custom', key: 'materiaal',      value: mcMaterialLabel(v.material),         type: 'single_line_text_field' })
    } else {
      // IB: static material from MATERIAL_PLAIN
      const matLabel = MATERIAL_PLAIN[v.productType] ?? ''
      if (matLabel) variantMetafields.push({ namespace: 'custom', key: 'materiaal', value: matLabel,                   type: 'single_line_text_field' })
    }

    // Unit of measurement
    variantMetafields.push({ namespace: 'custom', key: 'maateenheid',      value: 'cm',                               type: 'single_line_text_field' })

    // Product dimensions in cm (for feeds / Bol.com)
    if (v.productType === 'MC') {
      const diamCm = (Math.round(Number(v.size)) / 10).toString()
      variantMetafields.push({ namespace: 'custom', key: 'product_hoogte', value: diamCm,                             type: 'number_decimal' })
      variantMetafields.push({ namespace: 'custom', key: 'product_breedte',value: diamCm,                             type: 'number_decimal' })
    } else {
      const [wStr, hStr] = v.size.split('x')
      variantMetafields.push({ namespace: 'custom', key: 'product_breedte',value: String(Math.round(Number(wStr)) / 10), type: 'number_decimal' })
      variantMetafields.push({ namespace: 'custom', key: 'product_hoogte', value: String(Math.round(Number(hStr)) / 10), type: 'number_decimal' })
    }

    // EAN barcode
    if (v.ean) {
      variantMetafields.push({ namespace: 'custom', key: 'ean',            value: v.ean,                              type: 'single_line_text_field' })
    }

    // Google Shopping variant-level metafields
    variantMetafields.push({ namespace: 'mm-google-shopping', key: 'mpn',            value: v.sku,                                         type: 'single_line_text_field' })
    variantMetafields.push({ namespace: 'mm-google-shopping', key: 'custom_label_0', value: PRODUCT_TYPE_CUSTOM_LABEL[v.productType] ?? '', type: 'single_line_text_field' })
    variantMetafields.push({ namespace: 'mm-google-shopping', key: 'condition',      value: 'new',                                         type: 'single_line_text_field' })
    variantMetafields.push({ namespace: 'mm-google-shopping', key: 'gender',         value: 'unisex',                                      type: 'single_line_text_field' })
    variantMetafields.push({ namespace: 'mm-google-shopping', key: 'age_group',      value: 'adult',                                       type: 'single_line_text_field' })

    return {
      option1,
      ...(option2 !== undefined ? { option2 } : {}),
      sku: v.sku,
      price: v.price?.toFixed(2) ?? '33.50',
      ...(compareAtPrice ? { compare_at_price: compareAtPrice } : {}),
      weight: v.weight ?? 0.3,
      weight_unit: 'kg',
      inventory_management: null,
      inventory_policy: 'deny',
      requires_shipping: true,
      taxable: true,
      barcode: v.ean ?? undefined,
      ...(variantMetafields.length > 0 ? { metafields: variantMetafields } : {}),
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

  // Convert plain text to Shopify rich_text_field JSON format
  const toRichText = (text: string | null): string => {
    if (!text) return ''
    const paragraphs = text.split(/\n{2,}/).filter(Boolean)
    const children = paragraphs.map((para) => ({
      type: 'paragraph',
      children: [{ type: 'text', value: para }],
    }))
    return JSON.stringify({ type: 'root', children })
  }

  // SP and MC need two option definitions (size + mounting/material)
  const options = hasTwoOptions
    ? [{ name: 'Formaat' }, { name: firstType === 'SP' ? 'Bevestigingsopties' : 'Materiaal' }]
    : [{ name: 'Formaten' }]

  // Build images array from saved mockups.
  // Use absolute=true to get the direct drive.usercontent.google.com URL —
  // Shopify fetches this server-side so there is no browser CORP restriction.
  // NOTE: images are NOT included in the product create payload (too many causes Shopify 500).
  // They are uploaded separately after product creation in createShopifyProduct().
  const images = (design.mockups ?? []).map((m) => ({
    src: getDriveDirectUrl(m.driveFileId, true),
    alt: m.altText ?? undefined,
  }))

  return {
    product: {
      title: productTitle,
      body_html: toBodyHtml(nlContent.description),
      vendor: 'KitchenArt',
      product_type: productTypeLabel,
      tags: tags.join(', '),
      status: 'draft', // always create as draft first
      ...(templateSuffix ? { template_suffix: templateSuffix } : {}),
      options,
      variants: shopifyVariants,
      metafields: [
        { namespace: 'custom', key: 'design_code',          value: design.designCode,                               type: 'single_line_text_field' },
        { namespace: 'custom', key: 'product_type',         value: firstType ?? '',                                 type: 'single_line_text_field' },
        { namespace: 'custom', key: 'manufacturer',         value: 'probo',                                         type: 'single_line_text_field' },
        { namespace: 'custom', key: 'modelnaam',            value: design.designName,                               type: 'single_line_text_field' },
        { namespace: 'custom', key: 'color_plain',          value: 'Full-colour',                                   type: 'single_line_text_field' },
        { namespace: 'custom', key: 'induction_compatible', value: String(design.inductionFriendly ?? false),       type: 'single_line_text_field' },
        ...(firstType && PRODUCT_MATERIAL[firstType]
          ? [{ namespace: 'custom', key: 'material',        value: PRODUCT_MATERIAL[firstType],                     type: 'single_line_text_field' }]
          : []),
        ...(firstType && MATERIAL_PLAIN[firstType]
          ? [{ namespace: 'custom', key: 'material_plain',  value: MATERIAL_PLAIN[firstType],                       type: 'single_line_text_field' }]
          : []),
        ...(nlContent.description
          ? [{ namespace: 'custom', key: 'product_information',    value: toRichText(nlContent.description),        type: 'rich_text_field' }]
          : []),
        ...(nlContent.longDescription
          ? [{ namespace: 'custom', key: 'marketplace_description', value: toBodyHtml(nlContent.longDescription),   type: 'multi_line_text_field' }]
          : []),
        ...(nlContent.googleShoppingDescription
          ? [{ namespace: 'custom', key: 'google_description',     value: nlContent.googleShoppingDescription,      type: 'multi_line_text_field' }]
          : []),
        // Google Shopping feed fields (product-level, not per-variant)
        { namespace: 'mm-google-shopping', key: 'custom_product',  value: 'true',                                   type: 'boolean' },
        { namespace: 'mm-google-shopping', key: 'condition',       value: 'new',                                    type: 'single_line_text_field' },
        { namespace: 'mm-google-shopping', key: 'gender',          value: 'unisex',                                 type: 'single_line_text_field' },
        { namespace: 'mm-google-shopping', key: 'age_group',       value: 'adult',                                  type: 'single_line_text_field' },
        // Google product category (MC=Home Decor, SP=Kitchen Backsplash; IB has none)
        ...(firstType === 'MC'
          ? [{ namespace: 'mm-google-shopping', key: 'google_product_category', value: '500044',                     type: 'single_line_text_field' }]
          : firstType === 'SP'
          ? [{ namespace: 'mm-google-shopping', key: 'google_product_category', value: '2901',                       type: 'single_line_text_field' }]
          : []),
        ...(nlContent.seoTitle
          ? [{ namespace: 'global', key: 'title_tag',              value: nlContent.seoTitle,                       type: 'single_line_text_field' }]
          : []),
        ...(nlContent.seoDescription
          ? [{ namespace: 'global', key: 'description_tag',        value: nlContent.seoDescription,                 type: 'single_line_text_field' }]
          : []),
      ],
    },
    images,
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
 *
 * Images are uploaded separately after product creation in batches of 3
 * to avoid Shopify 500 errors from too many images in a single request.
 */
export async function createShopifyProduct(designId: string) {
  const { images, ...payload } = await buildShopifyProduct(designId)
  const data = await shopifyFetch('/products.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const shopifyProduct = data.product
  const shopifyProductId = String(shopifyProduct.id)

  // Upload images in batches of 3 (Shopify downloads each from Google Drive server-side)
  if (images.length > 0) {
    const BATCH_SIZE = 3
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map((img) =>
          shopifyFetch(`/products/${shopifyProductId}/images.json`, {
            method: 'POST',
            body: JSON.stringify({ image: { src: img.src, alt: img.alt } }),
            timeoutMs: 60000, // 60s per image — Shopify downloads from Google Drive
          }).catch((err) => {
            console.error(`Image upload failed for ${img.alt ?? 'unknown'}:`, err)
            // Non-fatal: continue with remaining images
          })
        )
      )
    }
  }

  // Save Shopify IDs back to variants (parallel — was sequential for-loop)
  await Promise.all(
    shopifyProduct.variants
      .filter((shopifyVariant: { sku?: string }) => shopifyVariant.sku)
      .map((shopifyVariant: { sku: string; id: number }) =>
        prisma.variant.updateMany({
          where: { designId, sku: shopifyVariant.sku },
          data: {
            shopifyProductId,
            shopifyVariantId: String(shopifyVariant.id),
          },
        })
      )
  )

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
 * Update an existing Shopify product's content fields and metafields.
 * Used when content is regenerated or edited after the product was already published.
 *
 * Updates:
 *  - body_html (short description)
 *  - metafields: product_type, material, induction_compatible,
 *                product_information, marketplace_description (from longDescription),
 *                google_description, global.title_tag, global.description_tag,
 *                mm-google-shopping.condition/gender/age_group
 */
export async function updateShopifyProduct(designId: string, shopifyProductId: string) {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      content: true,
      variants: { orderBy: [{ productType: 'asc' }, { size: 'asc' }], take: 1 },
    },
  })

  if (!design) throw new Error(`Design not found: ${designId}`)

  const nlContent = design.content.find((c) => c.language === 'nl')
  if (!nlContent) throw new Error('Dutch content required')

  const firstType = design.variants[0]?.productType

  // Convert plain-text description to HTML paragraphs for Shopify
  const toBodyHtml = (text: string | null): string => {
    if (!text) return ''
    return text
      .split(/\n{2,}/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('\n')
  }

  // Convert plain text to Shopify rich_text_field JSON format
  const toRichText = (text: string | null): string => {
    if (!text) return ''
    const paragraphs = text.split(/\n{2,}/).filter(Boolean)
    const children = paragraphs.map((para) => ({
      type: 'paragraph',
      children: [{ type: 'text', value: para }],
    }))
    return JSON.stringify({ type: 'root', children })
  }

  // 1. Update body_html on the product itself
  await shopifyFetch(`/products/${shopifyProductId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      product: {
        id: shopifyProductId,
        body_html: toBodyHtml(nlContent.description),
      },
    }),
  })

  // 2. Fetch existing metafields so we can PUT (update) instead of POST (create)
  const metafieldsData = await shopifyFetch(`/products/${shopifyProductId}/metafields.json`)
  const existingMetafields: { id: number; namespace: string; key: string }[] =
    metafieldsData.metafields ?? []

  const findMetafieldId = (namespace: string, key: string): number | undefined =>
    existingMetafields.find((m) => m.namespace === namespace && m.key === key)?.id

  // Helper: upsert a single metafield
  const upsertMetafield = async (
    namespace: string,
    key: string,
    value: string,
    type: string
  ) => {
    const existingId = findMetafieldId(namespace, key)
    if (existingId) {
      await shopifyFetch(`/metafields/${existingId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ metafield: { id: existingId, value, type } }),
      })
    } else {
      await shopifyFetch(`/products/${shopifyProductId}/metafields.json`, {
        method: 'POST',
        body: JSON.stringify({ metafield: { namespace, key, value, type } }),
      })
    }
  }

  // 3. Upsert static product metafields
  await upsertMetafield('custom', 'manufacturer',          'probo',                                           'single_line_text_field')
  await upsertMetafield('custom', 'modelnaam',             design.designName,                                 'single_line_text_field')
  await upsertMetafield('custom', 'color_plain',           'Full-colour',                                     'single_line_text_field')
  await upsertMetafield('custom', 'induction_compatible',  String(design.inductionFriendly ?? false),         'single_line_text_field')
  if (firstType) {
    await upsertMetafield('custom', 'product_type', firstType, 'single_line_text_field')
    if (PRODUCT_MATERIAL[firstType]) {
      await upsertMetafield('custom', 'material',       PRODUCT_MATERIAL[firstType], 'single_line_text_field')
    }
    if (MATERIAL_PLAIN[firstType]) {
      await upsertMetafield('custom', 'material_plain', MATERIAL_PLAIN[firstType],   'single_line_text_field')
    }
  }

  // 4. Upsert all content metafields
  if (nlContent.description) {
    await upsertMetafield('custom', 'product_information',     toRichText(nlContent.description),              'rich_text_field')
  }
  if (nlContent.longDescription) {
    await upsertMetafield('custom', 'marketplace_description', toBodyHtml(nlContent.longDescription),          'multi_line_text_field')
  }
  if (nlContent.googleShoppingDescription) {
    await upsertMetafield('custom', 'google_description',      nlContent.googleShoppingDescription,            'multi_line_text_field')
  }
  // Google Shopping feed fields (product-level)
  await upsertMetafield('mm-google-shopping', 'custom_product', 'true',                                        'boolean')
  await upsertMetafield('mm-google-shopping', 'condition',     'new',                                          'single_line_text_field')
  await upsertMetafield('mm-google-shopping', 'gender',        'unisex',                                       'single_line_text_field')
  await upsertMetafield('mm-google-shopping', 'age_group',     'adult',                                        'single_line_text_field')
  // Google product category (MC=Home Decor, SP=Kitchen Backsplash; IB has none)
  if (firstType === 'MC') {
    await upsertMetafield('mm-google-shopping', 'google_product_category', '500044',                           'single_line_text_field')
  } else if (firstType === 'SP') {
    await upsertMetafield('mm-google-shopping', 'google_product_category', '2901',                             'single_line_text_field')
  }
  if (nlContent.seoTitle) {
    await upsertMetafield('global', 'title_tag',              nlContent.seoTitle,                             'single_line_text_field')
  }
  if (nlContent.seoDescription) {
    await upsertMetafield('global', 'description_tag',        nlContent.seoDescription,                       'single_line_text_field')
  }

  return { shopifyProductId, updated: true }
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
