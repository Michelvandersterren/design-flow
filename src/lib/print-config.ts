/**
 * Print file template configuration for KitchenArt product types.
 *
 * Each template maps a sizeKey to:
 *   - psdPath: absolute path to the PSD (used as the "size reference" file for Illustrator)
 *   - sizeKey: the normalized variant size key (e.g. "520x350")
 *   - widthMM / heightMM: product dimensions in mm (parsed from PSD filename)
 *
 * The Illustrator JSX script (scripts/generate-print.jsx) receives:
 *   - The PSD path (to read dimensions from the filename, e.g. "520-350.psd")
 *   - The design image path (downloaded from Drive)
 *   - The output PDF path
 *
 * The script creates:
 *   1. A new CMYK Illustrator document at (productW + 30mm) × (productH + 30mm) [15mm bleed each side]
 *   2. Design image on "Design" layer — scaled to cover artboard, embedded
 *   3. CutContour rounded rect on "CutContour" layer — spot color 0C 100M 0Y 0K, 0.25pt stroke, overprint ON
 *   4. Exported with "Grootformaat op 100% 05-2019" preset (or PDF/X-4 fallback)
 *
 * Output filename format: ib-{designCode}-{width}-{height}.pdf
 * Example: ib-soazb-520-350.pdf
 */

export interface PrintTemplate {
  id: string        // unique identifier, e.g. "IB-print-520x350"
  psdPath: string   // absolute path to the size PSD (Illustrator uses filename for dimensions)
  sizeKey: string   // normalized variant size key, e.g. "520x350"
  widthMM: number   // product width in mm
  heightMM: number  // product height in mm
}

const PRINT_BASE = '/Users/Michel/Desktop/PSDs - Mockups & Prints/Inductie - Final/print induction protector/psd'

// ---------------------------------------------------------------------------
// IB — Inductiebeschermer print templates
// One entry per PSD file. sizeKey mirrors the PSD filename (dash → x, no extension).
// ---------------------------------------------------------------------------
export const IB_PRINT_TEMPLATES: PrintTemplate[] = [
  { id: 'IB-print-520x350',  psdPath: `${PRINT_BASE}/520-350.psd`,  sizeKey: '520x350',  widthMM: 520,  heightMM: 350 },
  { id: 'IB-print-590x520',  psdPath: `${PRINT_BASE}/590-520.psd`,  sizeKey: '590x520',  widthMM: 590,  heightMM: 520 },
  { id: 'IB-print-600x520',  psdPath: `${PRINT_BASE}/600-520.psd`,  sizeKey: '600x520',  widthMM: 600,  heightMM: 520 },
  { id: 'IB-print-620x520',  psdPath: `${PRINT_BASE}/620-520.psd`,  sizeKey: '620x520',  widthMM: 620,  heightMM: 520 },
  { id: 'IB-print-650x520',  psdPath: `${PRINT_BASE}/650-520.psd`,  sizeKey: '650x520',  widthMM: 650,  heightMM: 520 },
  { id: 'IB-print-700x520',  psdPath: `${PRINT_BASE}/700-520.psd`,  sizeKey: '700x520',  widthMM: 700,  heightMM: 520 },
  { id: 'IB-print-710x520',  psdPath: `${PRINT_BASE}/710-520.psd`,  sizeKey: '710x520',  widthMM: 710,  heightMM: 520 },
  { id: 'IB-print-760x515',  psdPath: `${PRINT_BASE}/760-515.psd`,  sizeKey: '760x515',  widthMM: 760,  heightMM: 515 },
  { id: 'IB-print-770x510',  psdPath: `${PRINT_BASE}/770-510.psd`,  sizeKey: '770x510',  widthMM: 770,  heightMM: 510 },
  { id: 'IB-print-770x520',  psdPath: `${PRINT_BASE}/770-520.psd`,  sizeKey: '770x520',  widthMM: 770,  heightMM: 520 },
  { id: 'IB-print-780x520',  psdPath: `${PRINT_BASE}/780-520.psd`,  sizeKey: '780x520',  widthMM: 780,  heightMM: 520 },
  { id: 'IB-print-800x520',  psdPath: `${PRINT_BASE}/800-520.psd`,  sizeKey: '800x520',  widthMM: 800,  heightMM: 520 },
  { id: 'IB-print-810x520',  psdPath: `${PRINT_BASE}/810-520.psd`,  sizeKey: '810x520',  widthMM: 810,  heightMM: 520 },
  { id: 'IB-print-812x527',  psdPath: `${PRINT_BASE}/812-527.psd`,  sizeKey: '812x527',  widthMM: 812,  heightMM: 527 },
  { id: 'IB-print-830x515',  psdPath: `${PRINT_BASE}/830-515.psd`,  sizeKey: '830x515',  widthMM: 830,  heightMM: 515 },
  { id: 'IB-print-860x520',  psdPath: `${PRINT_BASE}/860-520.psd`,  sizeKey: '860x520',  widthMM: 860,  heightMM: 520 },
  { id: 'IB-print-900x500',  psdPath: `${PRINT_BASE}/900-500.psd`,  sizeKey: '900x500',  widthMM: 900,  heightMM: 500 },
  { id: 'IB-print-900x520',  psdPath: `${PRINT_BASE}/900-520.psd`,  sizeKey: '900x520',  widthMM: 900,  heightMM: 520 },
  { id: 'IB-print-916x527',  psdPath: `${PRINT_BASE}/916-527.psd`,  sizeKey: '916x527',  widthMM: 916,  heightMM: 527 },
]

/**
 * Returns the print template for a given sizeKey, or undefined if not found.
 */
export function getPrintTemplateForSize(
  productType: 'IB' | 'SP' | 'MC',
  sizeKey: string
): PrintTemplate | undefined {
  if (productType === 'IB') {
    return IB_PRINT_TEMPLATES.find((t) => t.sizeKey === sizeKey)
  }
  // SP and MC not implemented yet
  return undefined
}

/**
 * Returns all print templates for a product type.
 */
export function getAllPrintTemplates(productType: 'IB' | 'SP' | 'MC'): PrintTemplate[] {
  if (productType === 'IB') return IB_PRINT_TEMPLATES
  return []
}

/**
 * Builds the output PDF filename.
 * Format: ib-{designCode}-{width}-{height}.pdf  (all lowercase)
 * Example: ib-soazb-520-350.pdf
 */
export function buildPrintFileName(
  productType: 'IB' | 'SP' | 'MC',
  designCode: string,
  widthMM: number,
  heightMM: number
): string {
  const prefix = productType.toLowerCase()
  const code = designCode.toLowerCase()
  return `${prefix}-${code}-${widthMM}-${heightMM}.pdf`
}
