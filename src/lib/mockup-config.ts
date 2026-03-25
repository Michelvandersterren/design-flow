/**
 * Mockup template configuration for KitchenArt product types.
 *
 * Each template maps a template ID to:
 *   - psdPath: absolute path to the PSD source file
 *   - sizeKey: optional — restricts template to a specific product size
 *   - outputName: base filename for the generated mockup (no extension)
 *
 * Photoshop handles all placement, perspective and compositing by replacing
 * the smart object contents in the PSD. No Sharp compositing coordinates needed.
 */

export interface MockupTemplate {
  id: string          // unique identifier, e.g. "IB-mockup3"
  psdPath: string     // absolute path to the PSD
  sizeKey?: string    // only applies to this product size (e.g. "600x300")
  outputName: string  // base name for output file (no extension)
}

const BASE = '/Users/Michel/Desktop/Shopify/New Products'

// ---------------------------------------------------------------------------
// IB — Inductiebeschermer
// ---------------------------------------------------------------------------
export const IB_TEMPLATES: MockupTemplate[] = [
  { id: 'IB-mockup3',      psdPath: `${BASE}/Mockups IB/mockup-3.psd`,       outputName: 'mockup-3'  },
  { id: 'IB-mockup4',      psdPath: `${BASE}/Mockups IB/mockup-4.psd`,       outputName: 'mockup-4'  },
  { id: 'IB-mockup5',      psdPath: `${BASE}/Mockups IB/mockup-5.psd`,       outputName: 'mockup-5'  },
  { id: 'IB-mockup6',      psdPath: `${BASE}/Mockups IB/mockup-6.psd`,       outputName: 'mockup-6'  },
  { id: 'IB-mockup02',     psdPath: `${BASE}/Mockups IB/mockup-02.psd`,      outputName: 'mockup-02' },
  { id: 'IB-mockup1-50x35', psdPath: `${BASE}/Mockups IB/mockup-1 50x35.psd`, sizeKey: '500x350', outputName: 'mockup-1' },
  { id: 'IB-mockup1-52x35', psdPath: `${BASE}/Mockups IB/mockup-1 52x35.psd`, sizeKey: '520x350', outputName: 'mockup-1' },
  { id: 'IB-mockup1-59x50', psdPath: `${BASE}/Mockups IB/mockup-1 59x50.psd`, sizeKey: '590x500', outputName: 'mockup-1' },
  { id: 'IB-mockup1-70x52', psdPath: `${BASE}/Mockups IB/mockup-1 70x52.psd`, sizeKey: '700x520', outputName: 'mockup-1' },
  { id: 'IB-mockup1-75x52', psdPath: `${BASE}/Mockups IB/mockup-1 75x52.psd`, sizeKey: '750x520', outputName: 'mockup-1' },
  { id: 'IB-mockup1-80x52', psdPath: `${BASE}/Mockups IB/mockup-1 80x52.psd`, sizeKey: '800x520', outputName: 'mockup-1' },
  { id: 'IB-mockup1-86x52', psdPath: `${BASE}/Mockups IB/mockup-1 86x52.psd`, sizeKey: '860x520', outputName: 'mockup-1' },
  { id: 'IB-mockup1-90x52', psdPath: `${BASE}/Mockups IB/mockup-1 90x52.psd`, sizeKey: '900x520', outputName: 'mockup-1' },
]

// ---------------------------------------------------------------------------
// SP — Spatscherm
// ---------------------------------------------------------------------------
export const SP_TEMPLATES: MockupTemplate[] = [
  { id: 'SP-mockup1', psdPath: `${BASE}/Mockups SP/Mockup-1.psd`,                    outputName: 'mockup-1' },
  { id: 'SP-mockup2', psdPath: `${BASE}/Mockups SP/Mockup-2.psd`,                    outputName: 'mockup-2' },
  { id: 'SP-mockup3', psdPath: `${BASE}/Mockups SP/Mockup-3.psd`,                    outputName: 'mockup-3' },
  { id: 'SP-mockup5', psdPath: `${BASE}/Mockups SP/Mockup-5.psd`,                    outputName: 'mockup-5' },
  { id: 'SP-mockup6', psdPath: `${BASE}/Mockups SP/Mockup-6-spat-merged.psd`,        outputName: 'mockup-6' },
  { id: 'SP-mockup7', psdPath: `${BASE}/Mockups SP/Mockup-7-spat-retouched 2.psd`,   outputName: 'mockup-7' },
  { id: 'SP-mockup4-60x30',  psdPath: `${BASE}/Mockups SP/Mockup-4 60x30.psd`,   sizeKey: '600x300',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-60x40',  psdPath: `${BASE}/Mockups SP/Mockup-4 60x40.psd`,   sizeKey: '600x400',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-70x30',  psdPath: `${BASE}/Mockups SP/Mockup-4 70x30.psd`,   sizeKey: '700x300',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-70x50',  psdPath: `${BASE}/Mockups SP/Mockup-4 70x50.psd`,   sizeKey: '700x500',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-80x40',  psdPath: `${BASE}/Mockups SP/Mockup-4 80x40.psd`,   sizeKey: '800x400',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-80x55',  psdPath: `${BASE}/Mockups SP/Mockup-4 80x55.psd`,   sizeKey: '800x550',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-90x45',  psdPath: `${BASE}/Mockups SP/Mockup-4 90x45.psd`,   sizeKey: '900x450',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-90x60',  psdPath: `${BASE}/Mockups SP/Mockup-4 90x60.psd`,   sizeKey: '900x600',  outputName: 'mockup-4' },
  { id: 'SP-mockup4-100x50', psdPath: `${BASE}/Mockups SP/Mockup-4 100x50.psd`,  sizeKey: '1000x500', outputName: 'mockup-4' },
  { id: 'SP-mockup4-100x65', psdPath: `${BASE}/Mockups SP/Mockup-4 100x65.psd`,  sizeKey: '1000x650', outputName: 'mockup-4' },
  { id: 'SP-mockup4-120x60', psdPath: `${BASE}/Mockups SP/Mockup-4 120x60.psd`,  sizeKey: '1200x600', outputName: 'mockup-4' },
  { id: 'SP-mockup4-120x80', psdPath: `${BASE}/Mockups SP/Mockup-4 120x80.psd`,  sizeKey: '1200x800', outputName: 'mockup-4' },
]

// ---------------------------------------------------------------------------
// MC — Muurcirkel
// ---------------------------------------------------------------------------
export const MC_TEMPLATES: MockupTemplate[] = [
  { id: 'MC-lifestyle',  psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art.psd`,      outputName: 'mockup-lifestyle'  },
  { id: 'MC-circleart',  psdPath: `${BASE}/Mockups MC/circleart.psd`,                    outputName: 'mockup-circleart'  },
  { id: 'MC-40cm',       psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_40cm.psd`, sizeKey: '400',  outputName: 'mockup-product' },
  { id: 'MC-60cm',       psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_60cm.psd`, sizeKey: '600',  outputName: 'mockup-product' },
  { id: 'MC-80cm',       psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_80cm.psd`, sizeKey: '800',  outputName: 'mockup-product' },
  { id: 'MC-100cm',      psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_100cm.psd`,sizeKey: '1000', outputName: 'mockup-product' },
  { id: 'MC-mockup3',    psdPath: `${BASE}/Mockups MC/Mockup-3_100cm.psd`,               outputName: 'mockup-3'  },
  { id: 'MC-mockup5',    psdPath: `${BASE}/Mockups MC/Mockup-5_100cm.psd`,               outputName: 'mockup-5'  },
  { id: 'MC-mockup6',    psdPath: `${BASE}/Mockups MC/Mockup-6_100cm.psd`,               outputName: 'mockup-6'  },
  { id: 'MC-mockup7',    psdPath: `${BASE}/Mockups MC/Mockup-7_100cm.psd`,               outputName: 'mockup-7'  },
  { id: 'MC-mockup8',    psdPath: `${BASE}/Mockups MC/Mockup-8_100cm.psd`,               outputName: 'mockup-8'  },
  { id: 'MC-mockup10',   psdPath: `${BASE}/Mockups MC/Mockup-10_80cm.psd`,  sizeKey: '800', outputName: 'mockup-10' },
]

/**
 * Returns templates for a product type, optionally including size-specific ones.
 * Without sizeKey: returns only generic (non-size-specific) templates.
 * With sizeKey: returns generic templates + the matching size-specific template.
 * With sizeKey='all': returns ALL templates (generic + all size-specific).
 */
export function getTemplatesForProduct(
  productType: 'IB' | 'SP' | 'MC',
  sizeKey?: string
): MockupTemplate[] {
  const all = productType === 'IB' ? IB_TEMPLATES
    : productType === 'SP' ? SP_TEMPLATES
    : MC_TEMPLATES

  if (sizeKey === 'all') {
    return all
  }

  if (sizeKey) {
    const specific = all.filter((t) => t.sizeKey === sizeKey)
    const generic = all.filter((t) => !t.sizeKey)
    return [...generic, ...specific]
  }

  return all.filter((t) => !t.sizeKey)
}

/**
 * Returns only the size-specific templates for a product type.
 * Useful for generating all size-specific mockups in one pass.
 */
export function getSizeSpecificTemplates(productType: 'IB' | 'SP' | 'MC'): MockupTemplate[] {
  const all = productType === 'IB' ? IB_TEMPLATES
    : productType === 'SP' ? SP_TEMPLATES
    : MC_TEMPLATES
  return all.filter((t) => !!t.sizeKey)
}
