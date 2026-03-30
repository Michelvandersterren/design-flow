import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShopifyProduct, isShopifyConfigured } from '@/lib/shopify'

/**
 * POST /api/designs/[id]/verify
 *
 * Verifies that a published design matches what's on Shopify.
 * Compares product fields, variants, metafields, and images.
 * Returns a structured verification report.
 */

export type VerifyStatus = 'pass' | 'warn' | 'fail'

export interface VerifyCheck {
  category: string
  label: string
  status: VerifyStatus
  expected?: string
  actual?: string
  detail?: string
}

export interface VerifyResponse {
  designId: string
  designCode: string
  shopifyProductId: string
  checks: VerifyCheck[]
  summary: { pass: number; warn: number; fail: number }
  verifiedAt: string
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  IB: 'Inductie Beschermer',
  MC: 'Muurcirkel',
  SP: 'Keuken Spatscherm',
}

const TEMPLATE_SUFFIXES: Record<string, string> = {
  IB: 'inductie-beschermers-cta',
  MC: 'muurcirkel',
  SP: 'spatwand-keuken',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: designId } = await params

  if (!isShopifyConfigured()) {
    return NextResponse.json(
      { error: 'Shopify is niet geconfigureerd' },
      { status: 503 }
    )
  }

  try {
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        content: true,
        variants: true,
        mockups: true,
        workflowSteps: true,
      },
    })

    if (!design) {
      return NextResponse.json({ error: 'Design niet gevonden' }, { status: 404 })
    }

    const shopifyProductId = design.variants.find((v) => v.shopifyProductId)?.shopifyProductId
    if (!shopifyProductId) {
      return NextResponse.json(
        { error: 'Design is nog niet gepubliceerd naar Shopify' },
        { status: 400 }
      )
    }

    const checks: VerifyCheck[] = []

    // ── Fetch product from Shopify ──────────────────────────────────────

    let shopifyProduct: any
    try {
      shopifyProduct = await getShopifyProduct(shopifyProductId)
      checks.push({
        category: 'Product',
        label: 'Product bestaat op Shopify',
        status: 'pass',
        actual: `ID: ${shopifyProductId}`,
      })
    } catch (err) {
      checks.push({
        category: 'Product',
        label: 'Product bestaat op Shopify',
        status: 'fail',
        detail: `Product niet gevonden of Shopify-fout: ${err instanceof Error ? err.message : 'onbekend'}`,
      })
      // Cannot continue without the product
      return NextResponse.json(buildResponse(designId, design.designCode, shopifyProductId, checks))
    }

    // ── Product-level checks ────────────────────────────────────────────

    // Status
    checks.push({
      category: 'Product',
      label: 'Product status',
      status: shopifyProduct.status === 'active' ? 'pass' : 'warn',
      expected: 'active',
      actual: shopifyProduct.status,
      detail: shopifyProduct.status === 'draft' ? 'Product staat nog op draft' : undefined,
    })

    // Vendor
    checks.push({
      category: 'Product',
      label: 'Vendor',
      status: shopifyProduct.vendor === 'KitchenArt' ? 'pass' : 'fail',
      expected: 'KitchenArt',
      actual: shopifyProduct.vendor,
    })

    // Product type
    const expectedType = design.designType ? PRODUCT_TYPE_LABELS[design.designType] : undefined
    if (expectedType) {
      checks.push({
        category: 'Product',
        label: 'Product type',
        status: shopifyProduct.product_type === expectedType ? 'pass' : 'warn',
        expected: expectedType,
        actual: shopifyProduct.product_type || '(leeg)',
      })
    }

    // Template suffix
    const expectedTemplate = design.designType ? TEMPLATE_SUFFIXES[design.designType] : undefined
    if (expectedTemplate) {
      checks.push({
        category: 'Product',
        label: 'Template suffix',
        status: shopifyProduct.template_suffix === expectedTemplate ? 'pass' : 'warn',
        expected: expectedTemplate,
        actual: shopifyProduct.template_suffix || '(leeg)',
      })
    }

    // Title non-empty
    checks.push({
      category: 'Product',
      label: 'Titel aanwezig',
      status: shopifyProduct.title ? 'pass' : 'fail',
      actual: shopifyProduct.title || '(leeg)',
    })

    // Body HTML non-empty
    checks.push({
      category: 'Product',
      label: 'Body HTML aanwezig',
      status: shopifyProduct.body_html ? 'pass' : 'warn',
      actual: shopifyProduct.body_html ? `${shopifyProduct.body_html.length} tekens` : '(leeg)',
    })

    // Tags check (via_enabled)
    const tags = (shopifyProduct.tags || '').split(',').map((t: string) => t.trim().toLowerCase())
    checks.push({
      category: 'Product',
      label: 'Tag "via_enabled" aanwezig',
      status: tags.includes('via_enabled') ? 'pass' : 'warn',
      actual: tags.includes('via_enabled') ? 'Ja' : 'Nee',
    })

    // ── Variant checks ──────────────────────────────────────────────────

    const shopifyVariants: any[] = shopifyProduct.variants || []
    const localVariants = design.variants

    // Variant count
    checks.push({
      category: 'Varianten',
      label: 'Aantal varianten',
      status: shopifyVariants.length === localVariants.length ? 'pass' : 'fail',
      expected: String(localVariants.length),
      actual: String(shopifyVariants.length),
    })

    // SKU matching
    const shopifySkus = new Set(shopifyVariants.map((v: any) => v.sku))
    const localSkus = localVariants.map((v) => v.sku)
    const missingSkus = localSkus.filter((sku) => !shopifySkus.has(sku))
    checks.push({
      category: 'Varianten',
      label: 'SKU\'s overeenkomen',
      status: missingSkus.length === 0 ? 'pass' : 'fail',
      expected: `${localSkus.length} SKU's`,
      actual: missingSkus.length > 0 ? `${missingSkus.length} ontbrekend: ${missingSkus.slice(0, 3).join(', ')}${missingSkus.length > 3 ? '...' : ''}` : 'Alles aanwezig',
    })

    // Price matching
    let priceIssues = 0
    for (const localV of localVariants) {
      const shopifyV = shopifyVariants.find((sv: any) => sv.sku === localV.sku)
      if (shopifyV && localV.price) {
        const localPrice = localV.price.toFixed(2)
        const shopifyPrice = parseFloat(shopifyV.price).toFixed(2)
        if (localPrice !== shopifyPrice) priceIssues++
      }
    }
    checks.push({
      category: 'Varianten',
      label: 'Prijzen overeenkomen',
      status: priceIssues === 0 ? 'pass' : 'warn',
      detail: priceIssues > 0 ? `${priceIssues} variant(en) met afwijkende prijs` : undefined,
    })

    // EAN/barcode matching
    let eanIssues = 0
    let missingBarcodes = 0
    for (const localV of localVariants) {
      const shopifyV = shopifyVariants.find((sv: any) => sv.sku === localV.sku)
      if (shopifyV) {
        if (!shopifyV.barcode && localV.ean) {
          missingBarcodes++
        } else if (shopifyV.barcode !== localV.ean) {
          eanIssues++
        }
      }
    }
    checks.push({
      category: 'Varianten',
      label: 'EAN/barcodes overeenkomen',
      status: eanIssues === 0 && missingBarcodes === 0 ? 'pass' : missingBarcodes > 0 ? 'fail' : 'warn',
      detail: missingBarcodes > 0
        ? `${missingBarcodes} variant(en) zonder barcode op Shopify`
        : eanIssues > 0 ? `${eanIssues} variant(en) met afwijkende barcode` : undefined,
    })

    // shopifyVariantId stored locally
    const variantsWithoutShopifyId = localVariants.filter((v) => !v.shopifyVariantId)
    checks.push({
      category: 'Varianten',
      label: 'Shopify variant IDs opgeslagen',
      status: variantsWithoutShopifyId.length === 0 ? 'pass' : 'warn',
      detail: variantsWithoutShopifyId.length > 0
        ? `${variantsWithoutShopifyId.length} variant(en) zonder shopifyVariantId in DB`
        : undefined,
    })

    // ── Image checks ────────────────────────────────────────────────────

    const shopifyImages: any[] = shopifyProduct.images || []
    checks.push({
      category: 'Afbeeldingen',
      label: 'Afbeeldingen aanwezig',
      status: shopifyImages.length > 0 ? 'pass' : 'fail',
      actual: `${shopifyImages.length} afbeelding(en)`,
    })

    // Check if any image is assigned to variants
    const imagesWithVariants = shopifyImages.filter((img: any) => img.variant_ids && img.variant_ids.length > 0)
    checks.push({
      category: 'Afbeeldingen',
      label: 'Variant-afbeeldingen gekoppeld',
      status: imagesWithVariants.length > 0 ? 'pass' : 'warn',
      actual: `${imagesWithVariants.length} afbeelding(en) aan varianten gekoppeld`,
    })

    // Alt text
    const imagesWithAlt = shopifyImages.filter((img: any) => img.alt && img.alt.trim())
    checks.push({
      category: 'Afbeeldingen',
      label: 'Alt-tekst aanwezig',
      status: imagesWithAlt.length === shopifyImages.length ? 'pass'
        : imagesWithAlt.length > 0 ? 'warn' : 'fail',
      actual: `${imagesWithAlt.length}/${shopifyImages.length} met alt-tekst`,
    })

    // ── Metafield checks ────────────────────────────────────────────────

    const metafields: any[] = shopifyProduct.metafields || []
    // If metafields aren't included in the product response, we note it
    if (metafields.length === 0) {
      checks.push({
        category: 'Metavelden',
        label: 'Metavelden aanwezig',
        status: 'warn',
        detail: 'Metavelden niet beschikbaar in productresponse (apart ophalen nodig)',
      })
    } else {
      const expectedMetafields = [
        'custom.design_code',
        'custom.product_type',
        'custom.modelnaam',
        'custom.product_information',
        'global.title_tag',
        'global.description_tag',
      ]
      for (const key of expectedMetafields) {
        const [ns, k] = key.split('.')
        const found = metafields.find((m: any) => m.namespace === ns && m.key === k)
        checks.push({
          category: 'Metavelden',
          label: `${key}`,
          status: found ? 'pass' : 'warn',
          actual: found ? `"${String(found.value).slice(0, 50)}${String(found.value).length > 50 ? '...' : ''}"` : '(ontbreekt)',
        })
      }
    }

    // ── Content/translation checks ──────────────────────────────────────

    const nlContent = design.content.find((c) => c.language === 'nl')
    checks.push({
      category: 'Content',
      label: 'NL content aanwezig in DB',
      status: nlContent ? 'pass' : 'fail',
    })

    for (const lang of ['de', 'en', 'fr']) {
      const content = design.content.find((c) => c.language === lang)
      checks.push({
        category: 'Content',
        label: `${lang.toUpperCase()} vertaling in DB`,
        status: content && content.description ? 'pass' : 'warn',
        detail: !content ? 'Vertaling ontbreekt' : !content.description ? 'Vertaling onvolledig' : undefined,
      })
    }

    // ── Workflow step check ─────────────────────────────────────────────

    const publishStep = design.workflowSteps.find((s) => s.step === 'SHOPIFY_PUBLISH')
    checks.push({
      category: 'Workflow',
      label: 'SHOPIFY_PUBLISH stap',
      status: publishStep?.status === 'COMPLETED' ? 'pass'
        : publishStep?.status === 'FAILED' ? 'fail' : 'warn',
      actual: publishStep?.status || 'Niet gevonden',
    })

    // ── DB consistency ──────────────────────────────────────────────────

    checks.push({
      category: 'Database',
      label: 'Design status is LIVE',
      status: design.status === 'LIVE' ? 'pass' : 'warn',
      expected: 'LIVE',
      actual: design.status,
    })

    const distinctProductIds = new Set(localVariants.map((v) => v.shopifyProductId).filter(Boolean))
    checks.push({
      category: 'Database',
      label: 'Alle varianten verwijzen naar zelfde product',
      status: distinctProductIds.size <= 1 ? 'pass' : 'fail',
      detail: distinctProductIds.size > 1 ? `${distinctProductIds.size} verschillende Shopify product IDs gevonden` : undefined,
    })

    // ── Local asset checks ──────────────────────────────────────────────

    checks.push({
      category: 'Assets',
      label: 'Mockups aanwezig in DB',
      status: design.mockups.length > 0 ? 'pass' : 'warn',
      actual: `${design.mockups.length} mockup(s)`,
    })

    checks.push({
      category: 'Assets',
      label: 'Bronafbeelding (Drive)',
      status: design.driveFileId ? 'pass' : 'warn',
      actual: design.driveFileId ? 'Aanwezig' : 'Ontbreekt',
    })

    return NextResponse.json(buildResponse(designId, design.designCode, shopifyProductId, checks))
  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.json(
      { error: `Verificatie mislukt: ${error instanceof Error ? error.message : 'onbekend'}` },
      { status: 500 }
    )
  }
}

function buildResponse(
  designId: string,
  designCode: string,
  shopifyProductId: string,
  checks: VerifyCheck[]
): VerifyResponse {
  const summary = { pass: 0, warn: 0, fail: 0 }
  for (const c of checks) {
    summary[c.status]++
  }
  return {
    designId,
    designCode,
    shopifyProductId,
    checks,
    summary,
    verifiedAt: new Date().toISOString(),
  }
}
