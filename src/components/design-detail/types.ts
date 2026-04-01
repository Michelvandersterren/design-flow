export interface DesignMockup {
  id: string
  templateId: string
  outputName: string
  productType: string
  sizeKey?: string | null
  driveFileId: string
  driveUrl: string
  altText: string | null
  createdAt: string
}

export interface Content {
  id: string
  language: string
  description: string | null
  longDescription: string | null
  seoTitle: string | null
  seoDescription: string | null
  googleShoppingDescription: string | null
  translationStatus: string
}

export interface Variant {
  id: string
  productType: string
  size: string
  material: string | null
  sku: string
  ean: string | null
  price: number | null
  weight: number | null
  shopifyProductId: string | null
  shopifyVariantId: string | null
}

export interface WorkflowStep {
  id: string
  step: string
  status: string
  completedAt: string | null
}

export interface Design {
  id: string
  designCode: string
  designName: string
  designType: string | null
  styleFamily: string | null
  collections: string | null
  colorTags: string | null
  status: string
  inductionFriendly: boolean
  circleFriendly: boolean
  splashFriendly: boolean
  notionId: string | null
  driveFileId: string | null
  driveFileName: string | null
  variants: Variant[]
  content: Content[]
  workflowSteps: WorkflowStep[]
  mockups: DesignMockup[]
}

export interface MockupGenerateResult {
  templateId: string
  outputName: string
  label?: string
  sizeKey?: string
  language?: string
  driveFileId: string
  driveUrl: string
  skipped?: boolean
  skipReason?: string
}

export interface DesignPrintFile {
  id: string
  productType: string
  sizeKey: string
  widthMM: number
  heightMM: number
  fileName: string
  driveFileId: string
  driveUrl: string
  createdAt: string
}

export interface PrintFileResult {
  sizeKey: string
  widthMM: number
  heightMM: number
  driveFileId: string
  driveUrl: string
  fileName: string
  skipped?: boolean
  skipReason?: string
}

export interface VerifyResult {
  checks: {
    category: string
    label: string
    status: 'pass' | 'warn' | 'fail'
    expected?: string
    actual?: string
    detail?: string
  }[]
  summary: { pass: number; warn: number; fail: number }
  verifiedAt: string
}

export interface MockupStatus {
  readyCount: number
  totalCount: number
  templates: { id: string; file: string; ready: boolean }[]
}

export type TabId = 'overview' | 'mockups' | 'printfiles' | 'content' | 'variants'

export type ContentEditFields = {
  description: string
  longDescription: string
  seoTitle: string
  seoDescription: string
  googleShoppingDescription: string
}
