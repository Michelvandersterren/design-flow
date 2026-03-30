import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testPrisma } from '@/test/setup-db'
import { IB_SIZES, MC_SIZES, MC_MATERIALS, SP_SIZES, SP_MATERIALS } from '@/lib/constants'

// Mock registerGtin to avoid external API calls
vi.mock('@/lib/gs1', () => ({
  registerGtin: vi.fn().mockResolvedValue(false),
}))

// Import after mock setup
const { generateIbVariants, generateMcVariants, generateSpVariants, generateVariantsForDesign, getVariantsForDesign } =
  await import('@/lib/variants')

/**
 * Integration tests for variant generation.
 * These run against a real (temp) SQLite database with GS1 mocked out.
 */
describe('generateIbVariants (integration)', () => {
  it('should create all IB variants for a design', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'IBTEST',
        designName: 'IB Test Design',
        status: 'DRAFT',
        inductionFriendly: true,
      },
    })

    const result = await generateIbVariants(design.id, design.designCode)

    expect(result.created).toHaveLength(IB_SIZES.length)
    expect(result.skipped).toHaveLength(0)

    // Verify variants in DB
    const dbVariants = await testPrisma.variant.findMany({
      where: { designId: design.id },
      orderBy: { sku: 'asc' },
    })

    expect(dbVariants).toHaveLength(IB_SIZES.length)

    for (const v of dbVariants) {
      expect(v.productType).toBe('IB')
      expect(v.sku).toMatch(/^IB-IBTEST-\d+-\d+$/)
      expect(v.ean).toBeTruthy()
      expect(v.ean).toHaveLength(13)
      expect(v.price).toBeGreaterThan(0)
      expect(v.weight).toBeGreaterThan(0)
    }
  })

  it('should be idempotent — skip already existing SKUs', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'IBIDMP',
        designName: 'IB Idempotent Test',
        status: 'DRAFT',
      },
    })

    const first = await generateIbVariants(design.id, design.designCode)
    expect(first.created).toHaveLength(IB_SIZES.length)

    const second = await generateIbVariants(design.id, design.designCode)
    expect(second.created).toHaveLength(0)
    expect(second.skipped).toHaveLength(IB_SIZES.length)

    // Total in DB should still be the original count
    const total = await testPrisma.variant.count({ where: { designId: design.id } })
    expect(total).toBe(IB_SIZES.length)
  })

  it('should set correct prices from IB_SIZES', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'IBPRC',
        designName: 'IB Price Test',
        status: 'DRAFT',
      },
    })

    await generateIbVariants(design.id, design.designCode)

    const variants = await testPrisma.variant.findMany({
      where: { designId: design.id },
      orderBy: { sku: 'asc' },
    })

    for (const v of variants) {
      const size = IB_SIZES.find(s => v.size === `${s.width}x${s.height}`)
      expect(size).toBeDefined()
      expect(v.price).toBe(size!.price)
      expect(v.weight).toBeCloseTo(size!.weightGrams / 1000, 3)
    }
  })

  it('should generate unique EANs for all variants', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'IBEANS',
        designName: 'IB EAN Uniqueness',
        status: 'DRAFT',
      },
    })

    await generateIbVariants(design.id, design.designCode)

    const variants = await testPrisma.variant.findMany({
      where: { designId: design.id },
      select: { ean: true },
    })

    const eans = variants.map(v => v.ean).filter(Boolean) as string[]
    expect(eans).toHaveLength(IB_SIZES.length)
    expect(new Set(eans).size).toBe(eans.length)
  })
})

describe('generateMcVariants (integration)', () => {
  const expectedCount = MC_SIZES.length * MC_MATERIALS.length // 4 × 2 = 8

  it('should create all MC variants (sizes × materials)', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'MCTEST',
        designName: 'MC Test Design',
        status: 'DRAFT',
        circleFriendly: true,
      },
    })

    const result = await generateMcVariants(design.id, design.designCode)

    expect(result.created).toHaveLength(expectedCount)
    expect(result.skipped).toHaveLength(0)

    const dbVariants = await testPrisma.variant.findMany({
      where: { designId: design.id },
    })

    expect(dbVariants).toHaveLength(expectedCount)

    // Check both materials exist
    const materials = new Set(dbVariants.map(v => v.material))
    expect(materials).toEqual(new Set(['ADI', 'FRX']))

    // Check all diameters exist
    const sizes = new Set(dbVariants.map(v => v.size))
    for (const s of MC_SIZES) {
      expect(sizes.has(String(s.diameter))).toBe(true)
    }
  })

  it('should set correct prices per material', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'MCPRC',
        designName: 'MC Price Test',
        status: 'DRAFT',
      },
    })

    await generateMcVariants(design.id, design.designCode)

    const variants = await testPrisma.variant.findMany({
      where: { designId: design.id },
    })

    for (const v of variants) {
      const sizeConfig = MC_SIZES.find(s => String(s.diameter) === v.size)
      expect(sizeConfig).toBeDefined()

      if (v.material === 'ADI') {
        expect(v.price).toBe(sizeConfig!.priceAdi)
      } else {
        expect(v.price).toBe(sizeConfig!.priceFrx)
      }
    }
  })

  it('should be idempotent', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'MCIDMP',
        designName: 'MC Idempotent',
        status: 'DRAFT',
      },
    })

    await generateMcVariants(design.id, design.designCode)
    const second = await generateMcVariants(design.id, design.designCode)

    expect(second.created).toHaveLength(0)
    expect(second.skipped).toHaveLength(expectedCount)
  })
})

describe('generateSpVariants (integration)', () => {
  const expectedCount = SP_SIZES.length * SP_MATERIALS.length // 12 × 3 = 36

  it('should create all SP variants (sizes × materials)', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'SPTEST',
        designName: 'SP Test Design',
        status: 'DRAFT',
        splashFriendly: true,
      },
    })

    const result = await generateSpVariants(design.id, design.designCode)

    expect(result.created).toHaveLength(expectedCount)
    expect(result.skipped).toHaveLength(0)

    const dbVariants = await testPrisma.variant.findMany({
      where: { designId: design.id },
    })
    expect(dbVariants).toHaveLength(expectedCount)

    // Check all mounting options exist
    const materials = new Set(dbVariants.map(v => v.material))
    expect(materials).toEqual(new Set(['G', 'BH0', 'BH4']))
  })

  it('should apply correct price offsets per mounting option', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'SPPRC',
        designName: 'SP Price Test',
        status: 'DRAFT',
      },
    })

    await generateSpVariants(design.id, design.designCode)

    const variants = await testPrisma.variant.findMany({
      where: { designId: design.id },
    })

    for (const v of variants) {
      const [w, h] = v.size.split('x').map(Number)
      const sizeConfig = SP_SIZES.find(s => s.width === w && s.height === h)
      const matConfig = SP_MATERIALS.find(m => m.code === v.material)
      expect(sizeConfig).toBeDefined()
      expect(matConfig).toBeDefined()

      expect(v.price).toBe(sizeConfig!.priceG + matConfig!.priceOffset)
    }
  })

  it('should be idempotent', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'SPIDMP',
        designName: 'SP Idempotent',
        status: 'DRAFT',
      },
    })

    await generateSpVariants(design.id, design.designCode)
    const second = await generateSpVariants(design.id, design.designCode)

    expect(second.created).toHaveLength(0)
    expect(second.skipped).toHaveLength(expectedCount)
  })
})

describe('generateVariantsForDesign (integration)', () => {
  it('should generate only IB variants when only inductionFriendly', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'VFDIB',
        designName: 'VFD IB Only',
        status: 'DRAFT',
        inductionFriendly: true,
        circleFriendly: false,
        splashFriendly: false,
      },
    })

    const results = await generateVariantsForDesign(design.id)

    expect(results.IB).toBeDefined()
    expect(results.MC).toBeUndefined()
    expect(results.SP).toBeUndefined()
    expect(results.IB.created).toHaveLength(IB_SIZES.length)
  })

  it('should generate MC + SP variants when both flags are set', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'VFDMS',
        designName: 'VFD MC+SP',
        status: 'DRAFT',
        inductionFriendly: false,
        circleFriendly: true,
        splashFriendly: true,
      },
    })

    const results = await generateVariantsForDesign(design.id)

    expect(results.IB).toBeUndefined()
    expect(results.MC).toBeDefined()
    expect(results.SP).toBeDefined()

    const expectedMc = MC_SIZES.length * MC_MATERIALS.length
    const expectedSp = SP_SIZES.length * SP_MATERIALS.length
    expect(results.MC.created).toHaveLength(expectedMc)
    expect(results.SP.created).toHaveLength(expectedSp)
  })

  it('should generate all variant types when all flags are set', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'VFDALL',
        designName: 'VFD All Types',
        status: 'DRAFT',
        inductionFriendly: true,
        circleFriendly: true,
        splashFriendly: true,
      },
    })

    const results = await generateVariantsForDesign(design.id)

    expect(results.IB).toBeDefined()
    expect(results.MC).toBeDefined()
    expect(results.SP).toBeDefined()

    const totalExpected =
      IB_SIZES.length +
      MC_SIZES.length * MC_MATERIALS.length +
      SP_SIZES.length * SP_MATERIALS.length

    const totalCreated =
      results.IB.created.length +
      results.MC.created.length +
      results.SP.created.length

    expect(totalCreated).toBe(totalExpected)

    // Verify total in DB
    const dbCount = await testPrisma.variant.count({ where: { designId: design.id } })
    expect(dbCount).toBe(totalExpected)
  })

  it('should generate no variants when no flags are set', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'VFDNONE',
        designName: 'VFD No Flags',
        status: 'DRAFT',
        inductionFriendly: false,
        circleFriendly: false,
        splashFriendly: false,
      },
    })

    const results = await generateVariantsForDesign(design.id)

    expect(Object.keys(results)).toHaveLength(0)

    const dbCount = await testPrisma.variant.count({ where: { designId: design.id } })
    expect(dbCount).toBe(0)
  })

  it('should throw for non-existent design', async () => {
    await expect(generateVariantsForDesign('nonexistent-id')).rejects.toThrow(
      'Design not found'
    )
  })
})

describe('getVariantsForDesign (integration)', () => {
  it('should return variants grouped by product type', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'GVFD1',
        designName: 'Get Variants Test',
        status: 'DRAFT',
        inductionFriendly: true,
        circleFriendly: true,
      },
    })

    await generateVariantsForDesign(design.id)

    const result = await getVariantsForDesign(design.id)

    expect(result.byType.IB).toBeDefined()
    expect(result.byType.MC).toBeDefined()
    expect(result.byType.IB).toHaveLength(IB_SIZES.length)
    expect(result.byType.MC).toHaveLength(MC_SIZES.length * MC_MATERIALS.length)
    expect(result.total).toBe(IB_SIZES.length + MC_SIZES.length * MC_MATERIALS.length)
  })

  it('should return empty result for design with no variants', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'GVFD2',
        designName: 'Empty Variants',
        status: 'DRAFT',
      },
    })

    const result = await getVariantsForDesign(design.id)

    expect(result.variants).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(Object.keys(result.byType)).toHaveLength(0)
  })

  it('should sort variants by productType then size', async () => {
    const design = await testPrisma.design.create({
      data: {
        designCode: 'GVFD3',
        designName: 'Sort Test',
        status: 'DRAFT',
        inductionFriendly: true,
        circleFriendly: true,
      },
    })

    await generateVariantsForDesign(design.id)
    const result = await getVariantsForDesign(design.id)

    // IB variants should come before MC (alphabetical)
    const types = result.variants.map(v => v.productType)
    const firstMcIndex = types.indexOf('MC')
    const lastIbIndex = types.lastIndexOf('IB')
    expect(lastIbIndex).toBeLessThan(firstMcIndex)
  })
})
