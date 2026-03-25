/**
 * Mockup template configuration for KitchenArt product types.
 *
 * Each template maps a template ID to:
 *   - psdPath: absolute path to the PSD source file
 *   - sizeKey: optional — restricts template to a specific product size
 *   - outputName: base slug for the Drive filename (no extension, no spaces)
 *   - label: human-readable scene description used in SEO alt text
 *
 * Photoshop handles all placement, perspective and compositing by replacing
 * the smart object contents in the PSD. No Sharp compositing coordinates needed.
 */

export interface MockupTemplate {
  id: string          // unique identifier, e.g. "IB-mockup3"
  psdPath: string     // absolute path to the PSD
  sizeKey?: string    // only applies to this product size (e.g. "600x300")
  outputName: string  // slug used in the Drive filename — e.g. "sfeer-keuken"
  label: string       // human-readable scene label used in alt text — e.g. "sfeer keuken"
}

const BASE = '/Users/Michel/Desktop/Shopify/New Products'

// ---------------------------------------------------------------------------
// IB — Inductiebeschermer
// ---------------------------------------------------------------------------
export const IB_TEMPLATES: MockupTemplate[] = [
  { id: 'IB-mockup3',       psdPath: `${BASE}/Mockups IB/mockup-3.psd`,           outputName: 'sfeer-keuken',       label: 'sfeer keuken' },
  { id: 'IB-mockup4',       psdPath: `${BASE}/Mockups IB/mockup-4.psd`,           outputName: 'sfeer-bovenaanzicht',label: 'sfeer bovenaanzicht' },
  { id: 'IB-mockup5',       psdPath: `${BASE}/Mockups IB/mockup-5.psd`,           outputName: 'sfeer-aanrecht',     label: 'sfeer aanrecht' },
  { id: 'IB-mockup6',       psdPath: `${BASE}/Mockups IB/mockup-6.psd`,           outputName: 'sfeer-wit',          label: 'sfeer wit' },
  { id: 'IB-mockup02',      psdPath: `${BASE}/Mockups IB/mockup-02.psd`,          outputName: 'sfeer-detail',       label: 'sfeer detail' },
  { id: 'IB-mockup1-50x35', psdPath: `${BASE}/Mockups IB/mockup-1 50x35.psd`,    outputName: 'product-50x35',      label: 'product 50x35 cm', sizeKey: '500x350' },
  { id: 'IB-mockup1-52x35', psdPath: `${BASE}/Mockups IB/mockup-1 52x35.psd`,    outputName: 'product-52x35',      label: 'product 52x35 cm', sizeKey: '520x350' },
  { id: 'IB-mockup1-59x50', psdPath: `${BASE}/Mockups IB/mockup-1 59x50.psd`,    outputName: 'product-59x50',      label: 'product 59x50 cm', sizeKey: '590x500' },
  { id: 'IB-mockup1-70x52', psdPath: `${BASE}/Mockups IB/mockup-1 70x52.psd`,    outputName: 'product-70x52',      label: 'product 70x52 cm', sizeKey: '700x520' },
  { id: 'IB-mockup1-75x52', psdPath: `${BASE}/Mockups IB/mockup-1 75x52.psd`,    outputName: 'product-75x52',      label: 'product 75x52 cm', sizeKey: '750x520' },
  { id: 'IB-mockup1-80x52', psdPath: `${BASE}/Mockups IB/mockup-1 80x52.psd`,    outputName: 'product-80x52',      label: 'product 80x52 cm', sizeKey: '800x520' },
  { id: 'IB-mockup1-86x52', psdPath: `${BASE}/Mockups IB/mockup-1 86x52.psd`,    outputName: 'product-86x52',      label: 'product 86x52 cm', sizeKey: '860x520' },
  { id: 'IB-mockup1-90x52', psdPath: `${BASE}/Mockups IB/mockup-1 90x52.psd`,    outputName: 'product-90x52',      label: 'product 90x52 cm', sizeKey: '900x520' },
]

// ---------------------------------------------------------------------------
// SP — Spatscherm
// ---------------------------------------------------------------------------
export const SP_TEMPLATES: MockupTemplate[] = [
  { id: 'SP-mockup1',        psdPath: `${BASE}/Mockups SP/Mockup-1.psd`,                   outputName: 'sfeer-keuken-1',      label: 'sfeer keuken' },
  { id: 'SP-mockup2',        psdPath: `${BASE}/Mockups SP/Mockup-2.psd`,                   outputName: 'sfeer-keuken-2',      label: 'sfeer keuken donker' },
  { id: 'SP-mockup3',        psdPath: `${BASE}/Mockups SP/Mockup-3.psd`,                   outputName: 'sfeer-keuken-3',      label: 'sfeer modern' },
  { id: 'SP-mockup5',        psdPath: `${BASE}/Mockups SP/Mockup-5.psd`,                   outputName: 'sfeer-bovenaanzicht', label: 'sfeer bovenaanzicht' },
  { id: 'SP-mockup6',        psdPath: `${BASE}/Mockups SP/Mockup-6-spat-merged.psd`,       outputName: 'sfeer-breed',         label: 'sfeer breed' },
  { id: 'SP-mockup7',        psdPath: `${BASE}/Mockups SP/Mockup-7-spat-retouched 2.psd`,  outputName: 'sfeer-detail',        label: 'sfeer detail' },
  { id: 'SP-mockup4-60x30',  psdPath: `${BASE}/Mockups SP/Mockup-4 60x30.psd`,  sizeKey: '600x300',  outputName: 'product-60x30',  label: 'product 60x30 cm' },
  { id: 'SP-mockup4-60x40',  psdPath: `${BASE}/Mockups SP/Mockup-4 60x40.psd`,  sizeKey: '600x400',  outputName: 'product-60x40',  label: 'product 60x40 cm' },
  { id: 'SP-mockup4-70x30',  psdPath: `${BASE}/Mockups SP/Mockup-4 70x30.psd`,  sizeKey: '700x300',  outputName: 'product-70x30',  label: 'product 70x30 cm' },
  { id: 'SP-mockup4-70x50',  psdPath: `${BASE}/Mockups SP/Mockup-4 70x50.psd`,  sizeKey: '700x500',  outputName: 'product-70x50',  label: 'product 70x50 cm' },
  { id: 'SP-mockup4-80x40',  psdPath: `${BASE}/Mockups SP/Mockup-4 80x40.psd`,  sizeKey: '800x400',  outputName: 'product-80x40',  label: 'product 80x40 cm' },
  { id: 'SP-mockup4-80x55',  psdPath: `${BASE}/Mockups SP/Mockup-4 80x55.psd`,  sizeKey: '800x550',  outputName: 'product-80x55',  label: 'product 80x55 cm' },
  { id: 'SP-mockup4-90x45',  psdPath: `${BASE}/Mockups SP/Mockup-4 90x45.psd`,  sizeKey: '900x450',  outputName: 'product-90x45',  label: 'product 90x45 cm' },
  { id: 'SP-mockup4-90x60',  psdPath: `${BASE}/Mockups SP/Mockup-4 90x60.psd`,  sizeKey: '900x600',  outputName: 'product-90x60',  label: 'product 90x60 cm' },
  { id: 'SP-mockup4-100x50', psdPath: `${BASE}/Mockups SP/Mockup-4 100x50.psd`, sizeKey: '1000x500', outputName: 'product-100x50', label: 'product 100x50 cm' },
  { id: 'SP-mockup4-100x65', psdPath: `${BASE}/Mockups SP/Mockup-4 100x65.psd`, sizeKey: '1000x650', outputName: 'product-100x65', label: 'product 100x65 cm' },
  { id: 'SP-mockup4-120x60', psdPath: `${BASE}/Mockups SP/Mockup-4 120x60.psd`, sizeKey: '1200x600', outputName: 'product-120x60', label: 'product 120x60 cm' },
  { id: 'SP-mockup4-120x80', psdPath: `${BASE}/Mockups SP/Mockup-4 120x80.psd`, sizeKey: '1200x800', outputName: 'product-120x80', label: 'product 120x80 cm' },
]

// ---------------------------------------------------------------------------
// MC — Muurcirkel
// ---------------------------------------------------------------------------
export const MC_TEMPLATES: MockupTemplate[] = [
  { id: 'MC-lifestyle',  psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art.psd`,        outputName: 'sfeer-eetkamer',       label: 'sfeer eetkamer' },
  { id: 'MC-circleart',  psdPath: `${BASE}/Mockups MC/circleart.psd`,                      outputName: 'sfeer-woonkamer',      label: 'sfeer woonkamer' },
  { id: 'MC-mockup3',    psdPath: `${BASE}/Mockups MC/Mockup-3_100cm.psd`,                 outputName: 'sfeer-hal',            label: 'sfeer hal' },
  { id: 'MC-mockup5',    psdPath: `${BASE}/Mockups MC/Mockup-5_100cm.psd`,                 outputName: 'sfeer-slaapkamer',     label: 'sfeer slaapkamer' },
  { id: 'MC-mockup6',    psdPath: `${BASE}/Mockups MC/Mockup-6_100cm.psd`,                 outputName: 'sfeer-kantoor',        label: 'sfeer kantoor' },
  { id: 'MC-mockup7',    psdPath: `${BASE}/Mockups MC/Mockup-7_100cm.psd`,                 outputName: 'sfeer-woonkamer-2',    label: 'sfeer woonkamer licht' },
  { id: 'MC-mockup8',    psdPath: `${BASE}/Mockups MC/Mockup-8_100cm.psd`,                 outputName: 'sfeer-gang',           label: 'sfeer gang' },
  { id: 'MC-40cm',       psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_40cm.psd`,   outputName: 'product-40cm',         label: 'product 40 cm', sizeKey: '400' },
  { id: 'MC-60cm',       psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_60cm.psd`,   outputName: 'product-60cm',         label: 'product 60 cm', sizeKey: '600' },
  { id: 'MC-80cm',       psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_80cm.psd`,   outputName: 'product-80cm',         label: 'product 80 cm', sizeKey: '800' },
  { id: 'MC-100cm',      psdPath: `${BASE}/Mockups MC/Dinning_room_circle_art_100cm.psd`,  outputName: 'product-100cm',        label: 'product 100 cm', sizeKey: '1000' },
  { id: 'MC-mockup10',   psdPath: `${BASE}/Mockups MC/Mockup-10_80cm.psd`,                 outputName: 'sfeer-slaapkamer-80',  label: 'sfeer slaapkamer 80 cm', sizeKey: '800' },
]

/**
 * Returns templates for a product type, optionally including size-specific ones.
 * Without sizeKey: returns only generic (non-size-specific) templates.
 * With sizeKey: returns generic templates + the matching size-specific template(s).
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

/**
 * Find a single template by its ID across all product types.
 */
export function getTemplateById(templateId: string): MockupTemplate | undefined {
  return [...IB_TEMPLATES, ...SP_TEMPLATES, ...MC_TEMPLATES].find((t) => t.id === templateId)
}
