import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SUPPORTED_LANGUAGES } from '@/lib/constants'

/**
 * GET /api/health
 *
 * Returns all designs with their health issues.
 * Each design gets an array of issue codes describing what's missing or broken.
 *
 * Query params:
 *   issue   — filter to only designs that have this specific issue
 *   status  — filter by design status (e.g. LIVE, APPROVED)
 *   search  — search by designName or designCode
 *   page    — pagination page (default 1)
 *   limit   — results per page (default 50, max 100)
 */

export type IssueCode =
  | 'NO_NL_CONTENT'
  | 'INCOMPLETE_NL_CONTENT'
  | 'NO_DE_TRANSLATION'
  | 'NO_EN_TRANSLATION'
  | 'NO_FR_TRANSLATION'
  | 'NO_VARIANTS'
  | 'MISSING_EAN'
  | 'NO_MOCKUPS'
  | 'NO_PRINT_FILES'
  | 'NO_SHOPIFY_PRODUCT'
  | 'FAILED_WORKFLOW_STEP'
  | 'NO_DRIVE_IMAGE'

const ISSUE_LABELS: Record<IssueCode, string> = {
  NO_NL_CONTENT: 'Geen NL content',
  INCOMPLETE_NL_CONTENT: 'Onvolledige NL content',
  NO_DE_TRANSLATION: 'Geen DE vertaling',
  NO_EN_TRANSLATION: 'Geen EN vertaling',
  NO_FR_TRANSLATION: 'Geen FR vertaling',
  NO_VARIANTS: 'Geen varianten',
  MISSING_EAN: 'Ontbrekende EAN codes',
  NO_MOCKUPS: 'Geen mockups',
  NO_PRINT_FILES: 'Geen printbestanden',
  NO_SHOPIFY_PRODUCT: 'Niet op Shopify',
  FAILED_WORKFLOW_STEP: 'Gefaalde workflow stap',
  NO_DRIVE_IMAGE: 'Geen bronafbeelding',
}

export interface DesignHealth {
  id: string
  designCode: string
  designName: string
  designType: string | null
  status: string
  collections: string | null
  issues: IssueCode[]
  variantCount: number
  contentLanguages: string[]
  mockupCount: number
  printFileCount: number
  hasShopifyProduct: boolean
  failedSteps: string[]
}

export interface HealthResponse {
  designs: DesignHealth[]
  total: number
  page: number
  limit: number
  pages: number
  summary: Record<IssueCode, number>
  issueLabels: Record<IssueCode, string>
  totalWithIssues: number
  totalHealthy: number
  totalExcluded: number
  includeAll: boolean
}

// Required NL content fields
const NL_REQUIRED_FIELDS = [
  'description',
  'seoTitle',
  'seoDescription',
] as const

function detectIssues(design: any): { issues: IssueCode[]; failedSteps: string[] } {
  const issues: IssueCode[] = []
  const failedSteps: string[] = []

  // Check drive image
  if (!design.driveFileId) {
    issues.push('NO_DRIVE_IMAGE')
  }

  // Check NL content
  const nlContent = design.content.find((c: any) => c.language === 'nl')
  if (!nlContent) {
    issues.push('NO_NL_CONTENT')
  } else {
    const incomplete = NL_REQUIRED_FIELDS.some(
      (f) => !nlContent[f] || (nlContent[f] as string).trim() === ''
    )
    if (incomplete) {
      issues.push('INCOMPLETE_NL_CONTENT')
    }
  }

  // Check translations (only if NL content exists)
  if (nlContent) {
    const langs = design.content.map((c: any) => c.language)
    if (!langs.includes('de')) issues.push('NO_DE_TRANSLATION')
    if (!langs.includes('en')) issues.push('NO_EN_TRANSLATION')
    if (!langs.includes('fr')) issues.push('NO_FR_TRANSLATION')
  }

  // Check variants
  if (design.variants.length === 0) {
    issues.push('NO_VARIANTS')
  } else {
    // Check EAN codes
    const missingEan = design.variants.some((v: any) => !v.ean)
    if (missingEan) {
      issues.push('MISSING_EAN')
    }

    // Check Shopify product (any variant should have a shopifyProductId)
    const hasShopify = design.variants.some((v: any) => v.shopifyProductId)
    if (!hasShopify) {
      issues.push('NO_SHOPIFY_PRODUCT')
    }
  }

  // Check mockups
  if (design.mockups.length === 0) {
    issues.push('NO_MOCKUPS')
  }

  // Check print files
  if (design.printFiles.length === 0) {
    issues.push('NO_PRINT_FILES')
  }

  // Check workflow steps
  const failed = design.workflowSteps.filter((s: any) => s.status === 'FAILED')
  if (failed.length > 0) {
    issues.push('FAILED_WORKFLOW_STEP')
    failedSteps.push(...failed.map((s: any) => s.step))
  }

  return { issues, failedSteps }
}

/**
 * A design is relevant for the health check if it has been touched by our
 * pipeline (has driveFileId, content, or variants) OR is in an active
 * workflow status. LIVE designs with no pipeline data are legacy imports
 * that already exist on Shopify outside of our workflow.
 */
function isRelevantForHealthCheck(design: any): boolean {
  const activeStatuses = ['DRAFT', 'REVIEW', 'APPROVED', 'CONTENT_GENERATING', 'PUBLISHING', 'FAILED']
  if (activeStatuses.includes(design.status)) return true
  if (design.driveFileId) return true
  if (design.content.length > 0) return true
  if (design.variants.length > 0) return true
  return false
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const issueFilter = searchParams.get('issue') as IssueCode | null
    const statusFilter = searchParams.get('status')
    const search = searchParams.get('search')
    const includeAll = searchParams.get('includeAll') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    // Build where clause
    const where: any = {}
    if (statusFilter) where.status = statusFilter
    if (search) {
      where.OR = [
        { designName: { contains: search } },
        { designCode: { contains: search } },
      ]
    }

    // Fetch all designs with related data
    const allDesigns = await prisma.design.findMany({
      where,
      orderBy: { designCode: 'asc' },
      include: {
        content: true,
        variants: true,
        mockups: true,
        printFiles: true,
        workflowSteps: true,
      },
    })

    // Split into relevant designs (pipeline-touched) and excluded (legacy LIVE imports)
    const relevantDesigns = allDesigns.filter(isRelevantForHealthCheck)
    const totalExcluded = allDesigns.length - relevantDesigns.length

    // Use relevant designs for health checks, unless includeAll is set
    const designsToCheck = includeAll ? allDesigns : relevantDesigns

    // Compute issues for checked designs
    const allHealthDesigns: DesignHealth[] = designsToCheck.map((d) => {
      const { issues, failedSteps } = detectIssues(d)
      return {
        id: d.id,
        designCode: d.designCode,
        designName: d.designName,
        designType: d.designType,
        status: d.status,
        collections: d.collections,
        issues,
        variantCount: d.variants.length,
        contentLanguages: d.content.map((c) => c.language),
        mockupCount: d.mockups.length,
        printFileCount: d.printFiles.length,
        hasShopifyProduct: d.variants.some((v) => !!v.shopifyProductId),
        failedSteps,
      }
    })

    // Build summary counts (before filtering by issue)
    const summary: Record<string, number> = {}
    for (const code of Object.keys(ISSUE_LABELS)) {
      summary[code] = 0
    }
    let totalWithIssues = 0
    for (const dh of allHealthDesigns) {
      if (dh.issues.length > 0) totalWithIssues++
      for (const issue of dh.issues) {
        summary[issue] = (summary[issue] || 0) + 1
      }
    }

    // Filter by specific issue if requested
    const filtered = issueFilter
      ? allHealthDesigns.filter((d) => d.issues.includes(issueFilter))
      : allHealthDesigns.filter((d) => d.issues.length > 0)

    // Paginate
    const total = filtered.length
    const pages = Math.ceil(total / limit)
    const paged = filtered.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      designs: paged,
      total,
      page,
      limit,
      pages,
      summary: summary as Record<IssueCode, number>,
      issueLabels: ISSUE_LABELS,
      totalWithIssues,
      totalHealthy: designsToCheck.length - totalWithIssues,
      totalExcluded,
      includeAll,
    } satisfies HealthResponse)
  } catch (error) {
    console.error('Error in health check:', error)
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
