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

// Standard MC (Muurcirkel) diameters in mm
export const MC_SIZES = [
  { diameter: 400,  price: 19.95, weightGrams: 200, label: '40 cm' },
  { diameter: 600,  price: 24.95, weightGrams: 350, label: '60 cm' },
  { diameter: 800,  price: 34.95, weightGrams: 600, label: '80 cm' },
  { diameter: 1000, price: 44.95, weightGrams: 900, label: '100 cm' },
] as const
