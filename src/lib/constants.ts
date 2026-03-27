export const DESIGN_STATUS = {
  DRAFT: 'DRAFT',
  CONTENT_GENERATING: 'CONTENT_GENERATING',
  REVIEW: 'REVIEW',
  APPROVED: 'APPROVED',
  PUBLISHING: 'PUBLISHING',
  LIVE: 'LIVE',
  ARCHIVED: 'ARCHIVED',
} as const

export const PRODUCT_TYPE = {
  INDUCTION: 'INDUCTION',
  CIRCLE: 'CIRCLE',
  SPLASH: 'SPLASH',
} as const

export const WORKFLOW_STEP = {
  DESIGN_UPLOAD: 'DESIGN_UPLOAD',
  CONTENT_GENERATION: 'CONTENT_GENERATION',
  AI_REVIEW: 'AI_REVIEW',
  TRANSLATION: 'TRANSLATION',
  MOCKUP_GENERATION: 'MOCKUP_GENERATION',
  PRINTFILE_GENERATION: 'PRINTFILE_GENERATION',
  NOTION_SYNC: 'NOTION_SYNC',
  EAN_GENERATION: 'EAN_GENERATION',
  SHOPIFY_PUBLISH: 'SHOPIFY_PUBLISH',
  FINAL_REVIEW: 'FINAL_REVIEW',
} as const

export const STEP_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const

export const TRANSLATION_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const

export const SUPPORTED_LANGUAGES = ['nl', 'de', 'en', 'fr'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export const PRODUCT_SKU_PREFIX = {
  INDUCTION: 'IB',
  CIRCLE: 'MC',
  SPLASH: 'SP',
} as const

// Standard IB (Inductiebeschermer) sizes in mm: { width, height, price (EUR), weightGrams, label }
export const IB_SIZES = [
  { width: 520,  height: 350, price: 33.50, weightGrams: 200, label: '52 × 35 cm' },
  { width: 590,  height: 520, price: 33.50, weightGrams: 300, label: '59 × 52 cm' },
  { width: 600,  height: 520, price: 33.50, weightGrams: 300, label: '60 × 52 cm' },
  { width: 620,  height: 520, price: 33.50, weightGrams: 300, label: '62 × 52 cm' },
  { width: 650,  height: 520, price: 34.50, weightGrams: 300, label: '65 × 52 cm' },
  { width: 700,  height: 520, price: 34.50, weightGrams: 400, label: '70 × 52 cm' },
  { width: 710,  height: 520, price: 34.50, weightGrams: 400, label: '71 × 52 cm' },
  { width: 760,  height: 515, price: 35.50, weightGrams: 400, label: '76 × 51.5 cm' },
  { width: 770,  height: 510, price: 35.50, weightGrams: 400, label: '77 × 51 cm' },
  { width: 770,  height: 520, price: 35.50, weightGrams: 400, label: '77 × 52 cm' },
  { width: 780,  height: 520, price: 35.50, weightGrams: 400, label: '78 × 52 cm' },
  { width: 800,  height: 520, price: 36.50, weightGrams: 400, label: '80 × 52 cm' },
  { width: 810,  height: 520, price: 36.50, weightGrams: 400, label: '81 × 52 cm' },
  { width: 812,  height: 527, price: 36.50, weightGrams: 400, label: '81.2 × 52.7 cm' },
  { width: 830,  height: 515, price: 36.50, weightGrams: 500, label: '83 × 51.5 cm' },
  { width: 860,  height: 520, price: 37.50, weightGrams: 500, label: '86 × 52 cm' },
  { width: 900,  height: 500, price: 37.50, weightGrams: 500, label: '90 × 50 cm' },
  { width: 900,  height: 520, price: 37.50, weightGrams: 500, label: '90 × 52 cm' },
  { width: 916,  height: 527, price: 37.50, weightGrams: 500, label: '91.6 × 52.7 cm' },
] as const

// MC (Muurcirkel) materials. code = SKU segment, label = Shopify option value.
export const MC_MATERIALS = [
  { code: 'ADI', label: 'Aluminium Dibond' },
  { code: 'FRX', label: 'Forex' },
] as const

// Standard MC (Muurcirkel) diameters in mm.
// priceAdi / priceFrx = selling price per material.
// suffix = SKU trailing number (1 for small, 2 for large).
export const MC_SIZES = [
  { diameter: 400,  priceAdi: 39.50, priceFrx: 29.50, weightGrams: 200, suffix: 1, label: 'ø 40 cm' },
  { diameter: 600,  priceAdi: 54.50, priceFrx: 44.50, weightGrams: 350, suffix: 1, label: 'ø 60 cm' },
  { diameter: 800,  priceAdi: 79.50, priceFrx: 59.50, weightGrams: 600, suffix: 2, label: 'ø 80 cm' },
  { diameter: 1000, priceAdi: 120.00, priceFrx: 94.50, weightGrams: 900, suffix: 2, label: 'ø 100 cm' },
] as const

// SP (Spatscherm) materials. priceOffset is added on top of the base (G) price.
export const SP_MATERIALS = [
  { code: 'G',   label: 'Glas',              priceOffset: 0  },
  { code: 'BH0', label: 'Brushed',           priceOffset: 5  },
  { code: 'BH4', label: 'Brushed + 4mm',     priceOffset: 15 },
] as const

// SP sizes. price = base price for Glas (G). BH0 = price+5, BH4 = price+15.
export const SP_SIZES = [
  { width: 600,  height: 300,  priceG:  47.50, weightGrams: 680,  label: '60 × 30 cm' },
  { width: 600,  height: 400,  priceG:  52.50, weightGrams: 800,  label: '60 × 40 cm' },
  { width: 700,  height: 300,  priceG:  49.50, weightGrams: 800,  label: '70 × 30 cm' },
  { width: 700,  height: 500,  priceG:  62.50, weightGrams: 1300, label: '70 × 50 cm' },
  { width: 800,  height: 400,  priceG:  59.50, weightGrams: 1200, label: '80 × 40 cm' },
  { width: 800,  height: 550,  priceG:  72.50, weightGrams: 1700, label: '80 × 55 cm' },
  { width: 900,  height: 450,  priceG:  67.50, weightGrams: 1600, label: '90 × 45 cm' },
  { width: 900,  height: 600,  priceG:  84.50, weightGrams: 2000, label: '90 × 60 cm' },
  { width: 1000, height: 500,  priceG:  79.50, weightGrams: 2000, label: '100 × 50 cm' },
  { width: 1000, height: 650,  priceG:  99.50, weightGrams: 2500, label: '100 × 65 cm' },
  { width: 1200, height: 600,  priceG: 114.50, weightGrams: 2800, label: '120 × 60 cm' },
  { width: 1200, height: 800,  priceG: 154.50, weightGrams: 3700, label: '120 × 80 cm' },
] as const
