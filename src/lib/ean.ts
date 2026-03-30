import { prisma } from './prisma'

/**
 * Calculate EAN-13 check digit.
 * The first 12 digits are multiplied alternately by 1 and 3, summed,
 * and the check digit is (10 - (sum % 10)) % 10.
 */
export function ean13CheckDigit(digits12: string): number {
  if (digits12.length !== 12) throw new Error('Need exactly 12 digits')
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10)
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Validate an EAN-13 barcode.
 */
export function isValidEan13(ean: string): boolean {
  if (!/^\d{13}$/.test(ean)) return false
  const check = ean13CheckDigit(ean.slice(0, 12))
  return check === parseInt(ean[12], 10)
}

/**
 * KitchenArt GS1 configuration.
 *
 * Prefix:       87214768 (8 digits)
 * Contract:     10074745
 * Package:      10,000 codes (87214768 0000-9999 + check digit)
 * In use:       8,125 codes (8721476800001 - 8721476881246)
 * Available:    1,875 codes
 */
const GS1_PREFIX = '87214768'

// Last EAN assigned in GS1 export (8720796241433-products.xlsx, sheet 10074745)
const SEED_LAST_EAN = 8721476881246

/**
 * Generate the next EAN-13 by finding the current max in the DB and incrementing.
 * Falls back to SEED_LAST_EAN (last known assigned code from GS1 export) when
 * the DB has no EANs yet, ensuring we never reuse an existing code.
 *
 * Throws if the next product number would exceed the 10,000 code range.
 */
export async function generateNextEan(): Promise<string> {
  const result = await prisma.variant.findFirst({
    where: { ean: { not: null } },
    orderBy: { ean: 'desc' },
    select: { ean: true },
  })

  const maxEan = result?.ean ? parseInt(result.ean, 10) : SEED_LAST_EAN
  const nextBase12 = String(maxEan + 1).slice(0, 12)

  // Safety check: ensure we stay within the GS1 prefix range
  if (!nextBase12.startsWith(GS1_PREFIX)) {
    throw new Error(
      `EAN range exhausted: next base ${nextBase12} is outside prefix ${GS1_PREFIX}. ` +
      `Contact GS1 NL to extend your code package.`
    )
  }

  const checkDigit = ean13CheckDigit(nextBase12)
  return nextBase12 + checkDigit
}

/**
 * Assign EANs to all variants that currently have none.
 * Returns number of variants updated.
 */
export async function assignMissingEans(): Promise<{ updated: number; skipped: number }> {
  const variants = await prisma.variant.findMany({
    where: { ean: null },
    select: { id: true, sku: true },
    orderBy: { sku: 'asc' },
  })

  let updated = 0
  for (const v of variants) {
    const ean = await generateNextEan()
    await prisma.variant.update({ where: { id: v.id }, data: { ean } })
    updated++
  }

  return { updated, skipped: 0 }
}
