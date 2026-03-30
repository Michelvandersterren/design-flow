import { describe, it, expect } from 'vitest'
import {
  IB_SIZES,
  MC_SIZES,
  MC_MATERIALS,
  SP_SIZES,
  SP_MATERIALS,
  PRODUCT_SKU_PREFIX,
  SUPPORTED_LANGUAGES,
  DESIGN_STATUS,
  WORKFLOW_STEP,
} from '@/lib/constants'

describe('constants', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('should include nl, de, en, fr', () => {
      expect(SUPPORTED_LANGUAGES).toContain('nl')
      expect(SUPPORTED_LANGUAGES).toContain('de')
      expect(SUPPORTED_LANGUAGES).toContain('en')
      expect(SUPPORTED_LANGUAGES).toContain('fr')
    })

    it('should have exactly 4 languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(4)
    })
  })

  describe('PRODUCT_SKU_PREFIX', () => {
    it('should map product types to 2-letter prefixes', () => {
      expect(PRODUCT_SKU_PREFIX.INDUCTION).toBe('IB')
      expect(PRODUCT_SKU_PREFIX.CIRCLE).toBe('MC')
      expect(PRODUCT_SKU_PREFIX.SPLASH).toBe('SP')
    })
  })

  describe('DESIGN_STATUS', () => {
    it('should define all expected workflow statuses', () => {
      const statuses = Object.values(DESIGN_STATUS)
      expect(statuses).toContain('DRAFT')
      expect(statuses).toContain('CONTENT_GENERATING')
      expect(statuses).toContain('REVIEW')
      expect(statuses).toContain('APPROVED')
      expect(statuses).toContain('PUBLISHING')
      expect(statuses).toContain('LIVE')
      expect(statuses).toContain('ARCHIVED')
    })
  })

  describe('WORKFLOW_STEP', () => {
    it('should include SHOPIFY_PUBLISH step', () => {
      expect(WORKFLOW_STEP.SHOPIFY_PUBLISH).toBe('SHOPIFY_PUBLISH')
    })

    it('should include CONTENT_GENERATION step', () => {
      expect(WORKFLOW_STEP.CONTENT_GENERATION).toBe('CONTENT_GENERATION')
    })
  })

  describe('IB_SIZES', () => {
    it('should have 19 sizes', () => {
      expect(IB_SIZES).toHaveLength(19)
    })

    it('should have valid dimensions for all sizes', () => {
      for (const size of IB_SIZES) {
        expect(size.width).toBeGreaterThan(0)
        expect(size.height).toBeGreaterThan(0)
        expect(size.price).toBeGreaterThan(0)
        expect(size.weightGrams).toBeGreaterThan(0)
      }
    })

    it('should have labels matching dimensions', () => {
      for (const size of IB_SIZES) {
        expect(size.label).toContain('cm')
      }
    })

    it('should have compareAt prices >= selling prices', () => {
      for (const size of IB_SIZES) {
        expect(size.compareAt).toBeGreaterThanOrEqual(size.price)
      }
    })

    it('should have unique width-height combinations', () => {
      const combos = IB_SIZES.map((s) => `${s.width}x${s.height}`)
      const unique = new Set(combos)
      expect(unique.size).toBe(combos.length)
    })
  })

  describe('MC_SIZES', () => {
    it('should have 4 diameter options', () => {
      expect(MC_SIZES).toHaveLength(4)
    })

    it('should have diameters 400, 600, 800, 1000', () => {
      const diameters = MC_SIZES.map((s) => s.diameter)
      expect(diameters).toEqual([400, 600, 800, 1000])
    })

    it('should have ADI prices > FRX prices for each size', () => {
      for (const size of MC_SIZES) {
        expect(size.priceAdi).toBeGreaterThan(size.priceFrx)
      }
    })

    it('should have compareAt prices >= selling prices', () => {
      for (const size of MC_SIZES) {
        expect(size.compareAtAdi).toBeGreaterThanOrEqual(size.priceAdi)
        expect(size.compareAtFrx).toBeGreaterThanOrEqual(size.priceFrx)
      }
    })
  })

  describe('MC_MATERIALS', () => {
    it('should have 2 materials: ADI and FRX', () => {
      expect(MC_MATERIALS).toHaveLength(2)
      expect(MC_MATERIALS.map((m) => m.code)).toEqual(['ADI', 'FRX'])
    })
  })

  describe('SP_SIZES', () => {
    it('should have 12 sizes', () => {
      expect(SP_SIZES).toHaveLength(12)
    })

    it('should have valid dimensions and prices', () => {
      for (const size of SP_SIZES) {
        expect(size.width).toBeGreaterThan(0)
        expect(size.height).toBeGreaterThan(0)
        expect(size.priceG).toBeGreaterThan(0)
        expect(size.weightGrams).toBeGreaterThan(0)
      }
    })

    it('should have unique width-height combinations', () => {
      const combos = SP_SIZES.map((s) => `${s.width}x${s.height}`)
      const unique = new Set(combos)
      expect(unique.size).toBe(combos.length)
    })
  })

  describe('SP_MATERIALS', () => {
    it('should have 3 mounting options', () => {
      expect(SP_MATERIALS).toHaveLength(3)
    })

    it('should have codes G, BH0, BH4', () => {
      expect(SP_MATERIALS.map((m) => m.code)).toEqual(['G', 'BH0', 'BH4'])
    })

    it('should have correct price offsets', () => {
      const g = SP_MATERIALS.find((m) => m.code === 'G')!
      const bh0 = SP_MATERIALS.find((m) => m.code === 'BH0')!
      const bh4 = SP_MATERIALS.find((m) => m.code === 'BH4')!

      expect(g.priceOffset).toBe(0)
      expect(bh0.priceOffset).toBe(5)
      expect(bh4.priceOffset).toBe(15)
    })
  })

  describe('variant counts', () => {
    it('IB should produce 19 variants per design', () => {
      expect(IB_SIZES.length).toBe(19)
    })

    it('MC should produce 8 variants per design (4 sizes x 2 materials)', () => {
      expect(MC_SIZES.length * MC_MATERIALS.length).toBe(8)
    })

    it('SP should produce 36 variants per design (12 sizes x 3 materials)', () => {
      expect(SP_SIZES.length * SP_MATERIALS.length).toBe(36)
    })
  })
})
