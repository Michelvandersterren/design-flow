import { describe, it, expect } from 'vitest'
import { testPrisma } from '@/test/setup-db'
import { generateNextEan, ean13CheckDigit, isValidEan13 } from '@/lib/ean'

/**
 * Integration tests for EAN generation.
 * These run against a real (temp) SQLite database.
 */
describe('generateNextEan (integration)', () => {
  it('should generate a valid EAN-13 when DB has no variants', async () => {
    const ean = await generateNextEan()

    expect(ean).toHaveLength(13)
    expect(isValidEan13(ean)).toBe(true)
    expect(ean.startsWith('87214768')).toBe(true)

    // SEED_LAST_EAN = 8721476881246, base12 = 872147688124
    // Next base12 = 872147688125, check = 3 → 8721476881253
    expect(ean).toBe('8721476881253')
  })

  it('should increment from the highest EAN in the DB', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'EAN-TEST-1',
        designName: 'EAN Test Design',
        status: 'DRAFT',
      },
    })

    // Insert a variant with a known EAN (base12 = 872147688130)
    const base12 = '872147688130'
    const check = ean13CheckDigit(base12)
    const seedEan = base12 + check

    await testPrisma.variant.create({
      data: {
        designId: design.id,
        productType: 'IB',
        size: '520x350',
        sku: 'IB-EANTEST-520-350',
        ean: seedEan,
        price: 33.50,
      },
    })

    const nextEan = await generateNextEan()

    expect(nextEan).toHaveLength(13)
    expect(isValidEan13(nextEan)).toBe(true)

    // The base12 of the next EAN should be seedBase + 1
    const nextBase = parseInt(nextEan.slice(0, 12), 10)
    const seedBase = parseInt(base12, 10)
    expect(nextBase).toBe(seedBase + 1)
  })

  it('should generate sequential EANs across multiple calls', async () => {
    const ean1 = await generateNextEan()

    const design = await testPrisma.design.create({
      data: {
        designCode: 'EAN-SEQ-1',
        designName: 'Sequential EAN Test',
        status: 'DRAFT',
      },
    })
    await testPrisma.variant.create({
      data: {
        designId: design.id,
        productType: 'IB',
        size: '520x350',
        sku: 'IB-EANSEQ1-520-350',
        ean: ean1,
        price: 33.50,
      },
    })

    const ean2 = await generateNextEan()

    expect(ean1).not.toBe(ean2)
    expect(isValidEan13(ean1)).toBe(true)
    expect(isValidEan13(ean2)).toBe(true)

    // ean2 base (first 12 digits) should be exactly ean1 base + 1
    const base1 = parseInt(ean1.slice(0, 12), 10)
    const base2 = parseInt(ean2.slice(0, 12), 10)
    expect(base2).toBe(base1 + 1)
  })

  it('should use SEED_LAST_EAN as fallback when no EANs have ean field', async () => {
    // Insert a variant WITHOUT an EAN
    const design = await testPrisma.design.create({
      data: {
        designCode: 'EAN-NULL-1',
        designName: 'No EAN Design',
        status: 'DRAFT',
      },
    })
    await testPrisma.variant.create({
      data: {
        designId: design.id,
        productType: 'IB',
        size: '520x350',
        sku: 'IB-EANNULL-520-350',
        ean: null,
        price: 33.50,
      },
    })

    // Should still fall back to SEED_LAST_EAN since no variant has a non-null EAN
    const ean = await generateNextEan()
    expect(isValidEan13(ean)).toBe(true)

    // SEED_LAST_EAN = 8721476881246, base12 = 872147688124
    // Next base12 = 872147688125 → EAN starts with 872147688125
    expect(ean.startsWith('872147688125')).toBe(true)
  })

  it('should always produce unique valid EANs within the GS1 prefix range', async () => {
    const eans: string[] = []
    const design = await testPrisma.design.create({
      data: {
        designCode: 'EAN-RANGE-1',
        designName: 'Range Test',
        status: 'DRAFT',
      },
    })

    for (let i = 0; i < 5; i++) {
      const ean = await generateNextEan()
      eans.push(ean)
      await testPrisma.variant.create({
        data: {
          designId: design.id,
          productType: 'IB',
          size: `${520 + i}x350`,
          sku: `IB-EANRANGE-${520 + i}-350`,
          ean,
          price: 33.50,
        },
      })
    }

    for (const ean of eans) {
      expect(ean).toHaveLength(13)
      expect(ean.startsWith('87214768')).toBe(true)
      expect(isValidEan13(ean)).toBe(true)
    }

    // All should be unique
    const unique = new Set(eans)
    expect(unique.size).toBe(eans.length)

    // Bases should be sequential
    for (let i = 1; i < eans.length; i++) {
      const prevBase = parseInt(eans[i - 1].slice(0, 12), 10)
      const currBase = parseInt(eans[i].slice(0, 12), 10)
      expect(currBase).toBe(prevBase + 1)
    }
  })
})
