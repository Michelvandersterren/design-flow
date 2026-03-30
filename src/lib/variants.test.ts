import { describe, it, expect } from 'vitest'
import { buildIbSku, buildMcSku, buildSpSku } from '@/lib/variants'

describe('SKU builders', () => {
  describe('buildIbSku', () => {
    it('should build correct IB SKU', () => {
      expect(buildIbSku('TAUPM', 520, 350)).toBe('IB-TAUPM-520-350')
    })

    it('should strip -IB suffix from forked design codes', () => {
      expect(buildIbSku('TAUPM-IB', 520, 350)).toBe('IB-TAUPM-520-350')
    })

    it('should strip -MC suffix from forked design codes', () => {
      expect(buildIbSku('FRMHRF-MC', 700, 520)).toBe('IB-FRMHRF-700-520')
    })

    it('should strip -SP suffix from forked design codes', () => {
      expect(buildIbSku('ARCGL-SP', 900, 500)).toBe('IB-ARCGL-900-500')
    })

    it('should not strip suffix if it is not a product type', () => {
      expect(buildIbSku('DESIGN-XY', 520, 350)).toBe('IB-DESIGN-XY-520-350')
    })

    it('should handle different sizes', () => {
      expect(buildIbSku('TEST', 812, 527)).toBe('IB-TEST-812-527')
      expect(buildIbSku('TEST', 916, 527)).toBe('IB-TEST-916-527')
    })
  })

  describe('buildMcSku', () => {
    it('should build correct MC SKU with material and suffix', () => {
      expect(buildMcSku('TAUPM', 600, 'ADI', 1)).toBe('MC-TAUPM-600-ADI-1')
    })

    it('should handle FRX material', () => {
      expect(buildMcSku('TAUPM', 800, 'FRX', 2)).toBe('MC-TAUPM-800-FRX-2')
    })

    it('should strip forked design code suffixes', () => {
      expect(buildMcSku('FRMHRF-MC', 400, 'ADI', 1)).toBe('MC-FRMHRF-400-ADI-1')
    })

    it('should handle 1000mm diameter', () => {
      expect(buildMcSku('TEST', 1000, 'ADI', 2)).toBe('MC-TEST-1000-ADI-2')
    })
  })

  describe('buildSpSku', () => {
    it('should build correct SP SKU', () => {
      expect(buildSpSku('ARCGL', 600, 300, 'G')).toBe('SP-ARCGL-600-300-G')
    })

    it('should handle BH0 mounting', () => {
      expect(buildSpSku('ARCGL', 800, 400, 'BH0')).toBe('SP-ARCGL-800-400-BH0')
    })

    it('should handle BH4 mounting', () => {
      expect(buildSpSku('ARCGL', 1200, 800, 'BH4')).toBe('SP-ARCGL-1200-800-BH4')
    })

    it('should strip forked design code suffixes', () => {
      expect(buildSpSku('FRMHRF-SP', 600, 300, 'G')).toBe('SP-FRMHRF-600-300-G')
      expect(buildSpSku('FRMHRF-IB', 600, 300, 'G')).toBe('SP-FRMHRF-600-300-G')
    })
  })

  describe('SKU format consistency', () => {
    it('all SKUs should start with their product type prefix', () => {
      expect(buildIbSku('X', 100, 100)).toMatch(/^IB-/)
      expect(buildMcSku('X', 100, 'ADI', 1)).toMatch(/^MC-/)
      expect(buildSpSku('X', 100, 100, 'G')).toMatch(/^SP-/)
    })

    it('all SKUs should contain only uppercase letters, digits and hyphens', () => {
      const skus = [
        buildIbSku('TAUPM', 520, 350),
        buildMcSku('TAUPM', 600, 'ADI', 1),
        buildSpSku('ARCGL', 600, 300, 'G'),
      ]

      for (const sku of skus) {
        expect(sku).toMatch(/^[A-Z0-9-]+$/)
      }
    })
  })
})
