import { prisma } from './prisma'
import { IB_SIZES, MC_SIZES, PRODUCT_SKU_PREFIX } from './constants'

/**
 * Generate the SKU for an IB variant.
 * Format: IB-{DESIGNCODE}-{WIDTH}-{HEIGHT}
 * Example: IB-TAUPM-520-350
 */
export function buildIbSku(designCode: string, width: number, height: number): string {
  return `${PRODUCT_SKU_PREFIX.INDUCTION}-${designCode}-${width}-${height}`
}

/**
 * Generate the SKU for an MC variant.
 * Format: MC-{DESIGNCODE}-{DIAMETER}
 * Example: MC-TAUPM-600
 */
export function buildMcSku(designCode: string, diameter: number): string {
  return `${PRODUCT_SKU_PREFIX.CIRCLE}-${designCode}-${diameter}`
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
        price: size.price,
        weight: size.weightGrams / 1000, // store in kg
      },
    })
    created.push(variant)
  }

  return { created, skipped }
}

/**
 * Generate all MC variants for a design and persist them to the DB.
 * Skips diameters that already have a variant (idempotent).
 */
export async function generateMcVariants(designId: string, designCode: string) {
  const created = []
  const skipped = []

  for (const size of MC_SIZES) {
    const sku = buildMcSku(designCode, size.diameter)

    const existing = await prisma.variant.findUnique({ where: { sku } })
    if (existing) {
      skipped.push(sku)
      continue
    }

    const variant = await prisma.variant.create({
      data: {
        designId,
        productType: 'MC',
        size: `${size.diameter}`,
        sku,
        price: size.price,
        weight: size.weightGrams / 1000,
      },
    })
    created.push(variant)
  }

  return { created, skipped }
}

/**
 * Generate variants for a design based on its product type flags.
 * inductionFriendly → IB variants
 * circleFriendly    → MC variants
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
