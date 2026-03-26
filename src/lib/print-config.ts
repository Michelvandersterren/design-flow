/**
 * Print file template configuration for KitchenArt product types.
 *
 * Each template maps a sizeKey to the product dimensions.
 * PDFs worden gegenereerd via src/lib/print.ts (Node.js / pdf-lib).
 *
 * Spec (conform Probo .joboptions preset + Probo reference PDFs):
 *   - Bleed: 10mm per kant
 *   - Pagina = MediaBox = BleedBox = TrimBox = (productW + 20mm) × (productH + 20mm)
 *   - CutContour: spot color "Cutcontour", 0C 100M 0Y 0K, 0.25pt stroke, overprint ON
 *
 * Output filename format:
 *   IB/SP: {prefix}-{designCode}-{width}-{height}.pdf  e.g. ib-soazb-520-350.pdf
 *   MC:    mc-{designCode}-{diameter}.pdf              e.g. mc-soazb-400.pdf
 *
 * SP: één PDF per unieke maat (materiaalvarianten G/BH0/BH4 delen hetzelfde printbestand)
 * MC: sizeKey = diameter als string (bijv. "400"), widthMM = heightMM = diameter
 */

export interface PrintTemplate {
  id: string        // unique identifier, e.g. "IB-print-520x350"
  psdPath: string   // absolute path to the size PSD (Illustrator uses filename for dimensions)
  sizeKey: string   // normalized variant size key, e.g. "520x350" (IB/SP) or "400" (MC)
  widthMM: number   // product width in mm (= diameter for MC)
  heightMM: number  // product height in mm (= diameter for MC)
}

const IB_PRINT_BASE = '/Users/Michel/Desktop/PSDs - Mockups & Prints/Inductie - Final/print induction protector/psd'

// ---------------------------------------------------------------------------
// IB — Inductiebeschermer print templates
// One entry per PSD file. sizeKey mirrors the PSD filename (dash → x, no extension).
// ---------------------------------------------------------------------------
export const IB_PRINT_TEMPLATES: PrintTemplate[] = [
  { id: 'IB-print-520x350',  psdPath: `${IB_PRINT_BASE}/520-350.psd`,  sizeKey: '520x350',  widthMM: 520,  heightMM: 350 },
  { id: 'IB-print-590x520',  psdPath: `${IB_PRINT_BASE}/590-520.psd`,  sizeKey: '590x520',  widthMM: 590,  heightMM: 520 },
  { id: 'IB-print-600x520',  psdPath: `${IB_PRINT_BASE}/600-520.psd`,  sizeKey: '600x520',  widthMM: 600,  heightMM: 520 },
  { id: 'IB-print-620x520',  psdPath: `${IB_PRINT_BASE}/620-520.psd`,  sizeKey: '620x520',  widthMM: 620,  heightMM: 520 },
  { id: 'IB-print-650x520',  psdPath: `${IB_PRINT_BASE}/650-520.psd`,  sizeKey: '650x520',  widthMM: 650,  heightMM: 520 },
  { id: 'IB-print-700x520',  psdPath: `${IB_PRINT_BASE}/700-520.psd`,  sizeKey: '700x520',  widthMM: 700,  heightMM: 520 },
  { id: 'IB-print-710x520',  psdPath: `${IB_PRINT_BASE}/710-520.psd`,  sizeKey: '710x520',  widthMM: 710,  heightMM: 520 },
  { id: 'IB-print-760x515',  psdPath: `${IB_PRINT_BASE}/760-515.psd`,  sizeKey: '760x515',  widthMM: 760,  heightMM: 515 },
  { id: 'IB-print-770x510',  psdPath: `${IB_PRINT_BASE}/770-510.psd`,  sizeKey: '770x510',  widthMM: 770,  heightMM: 510 },
  { id: 'IB-print-770x520',  psdPath: `${IB_PRINT_BASE}/770-520.psd`,  sizeKey: '770x520',  widthMM: 770,  heightMM: 520 },
  { id: 'IB-print-780x520',  psdPath: `${IB_PRINT_BASE}/780-520.psd`,  sizeKey: '780x520',  widthMM: 780,  heightMM: 520 },
  { id: 'IB-print-800x520',  psdPath: `${IB_PRINT_BASE}/800-520.psd`,  sizeKey: '800x520',  widthMM: 800,  heightMM: 520 },
  { id: 'IB-print-810x520',  psdPath: `${IB_PRINT_BASE}/810-520.psd`,  sizeKey: '810x520',  widthMM: 810,  heightMM: 520 },
  { id: 'IB-print-812x527',  psdPath: `${IB_PRINT_BASE}/812-527.psd`,  sizeKey: '812x527',  widthMM: 812,  heightMM: 527 },
  { id: 'IB-print-830x515',  psdPath: `${IB_PRINT_BASE}/830-515.psd`,  sizeKey: '830x515',  widthMM: 830,  heightMM: 515 },
  { id: 'IB-print-860x520',  psdPath: `${IB_PRINT_BASE}/860-520.psd`,  sizeKey: '860x520',  widthMM: 860,  heightMM: 520 },
  { id: 'IB-print-900x500',  psdPath: `${IB_PRINT_BASE}/900-500.psd`,  sizeKey: '900x500',  widthMM: 900,  heightMM: 500 },
  { id: 'IB-print-900x520',  psdPath: `${IB_PRINT_BASE}/900-520.psd`,  sizeKey: '900x520',  widthMM: 900,  heightMM: 520 },
  { id: 'IB-print-916x527',  psdPath: `${IB_PRINT_BASE}/916-527.psd`,  sizeKey: '916x527',  widthMM: 916,  heightMM: 527 },
]

// ---------------------------------------------------------------------------
// SP — Spatscherm print templates
// Één PDF per unieke maat. sizeKey = "{width}x{height}".
// Materiaalvarianten (G/BH0/BH4) delen hetzelfde printbestand.
// CutContour zelfde spec als IB: afgeronde rechthoek, 10mm bleed, spot "Cutcontour".
// ---------------------------------------------------------------------------
export const SP_PRINT_TEMPLATES: PrintTemplate[] = [
  { id: 'SP-print-600x300',   psdPath: '', sizeKey: '600x300',   widthMM: 600,  heightMM: 300  },
  { id: 'SP-print-600x400',   psdPath: '', sizeKey: '600x400',   widthMM: 600,  heightMM: 400  },
  { id: 'SP-print-700x300',   psdPath: '', sizeKey: '700x300',   widthMM: 700,  heightMM: 300  },
  { id: 'SP-print-700x500',   psdPath: '', sizeKey: '700x500',   widthMM: 700,  heightMM: 500  },
  { id: 'SP-print-800x400',   psdPath: '', sizeKey: '800x400',   widthMM: 800,  heightMM: 400  },
  { id: 'SP-print-800x550',   psdPath: '', sizeKey: '800x550',   widthMM: 800,  heightMM: 550  },
  { id: 'SP-print-900x450',   psdPath: '', sizeKey: '900x450',   widthMM: 900,  heightMM: 450  },
  { id: 'SP-print-900x600',   psdPath: '', sizeKey: '900x600',   widthMM: 900,  heightMM: 600  },
  { id: 'SP-print-1000x500',  psdPath: '', sizeKey: '1000x500',  widthMM: 1000, heightMM: 500  },
  { id: 'SP-print-1000x650',  psdPath: '', sizeKey: '1000x650',  widthMM: 1000, heightMM: 650  },
  { id: 'SP-print-1200x600',  psdPath: '', sizeKey: '1200x600',  widthMM: 1200, heightMM: 600  },
  { id: 'SP-print-1200x800',  psdPath: '', sizeKey: '1200x800',  widthMM: 1200, heightMM: 800  },
]

// ---------------------------------------------------------------------------
// MC — Muurcirkel print templates
// sizeKey = diameter als string, e.g. "400". widthMM = heightMM = diameter.
// CutContour zelfde spec als IB (afgeronde rechthoek, niet cirkel).
// ---------------------------------------------------------------------------
export const MC_PRINT_TEMPLATES: PrintTemplate[] = [
  { id: 'MC-print-400',  psdPath: '', sizeKey: '400',  widthMM: 400,  heightMM: 400  },
  { id: 'MC-print-600',  psdPath: '', sizeKey: '600',  widthMM: 600,  heightMM: 600  },
  { id: 'MC-print-800',  psdPath: '', sizeKey: '800',  widthMM: 800,  heightMM: 800  },
  { id: 'MC-print-1000', psdPath: '', sizeKey: '1000', widthMM: 1000, heightMM: 1000 },
]

/**
 * Returns the print template for a given sizeKey, or undefined if not found.
 *
 * SP note: variant sizeKeys may contain material suffix (e.g. "600x300-G").
 * We strip everything after the first "-" that isn't part of the WxH format.
 */
export function getPrintTemplateForSize(
  productType: 'IB' | 'SP' | 'MC',
  sizeKey: string
): PrintTemplate | undefined {
  if (productType === 'IB') {
    return IB_PRINT_TEMPLATES.find((t) => t.sizeKey === sizeKey)
  }
  if (productType === 'SP') {
    // SP variant sizeKeys: "{width}x{height}" (material is stored separately)
    return SP_PRINT_TEMPLATES.find((t) => t.sizeKey === sizeKey)
  }
  if (productType === 'MC') {
    // MC variant sizeKeys: "{diameter}" (just the number as string, e.g. "600")
    return MC_PRINT_TEMPLATES.find((t) => t.sizeKey === sizeKey)
  }
  return undefined
}

/**
 * Returns all print templates for a product type.
 */
export function getAllPrintTemplates(productType: 'IB' | 'SP' | 'MC'): PrintTemplate[] {
  if (productType === 'IB') return IB_PRINT_TEMPLATES
  if (productType === 'SP') return SP_PRINT_TEMPLATES
  if (productType === 'MC') return MC_PRINT_TEMPLATES
  return []
}

/**
 * Builds the output PDF filename.
 * IB/SP: {prefix}-{designCode}-{width}-{height}.pdf  e.g. ib-soazb-520-350.pdf
 * MC:    mc-{designCode}-{diameter}.pdf              e.g. mc-soazb-400.pdf
 */
export function buildPrintFileName(
  productType: 'IB' | 'SP' | 'MC',
  designCode: string,
  widthMM: number,
  heightMM: number
): string {
  const prefix = productType.toLowerCase()
  const code = designCode.toLowerCase()
  if (productType === 'MC') {
    // widthMM === heightMM === diameter for MC
    return `${prefix}-${code}-${widthMM}.pdf`
  }
  return `${prefix}-${code}-${widthMM}-${heightMM}.pdf`
}
