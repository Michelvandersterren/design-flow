import { prisma } from './prisma'
import { IB_SIZES, SP_SIZES, SP_MATERIALS, MC_MATERIALS, MC_SIZES } from './constants'
import { getDriveDirectUrl } from './drive'
import { IB_SIZE_KEY_ALIASES } from './mockup-config'

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

// Shopify product taxonomy category IDs per product type.
// These use the TaxonomyCategory GID format required by the GraphQL `category` field
// (available from API version 2025-01+). Verified against manually-created reference products.
// IB: Cooktop Protectors (Home & Garden > Kitchen & Dining > Kitchen Appliance Accessories > ...)
// MC: Visual Artwork (Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork > ...)
// SP: Kitchen Appliance Accessories (Home & Garden > Kitchen & Dining > ...)
const PRODUCT_CATEGORY_ID: Record<string, string> = {
  IB: 'gid://shopify/TaxonomyCategory/hg-11-6-3-2',
  MC: 'gid://shopify/TaxonomyCategory/hg-3-4-2-3',
  SP: 'gid://shopify/TaxonomyCategory/hg-11-6',
}

// The `category` field on ProductInput requires API version 2025-01+.
// The REST API version may be older, so we hardcode this for category mutations.
const GRAPHQL_CATEGORY_API_VERSION = '2025-01'

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
 * Execute a Shopify GraphQL Admin API mutation/query.
 * @param apiVersion — override API version (e.g. for category mutations that need 2025-01+)
 */
async function shopifyGraphQL(query: string, variables: Record<string, unknown> = {}, apiVersion?: string) {
  if (!SHOPIFY_ACCESS_TOKEN) {
    throw new Error('SHOPIFY_ACCESS_TOKEN is not configured')
  }

  const ver = apiVersion ?? SHOPIFY_API_VERSION
  const url = `https://${SHOPIFY_STORE_URL}/admin/api/${ver}/graphql.json`
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify GraphQL error ${response.status}: ${body}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`)
  }
  return json
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
      variants: true,
      mockups: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!design) throw new Error(`Design not found: ${designId}`)

  // Sort variants: material ASC (ADI < FRX < G < BH0 < BH4), then size numeric ASC
  design.variants.sort((a, b) => {
    const matOrder = (a.material ?? '').localeCompare(b.material ?? '')
    if (matOrder !== 0) return matOrder
    return (Number(a.size) || 0) - (Number(b.size) || 0)
  })

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
  // Strip ALL "(IB)", "(SP)", "(MC)" suffixes from forked design names.
  // Uses global flag to handle names with multiple suffixes (e.g. from double forks).
  const cleanName = design.designName.replace(/\s*\((IB|SP|MC)\)/gi, '').trim()
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
  tags.push('via_enabled')
  if (design.styleFamily) tags.push(design.styleFamily)
  tags.push(...parseField(design.collections))
  tags.push(...parseField(design.colorTags))

  // Build color_plain from colorTags (e.g. "Lichtblauw, Oranje, Bruin")
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const colorPlain = parseField(design.colorTags).map(capitalize).join(', ') || 'Multicolor'

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

  // ---------------------------------------------------------------------------
  // Build images array in correct Shopify order per product type.
  //
  // Pattern (from existing Shopify products):
  //   IB: [hero=largest product shot (dup)] + 5 generic sfeer + 7 size-specific with variant mapping
  //   SP: [hero=first sfeer (dup)] + 5 generic sfeer (no size-specific variants)
  //   MC: [hero=circleart] + 6 generic sfeer (lifestyle, mockup3-8) + 4 size-specific with variant mapping
  //
  // Each image entry has: src, alt, sizeKey? (for variant assignment later), isHeroDuplicate?
  // ---------------------------------------------------------------------------
  type ImageEntry = { src: string; alt?: string; sizeKey?: string; isHeroDuplicate?: boolean }

  // Predefined template ordering per product type (matches existing Shopify products)
  const IB_GENERIC_ORDER = ['IB-mockup3', 'IB-mockup5', 'IB-mockup4', 'IB-mockup6', 'IB-mockup02']
  const IB_SIZED_ORDER = [
    'IB-mockup1-52x35', 'IB-mockup1-59x50', 'IB-mockup1-70x52',
    'IB-mockup1-75x52', 'IB-mockup1-80x52', 'IB-mockup1-86x52', 'IB-mockup1-90x52',
  ]
  // Note: IB-mockup1-50x35 is excluded — existing Shopify products don't include it (520x350 is the smallest)
  const SP_GENERIC_ORDER = ['SP-mockup1', 'SP-mockup2', 'SP-mockup3', 'SP-mockup5', 'SP-mockup7']
  const SP_SIZED_ORDER = [
    'SP-mockup4-60x30', 'SP-mockup4-60x40',
    'SP-mockup4-70x30', 'SP-mockup4-70x50',
    'SP-mockup4-80x40', 'SP-mockup4-80x55',
    'SP-mockup4-90x45', 'SP-mockup4-90x60',
    'SP-mockup4-100x50', 'SP-mockup4-100x65',
    'SP-mockup4-120x60', 'SP-mockup4-120x80',
  ]
  const MC_GENERIC_ORDER = ['MC-lifestyle', 'MC-mockup3', 'MC-mockup5', 'MC-mockup6', 'MC-mockup7', 'MC-mockup8']
  const MC_SIZED_ORDER = ['MC-40cm', 'MC-60cm', 'MC-80cm', 'MC-100cm']

  const mockupMap = new Map((design.mockups ?? []).map((m) => [m.templateId, m]))

  const findMockup = (templateId: string): ImageEntry | null => {
    const m = mockupMap.get(templateId)
    if (!m) return null
    // For IB size-specific mockups, normalize the sizeKey through IB_SIZE_KEY_ALIASES
    // so it matches the PSD sizeKey used by variant assignment. The DB stores the
    // original variant sizeKey (e.g. "620x520") but we need the canonical PSD key
    // (e.g. "590x500") for the image→variant matching to work.
    let sizeKey = m.sizeKey ?? undefined
    if (sizeKey && firstType === 'IB') {
      sizeKey = IB_SIZE_KEY_ALIASES[sizeKey] ?? sizeKey
    }
    return {
      src: getDriveDirectUrl(m.driveFileId, true),
      alt: m.altText ?? undefined,
      sizeKey,
    }
  }

  const images: ImageEntry[] = []

  if (firstType === 'IB') {
    // Hero: largest size-specific shot (90x52), uploaded as generic (no variant assignment)
    const hero = findMockup('IB-mockup1-90x52')
    if (hero) images.push({ ...hero, sizeKey: undefined, isHeroDuplicate: true })
    // Generic sfeer mockups
    for (const tid of IB_GENERIC_ORDER) {
      const img = findMockup(tid)
      if (img) images.push(img)
    }
    // Size-specific product shots (with sizeKey for variant assignment)
    for (const tid of IB_SIZED_ORDER) {
      const img = findMockup(tid)
      if (img) images.push(img)
    }
  } else if (firstType === 'SP') {
    // Hero: largest size-specific product shot (120x80), uploaded as generic (no variant assignment)
    const hero = findMockup('SP-mockup4-120x80')
    if (hero) images.push({ ...hero, sizeKey: undefined, isHeroDuplicate: true })
    // Generic sfeer mockups
    for (const tid of SP_GENERIC_ORDER) {
      const img = findMockup(tid)
      if (img) images.push(img)
    }
    // Size-specific product shots (with sizeKey for variant assignment)
    for (const tid of SP_SIZED_ORDER) {
      const img = findMockup(tid)
      if (img) images.push(img)
    }
  } else if (firstType === 'MC') {
    // Hero: circleart, duplicated
    const hero = findMockup('MC-circleart')
    if (hero) images.push({ ...hero, isHeroDuplicate: true })
    // Generic sfeer mockups (MC-circleart is already the hero — not repeated here)
    for (const tid of MC_GENERIC_ORDER) {
      const img = findMockup(tid)
      if (img) images.push({ ...img, sizeKey: undefined }) // MC-mockup8 has sizeKey but is treated as generic
    }
    // Size-specific product shots (with sizeKey for variant assignment)
    for (const tid of MC_SIZED_ORDER) {
      const img = findMockup(tid)
      if (img) images.push(img)
    }
  }

  return {
    product: {
      title: productTitle,
      body_html: toBodyHtml(nlContent.description ?? nlContent.longDescription),
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
        { namespace: 'custom', key: 'color_plain',          value: colorPlain,                                      type: 'single_line_text_field' },
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
        ...(nlContent.longDescription
          ? [{ namespace: 'custom', key: 'long_description',        value: toRichText(nlContent.longDescription),   type: 'rich_text_field' }]
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
 *
 * After upload:
 *  - Size-specific images are assigned to their matching variants
 *  - beschrijving_afbeelding metafield is set to the image at position 2
 */
export async function createShopifyProduct(designId: string) {
  const { images, ...payload } = await buildShopifyProduct(designId)
  const data = await shopifyFetch('/products.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const shopifyProduct = data.product
  const shopifyProductId = String(shopifyProduct.id)

  // ---------------------------------------------------------------------------
  // Upload images sequentially in batches of 3.
  // Track the Shopify image ID returned for each entry so we can later assign
  // variant images and set beschrijving_afbeelding.
  // ---------------------------------------------------------------------------
  type UploadedImage = { shopifyImageId: number; shopifyMediaId: string; position: number; sizeKey?: string }
  const uploadedImages: UploadedImage[] = []

  if (images.length > 0) {
    console.log(`[Shopify] Uploading ${images.length} images for product ${shopifyProductId}`)
    // Upload images sequentially (one at a time) with a small delay between
    // uploads to avoid Shopify and Google Drive rate limits.
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      console.log(`[Shopify] Uploading image ${i + 1}/${images.length}: ${img.alt ?? 'no alt'} (sizeKey: ${img.sizeKey ?? 'none'})`)
      try {
        const res = await shopifyFetch(`/products/${shopifyProductId}/images.json`, {
          method: 'POST',
          body: JSON.stringify({ image: { src: img.src, alt: img.alt } }),
          timeoutMs: 90000, // 90s per image — Shopify downloads from Google Drive
        })
        if (res?.image) {
          uploadedImages.push({
            shopifyImageId: res.image.id,
            shopifyMediaId: res.image.admin_graphql_api_id,
            position: res.image.position,
            sizeKey: img.sizeKey,
          })
          console.log(`[Shopify] Image ${i + 1} uploaded OK — position ${res.image.position}`)
        } else {
          console.error(`[Shopify] Image ${i + 1} — unexpected response:`, JSON.stringify(res).slice(0, 500))
        }
      } catch (err) {
        console.error(`[Shopify] Image ${i + 1} upload FAILED (${img.alt ?? 'unknown'}):`, err)
      }
      // Small delay between uploads to prevent rate-limiting
      if (i < images.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    console.log(`[Shopify] Image upload complete: ${uploadedImages.length}/${images.length} succeeded`)
  }

  // ---------------------------------------------------------------------------
  // Assign variant images: link size-specific images to their Shopify variants.
  //
  // IB: each size-specific mockup has a sizeKey (e.g. "900x520"). Multiple
  //     variants map to the same mockup via IB_SIZE_KEY_ALIASES.
  // MC: each size-specific mockup has a sizeKey (e.g. "600"). Both ADI and
  //     FRX variants with the same diameter share the image.
  // SP: each size-specific mockup has a sizeKey (e.g. "600x300"). All 3
  //     materials (G, BH0, BH4) for the same size share the image.
  // ---------------------------------------------------------------------------
  const firstType = shopifyProduct.variants?.[0]?.sku?.split('-')[0] as string | undefined

  if (uploadedImages.length > 0 && shopifyProduct.variants?.length > 0) {
    const sizedImages = uploadedImages.filter((img) => img.sizeKey)

    if (sizedImages.length > 0) {
      // Build variant sizeKey → Shopify variant IDs map
      const variantsByMockupSizeKey = new Map<string, number[]>()

      for (const sv of shopifyProduct.variants as Array<{ id: number; sku: string }>) {
        if (!sv.sku) continue
        // Extract variant sizeKey from SKU: IB-CODE-WIDTH-HEIGHT or MC-CODE-DIAM-MAT-SUFFIX
        let variantSizeKey: string | undefined
        let mockupSizeKey: string | undefined

        if (firstType === 'IB') {
          // SKU: IB-CODE-WIDTH-HEIGHT → sizeKey = "WIDTHxHEIGHT"
          const parts = sv.sku.split('-')
          if (parts.length >= 4) {
            variantSizeKey = `${parts[parts.length - 2]}x${parts[parts.length - 1]}`
            mockupSizeKey = IB_SIZE_KEY_ALIASES[variantSizeKey] ?? variantSizeKey
          }
        } else if (firstType === 'MC') {
          // SKU: MC-CODE-DIAM-MAT-SUFFIX → sizeKey = "DIAM"
          const parts = sv.sku.split('-')
          if (parts.length >= 4) {
            mockupSizeKey = parts[2] // diameter, e.g. "600"
          }
        } else if (firstType === 'SP') {
          // SKU: SP-CODE-WIDTH-HEIGHT-MATERIAL → sizeKey = "WIDTHxHEIGHT"
          // Multiple materials (G, BH0, BH4) share same size-specific image
          const parts = sv.sku.split('-')
          if (parts.length >= 5) {
            // Width is 3rd-to-last, Height is 2nd-to-last (last is material code)
            mockupSizeKey = `${parts[parts.length - 3]}x${parts[parts.length - 2]}`
          }
        }

        if (mockupSizeKey) {
          const existing = variantsByMockupSizeKey.get(mockupSizeKey) ?? []
          existing.push(sv.id)
          variantsByMockupSizeKey.set(mockupSizeKey, existing)
        }
      }

      // Update each sized image with its variant IDs
      await Promise.all(
        sizedImages
          .filter((img) => {
            const variantIds = variantsByMockupSizeKey.get(img.sizeKey!)
            return variantIds && variantIds.length > 0
          })
          .map((img) => {
            const variantIds = variantsByMockupSizeKey.get(img.sizeKey!)!
            return shopifyFetch(`/products/${shopifyProductId}/images/${img.shopifyImageId}.json`, {
              method: 'PUT',
              body: JSON.stringify({ image: { id: img.shopifyImageId, variant_ids: variantIds } }),
            }).catch((err) => {
              console.error(`Variant image assignment failed for sizeKey ${img.sizeKey}:`, err)
            })
          })
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Set beschrijving_afbeelding metafield to the image at position 2.
  // This is a file_reference metafield that requires a MediaImage GID.
  // ---------------------------------------------------------------------------
  const pos2Image = uploadedImages.find((img) => img.position === 2)
  if (pos2Image) {
    await shopifyFetch(`/products/${shopifyProductId}/metafields.json`, {
      method: 'POST',
      body: JSON.stringify({
        metafield: {
          namespace: 'custom',
          key: 'beschrijving_afbeelding',
          value: pos2Image.shopifyMediaId,
          type: 'file_reference',
        },
      }),
    }).catch((err) => {
      console.error('Failed to set beschrijving_afbeelding metafield:', err)
    })
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

  // ---------------------------------------------------------------------------
  // Set product category via GraphQL (REST API doesn't support this).
  // The `category` field on ProductInput requires API version 2025-01+.
  // ---------------------------------------------------------------------------
  const categoryId = firstType ? PRODUCT_CATEGORY_ID[firstType] : undefined
  if (categoryId) {
    const productGid = `gid://shopify/Product/${shopifyProductId}`
    console.log(`[Shopify] Setting product category to ${categoryId}`)
    try {
      await shopifyGraphQL(
        `mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id category { id name } }
            userErrors { field message }
          }
        }`,
        { input: { id: productGid, category: categoryId } },
        GRAPHQL_CATEGORY_API_VERSION
      )
    } catch (err) {
      console.error(`[Shopify] Failed to set product category (non-fatal):`, err)
    }
  }

  // Product stays as DRAFT so it can be reviewed before going live.
  // Activation is done manually in Shopify admin or via the design-flow UI.
  console.log(`[Shopify] Product ${shopifyProductId} created as draft — review before activating`)

  return {
    shopifyProductId,
    shopifyProductHandle: shopifyProduct.handle,
    variantsCreated: shopifyProduct.variants.length,
  }
}

/**
 * Full sync of an existing Shopify product from the design-flow database.
 *
 * Updates everything: title, body_html, tags, product_type, template_suffix,
 * variant prices/compare_at/barcodes, product category, all metafields,
 * and re-uploads all mockup images in the correct order.
 */
export async function updateShopifyProduct(designId: string, shopifyProductId: string) {
  // Re-use buildShopifyProduct to get the canonical payload + image list
  const { product: payload, images } = await buildShopifyProduct(designId)

  // Load design for extra fields not in payload
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      content: true,
      variants: true,
    },
  })
  if (!design) throw new Error(`Design not found: ${designId}`)

  const nlContent = design.content.find((c) => c.language === 'nl')
  if (!nlContent) throw new Error('Dutch content required')

  const firstType = design.variants[0]?.productType

  // ---------------------------------------------------------------------------
  // 1. Update core product fields (title, body_html, tags, product_type, template)
  // ---------------------------------------------------------------------------
  console.log(`[Shopify Update] Syncing product fields for ${shopifyProductId}`)
  await shopifyFetch(`/products/${shopifyProductId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      product: {
        id: shopifyProductId,
        title: payload.title,
        body_html: payload.body_html,
        product_type: payload.product_type,
        tags: payload.tags,
        vendor: payload.vendor,
        ...(payload.template_suffix ? { template_suffix: payload.template_suffix } : {}),
      },
    }),
  })

  // ---------------------------------------------------------------------------
  // 2. Update product category via GraphQL (requires API version 2025-01+)
  // ---------------------------------------------------------------------------
  const categoryId = firstType ? PRODUCT_CATEGORY_ID[firstType] : undefined
  if (categoryId) {
    const productGid = `gid://shopify/Product/${shopifyProductId}`
    console.log(`[Shopify Update] Setting product category to ${categoryId}`)
    try {
      await shopifyGraphQL(
        `mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id category { id name } }
            userErrors { field message }
          }
        }`,
        { input: { id: productGid, category: categoryId } },
        GRAPHQL_CATEGORY_API_VERSION
      )
    } catch (err) {
      console.error(`[Shopify Update] Failed to set product category (non-fatal):`, err)
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Update existing variants (price, compare_at_price, barcode, sku)
  //    and track which local variants don't exist on Shopify yet.
  // ---------------------------------------------------------------------------
  console.log(`[Shopify Update] Syncing variants`)
  const shopifyProductData = await shopifyFetch(`/products/${shopifyProductId}.json`)
  const existingShopifyVariants: Array<{ id: number; sku: string }> =
    shopifyProductData.product?.variants ?? []

  // Map existing Shopify variants by SKU for fast lookup
  const shopifyVariantBySku = new Map(existingShopifyVariants.map((v) => [v.sku, v]))

  for (const localVariant of payload.variants) {
    const existing = shopifyVariantBySku.get(localVariant.sku)
    if (existing) {
      // Update existing variant
      await shopifyFetch(`/variants/${existing.id}.json`, {
        method: 'PUT',
        body: JSON.stringify({
          variant: {
            id: existing.id,
            price: localVariant.price,
            compare_at_price: localVariant.compare_at_price ?? null,
            barcode: localVariant.barcode ?? null,
            weight: localVariant.weight,
            weight_unit: localVariant.weight_unit,
          },
        }),
      })
    }
    // Note: creating new variants via REST requires option values to already exist.
    // For now we only update existing variants. New variant creation requires a
    // full republish (delete + create) or GraphQL productVariantsBulkCreate.
  }

  // ---------------------------------------------------------------------------
  // 4. Upsert all product-level metafields
  // ---------------------------------------------------------------------------
  console.log(`[Shopify Update] Syncing metafields`)
  const metafieldsData = await shopifyFetch(`/products/${shopifyProductId}/metafields.json`)
  const existingMetafields: { id: number; namespace: string; key: string }[] =
    metafieldsData.metafields ?? []

  const findMetafieldId = (namespace: string, key: string): number | undefined =>
    existingMetafields.find((m) => m.namespace === namespace && m.key === key)?.id

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

  // Upsert each metafield from the build payload
  for (const mf of payload.metafields) {
    await upsertMetafield(mf.namespace, mf.key, mf.value, mf.type)
  }

  // ---------------------------------------------------------------------------
  // 5. Re-upload all images: delete existing, then upload fresh in correct order
  // ---------------------------------------------------------------------------
  console.log(`[Shopify Update] Re-uploading ${images.length} images`)

  // 5a. Delete all existing images
  const existingImagesData = await shopifyFetch(`/products/${shopifyProductId}/images.json`)
  const existingImages: Array<{ id: number }> = existingImagesData.images ?? []

  for (const img of existingImages) {
    try {
      await shopifyFetch(`/products/${shopifyProductId}/images/${img.id}.json`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error(`[Shopify Update] Failed to delete image ${img.id}:`, err)
    }
  }
  console.log(`[Shopify Update] Deleted ${existingImages.length} existing images`)

  // 5b. Upload new images sequentially (same logic as createShopifyProduct)
  type UploadedImage = { shopifyImageId: number; shopifyMediaId: string; position: number; sizeKey?: string }
  const uploadedImages: UploadedImage[] = []

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    console.log(`[Shopify Update] Uploading image ${i + 1}/${images.length}: ${img.alt ?? 'no alt'} (sizeKey: ${img.sizeKey ?? 'none'})`)
    try {
      const res = await shopifyFetch(`/products/${shopifyProductId}/images.json`, {
        method: 'POST',
        body: JSON.stringify({ image: { src: img.src, alt: img.alt } }),
        timeoutMs: 90000,
      })
      if (res?.image) {
        uploadedImages.push({
          shopifyImageId: res.image.id,
          shopifyMediaId: res.image.admin_graphql_api_id,
          position: res.image.position,
          sizeKey: img.sizeKey,
        })
        console.log(`[Shopify Update] Image ${i + 1} uploaded OK — position ${res.image.position}`)
      } else {
        console.error(`[Shopify Update] Image ${i + 1} — unexpected response:`, JSON.stringify(res).slice(0, 500))
      }
    } catch (err) {
      console.error(`[Shopify Update] Image ${i + 1} upload FAILED (${img.alt ?? 'unknown'}):`, err)
    }
    if (i < images.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  console.log(`[Shopify Update] Image upload complete: ${uploadedImages.length}/${images.length} succeeded`)

  // 5c. Assign variant images (same logic as createShopifyProduct)
  // Re-fetch the product to get current variant IDs
  const updatedProductData = await shopifyFetch(`/products/${shopifyProductId}.json`)
  const updatedVariants: Array<{ id: number; sku: string }> = updatedProductData.product?.variants ?? []

  const sizedImages = uploadedImages.filter((img) => img.sizeKey)
  if (sizedImages.length > 0 && updatedVariants.length > 0) {
    const variantsByMockupSizeKey = new Map<string, number[]>()

    for (const sv of updatedVariants) {
      if (!sv.sku) continue
      let mockupSizeKey: string | undefined

      if (firstType === 'IB') {
        const parts = sv.sku.split('-')
        if (parts.length >= 4) {
          const variantSizeKey = `${parts[parts.length - 2]}x${parts[parts.length - 1]}`
          mockupSizeKey = IB_SIZE_KEY_ALIASES[variantSizeKey] ?? variantSizeKey
        }
      } else if (firstType === 'MC') {
        const parts = sv.sku.split('-')
        if (parts.length >= 4) {
          mockupSizeKey = parts[2]
        }
      } else if (firstType === 'SP') {
        const parts = sv.sku.split('-')
        if (parts.length >= 5) {
          mockupSizeKey = `${parts[parts.length - 3]}x${parts[parts.length - 2]}`
        }
      }

      if (mockupSizeKey) {
        const existing = variantsByMockupSizeKey.get(mockupSizeKey) ?? []
        existing.push(sv.id)
        variantsByMockupSizeKey.set(mockupSizeKey, existing)
      }
    }

    await Promise.all(
      sizedImages
        .filter((img) => {
          const variantIds = variantsByMockupSizeKey.get(img.sizeKey!)
          return variantIds && variantIds.length > 0
        })
        .map((img) => {
          const variantIds = variantsByMockupSizeKey.get(img.sizeKey!)!
          return shopifyFetch(`/products/${shopifyProductId}/images/${img.shopifyImageId}.json`, {
            method: 'PUT',
            body: JSON.stringify({ image: { id: img.shopifyImageId, variant_ids: variantIds } }),
          }).catch((err) => {
            console.error(`[Shopify Update] Variant image assignment failed for sizeKey ${img.sizeKey}:`, err)
          })
        })
    )
  }

  // 5d. Set beschrijving_afbeelding metafield to image at position 2
  const pos2Image = uploadedImages.find((img) => img.position === 2)
  if (pos2Image) {
    await upsertMetafield('custom', 'beschrijving_afbeelding', pos2Image.shopifyMediaId, 'file_reference')
  }

  console.log(`[Shopify Update] Full sync complete for product ${shopifyProductId}`)
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
