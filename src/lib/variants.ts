import { prisma } from './prisma'
import { IB_SIZES, MC_SIZES, MC_MATERIALS, SP_SIZES, SP_MATERIALS, PRODUCT_SKU_PREFIX } from './constants'
import { generateNextEan } from './ean'
import { registerGtin } from './gs1'

/**
 * Helper: attempt GS1 registration and update the DB flag.
 * Always non-fatal — logs a warning on failure.
 */
async function tryRegisterGtin(variantId: string, ean: string, description: string, productType?: string) {
  try {
    const registered = await registerGtin({ gtin: ean, description, brandName: 'KitchenArt', productType })
    if (registered) {
      await prisma.variant.update({ where: { id: variantId }, data: { gs1Registered: true } })
    }
  } catch (err) {
    console.warn(`[GS1] registration failed for EAN ${ean}:`, err)
  }
}

/**
 * Strip the product-type suffix (-IB, -SP, -MC) from forked designCodes.
 * Forked designs have codes like FRMHRF-MC or FRMHRF-SP, but the SKU
 * already has the product type as prefix (e.g. MC-FRMHRF-400-ADI-1),
 * so we must use only the base code.
 */
function stripProductTypeSuffix(designCode: string): string {
  return designCode.replace(/-(IB|SP|MC)$/i, '')
}

/**
 * Generate the SKU for an IB variant.
 * Format: IB-{BASECODE}-{WIDTH}-{HEIGHT}
 * Example: IB-TAUPM-520-350
 */
export function buildIbSku(designCode: string, width: number, height: number): string {
  return `${PRODUCT_SKU_PREFIX.INDUCTION}-${stripProductTypeSuffix(designCode)}-${width}-${height}`
}

/**
 * Generate the SKU for an MC variant.
 * Format: MC-{BASECODE}-{DIAMETER}-{MATERIAL}-{SUFFIX}
 * Example: MC-TAUPM-600-ADI-1
 */
export function buildMcSku(designCode: string, diameter: number, materialCode: string, suffix: number): string {
  return `${PRODUCT_SKU_PREFIX.CIRCLE}-${stripProductTypeSuffix(designCode)}-${diameter}-${materialCode}-${suffix}`
}

/**
 * Generate the SKU for an SP variant.
 * Format: SP-{BASECODE}-{WIDTH}-{HEIGHT}-{MATERIAL}
 * Example: SP-ARCGL-600-300-G
 */
export function buildSpSku(designCode: string, width: number, height: number, material: string): string {
  return `${PRODUCT_SKU_PREFIX.SPLASH}-${stripProductTypeSuffix(designCode)}-${width}-${height}-${material}`
}

/**
 * Generate all SP variants for a design and persist them to the DB.
 * 12 sizes × 3 materials = 36 variants per design.
 * Skips SKUs that already exist (idempotent).
 */
export async function generateSpVariants(designId: string, designCode: string) {
  const created = []
  const skipped = []

  for (const size of SP_SIZES) {
    for (const mat of SP_MATERIALS) {
      const sku = buildSpSku(designCode, size.width, size.height, mat.code)

      const existing = await prisma.variant.findUnique({ where: { sku } })
      if (existing) {
        skipped.push(sku)
        continue
      }

      const price = size.priceG + mat.priceOffset

      const variant = await prisma.variant.create({
        data: {
          designId,
          productType: 'SP',
          size: `${size.width}x${size.height}`,
          material: mat.code,
          sku,
          ean: await generateNextEan(),
          price,
          weight: size.weightGrams / 1000, // store in kg
        },
      })

      if (variant.ean) {
        await tryRegisterGtin(variant.id, variant.ean, `Spatscherm ${size.width}x${size.height}mm ${mat.code}`, 'SP')
      }

      created.push(variant)
    }
  }

  return { created, skipped }
}

/**
 * Generate all IB variants for a design and persist them to the DB.
 * Skips sizes that already have a variant (idempotent).
 * Returns the created variants.
 */
export async function generateIbVariants(designId: string, designCode: string) {
  const created = []
  const skipped = []

  for (const size of IB_SIZES) {
    const sku = buildIbSku(designCode, size.width, size.height)

    const existing = await prisma.variant.findUnique({ where: { sku } })
    if (existing) {
      skipped.push(sku)
      continue
    }

    const variant = await prisma.variant.create({
      data: {
        designId,
        productType: 'IB',
        size: `${size.width}x${size.height}`,
        sku,
        ean: await generateNextEan(),
        price: size.price,
        weight: size.weightGrams / 1000, // store in kg
      },
    })

    if (variant.ean) {
      await tryRegisterGtin(variant.id, variant.ean, `Inductieplaat ${size.width}x${size.height}mm`, 'IB')
    }

    created.push(variant)
  }

  return { created, skipped }
}

/**
 * Generate all MC variants for a design and persist them to the DB.
 * 4 diameters × 2 materials = 8 variants per design.
 * Skips SKUs that already exist (idempotent).
 */
export async function generateMcVariants(designId: string, designCode: string) {
  const created = []
  const skipped = []

  for (const size of MC_SIZES) {
    for (const mat of MC_MATERIALS) {
      const sku = buildMcSku(designCode, size.diameter, mat.code, size.suffix)

      const existing = await prisma.variant.findUnique({ where: { sku } })
      if (existing) {
        skipped.push(sku)
        continue
      }

      const price = mat.code === 'ADI' ? size.priceAdi : size.priceFrx

      const variant = await prisma.variant.create({
        data: {
          designId,
          productType: 'MC',
          size: `${size.diameter}`,
          material: mat.code,
          sku,
          ean: await generateNextEan(),
          price,
          weight: size.weightGrams / 1000,
        },
      })

      if (variant.ean) {
        await tryRegisterGtin(variant.id, variant.ean, `Muurcirkel ${size.diameter}mm ${mat.label}`, 'MC')
      }

      created.push(variant)
    }
  }

  return { created, skipped }
}

/**
 * Generate variants for a design based on its product type flags.
 * inductionFriendly → IB variants
 * circleFriendly    → MC variants
 * splashFriendly    → SP variants
 */
export async function generateVariantsForDesign(designId: string) {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { variants: true },
  })

  if (!design) throw new Error(`Design not found: ${designId}`)

  const results: Record<string, { created: unknown[]; skipped: string[] }> = {}

  if (design.inductionFriendly) {
    results.IB = await generateIbVariants(designId, design.designCode)
  }

  if (design.circleFriendly) {
    results.MC = await generateMcVariants(designId, design.designCode)
  }

  if (design.splashFriendly) {
    results.SP = await generateSpVariants(designId, design.designCode)
  }

  return results
}

/**
 * List all variants for a design with summary counts.
 */
export async function getVariantsForDesign(designId: string) {
  const variants = await prisma.variant.findMany({
    where: { designId },
    orderBy: [{ productType: 'asc' }, { size: 'asc' }],
  })

  const byType: Record<string, typeof variants> = {}
  for (const v of variants) {
    if (!byType[v.productType]) byType[v.productType] = []
    byType[v.productType].push(v)
  }

  return { variants, byType, total: variants.length }
}
