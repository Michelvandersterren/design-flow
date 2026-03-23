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
 * Generate the next EAN-13 by finding the current max in the DB and incrementing.
 * Uses KitchenArt's GS1 prefix (8721476).
 */
export async function generateNextEan(): Promise<string> {
  const result = await prisma.variant.findFirst({
    where: { ean: { not: null } },
    orderBy: { ean: 'desc' },
    select: { ean: true },
  })

  // Base: max existing + 1, or start at 8721476881240 if no EANs exist
  const maxEan = result?.ean ? parseInt(result.ean, 10) : 8721476881239
  const nextBase12 = String(maxEan + 1).slice(0, 12)

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
