import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn } from 'child_process'
import { prisma } from './prisma'
import { getFileAsBase64, uploadPrintFileToDrive } from './drive'
import { getPrintTemplateForSize, getAllPrintTemplates, buildPrintFileName } from './print-config'
import type { PrintTemplate } from './print-config'

const JSX_SCRIPT   = path.join(process.cwd(), 'scripts', 'generate-print.jsx')
const CONFIG_PATH  = '/tmp/print-job.json'
const RESULT_PATH  = '/tmp/print-job-result.json'
const OUT_DIR      = path.join(os.tmpdir(), 'print-out')

// How long to wait for Illustrator to finish one PDF (ms)
// Illustrator is slower than Photoshop on large documents — allow 8 minutes
const AI_TIMEOUT_MS   = 8 * 60 * 1000
const POLL_INTERVAL_MS = 2_000

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

/**
 * Generate a single print PDF via Adobe Illustrator (osascript).
 *
 * The JSX script reads /tmp/print-job.json and writes the result to
 * /tmp/print-job-result.json when done. We poll for that file.
 */
async function generatePrintViaIllustrator(
  designImageBuffer: Buffer,
  template: PrintTemplate,
  designCode: string
): Promise<string> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  // Write design image to a temp JPEG file.
  // Illustrator accepts JPEG, PNG, TIFF, PDF — JPEG is the most reliable.
  const designTempPath = path.join(os.tmpdir(), `print-design-${designCode}.jpg`)
  fs.writeFileSync(designTempPath, designImageBuffer)

  const outFileName = buildPrintFileName('IB', designCode, template.widthMM, template.heightMM)
  const outPath     = path.join(OUT_DIR, outFileName)

  // Write job config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    psdPath:    template.psdPath,   // only used for dimension reference — filename is source of truth
    designPath: designTempPath,
    outPath,
    widthMM:    template.widthMM,
    heightMM:   template.heightMM,
  }))

  // Remove stale result file
  if (fs.existsSync(RESULT_PATH)) fs.unlinkSync(RESULT_PATH)

  // Fire osascript detached — Illustrator will run the JSX and write result when done
  const jsxEscaped = JSX_SCRIPT.replace(/"/g, '\\"')
  const child = spawn(
    'osascript',
    ['-e', `tell application "Adobe Illustrator" to do javascript file "${jsxEscaped}"`],
    { detached: true, stdio: 'ignore' }
  )
  child.unref()

  // Poll for result file
  const deadline = Date.now() + AI_TIMEOUT_MS
  await new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      if (fs.existsSync(RESULT_PATH)) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() > deadline) {
        clearInterval(interval)
        reject(new Error(`Illustrator timeout na ${AI_TIMEOUT_MS / 1000}s — geen resultaat ontvangen`))
      }
    }, POLL_INTERVAL_MS)
  })

  const result = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf-8'))

  // Clean up temp design file
  try { fs.unlinkSync(designTempPath) } catch (_) {}

  if (!result.success) {
    throw new Error(`Illustrator fout: ${result.error}`)
  }

  return outPath
}

/**
 * Generate and save a single print PDF for one size variant.
 */
async function generateAndSaveSinglePrintFile(
  designId: string,
  designCode: string,
  productType: 'IB' | 'SP' | 'MC',
  designBuffer: Buffer,
  template: PrintTemplate
): Promise<PrintFileResult> {
  try {
    const outPath = await generatePrintViaIllustrator(designBuffer, template, designCode)

    const pdfBuffer  = fs.readFileSync(outPath)
    const fileName   = buildPrintFileName(productType, designCode, template.widthMM, template.heightMM)

    const uploaded = await uploadPrintFileToDrive(
      pdfBuffer,
      fileName,
      designCode
    )

    try { fs.unlinkSync(outPath) } catch (_) {}

    // Upsert in DB — one row per design+sizeKey
    await prisma.designPrintFile.deleteMany({
      where: { designId, sizeKey: template.sizeKey },
    })
    await prisma.designPrintFile.create({
      data: {
        designId,
        productType,
        sizeKey:     template.sizeKey,
        widthMM:     template.widthMM,
        heightMM:    template.heightMM,
        fileName,
        driveFileId: uploaded.fileId,
        driveUrl:    uploaded.webViewLink,
      },
    })

    return {
      sizeKey:     template.sizeKey,
      widthMM:     template.widthMM,
      heightMM:    template.heightMM,
      driveFileId: uploaded.fileId,
      driveUrl:    uploaded.webViewLink,
      fileName,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      sizeKey:     template.sizeKey,
      widthMM:     template.widthMM,
      heightMM:    template.heightMM,
      driveFileId: '',
      driveUrl:    '',
      fileName:    buildPrintFileName(productType, designCode, template.widthMM, template.heightMM),
      skipped:     true,
      skipReason:  `Fout bij genereren: ${msg}`,
    }
  }
}

/**
 * Generate print PDFs for all size variants of a design.
 * Only generates for sizes that have a matching PSD template.
 */
export async function generateAllPrintFilesForDesign(designId: string): Promise<PrintFileResult[]> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { variants: true },
  })

  if (!design) throw new Error(`Design niet gevonden: ${designId}`)
  if (!design.driveFileId) throw new Error('Geen Drive-bestand gekoppeld aan dit design')

  const productType = (design.variants[0]?.productType ?? design.designType) as 'IB' | 'SP' | 'MC' | undefined
  if (!productType) throw new Error('Geen producttype gevonden — genereer eerst varianten')
  if (productType !== 'IB') {
    return [{
      sizeKey: '', widthMM: 0, heightMM: 0,
      driveFileId: '', driveUrl: '', fileName: '',
      skipped: true,
      skipReason: `Printbestanden nog niet ondersteund voor ${productType}`,
    }]
  }

  // Collect unique variant sizeKeys
  const variantSizeKeys = [...new Set(
    design.variants.map((v) => v.size.replace(/\s*mm\s*/i, '').replace(/\s+/g, ''))
  )]

  // Match each variant sizeKey to a print template (exact match only)
  const jobs: PrintTemplate[] = []
  for (const sizeKey of variantSizeKeys) {
    const tmpl = getPrintTemplateForSize('IB', sizeKey)
    if (tmpl) {
      jobs.push(tmpl)
    }
  }

  if (jobs.length === 0) {
    return [{
      sizeKey: '', widthMM: 0, heightMM: 0,
      driveFileId: '', driveUrl: '', fileName: '',
      skipped: true,
      skipReason: 'Geen print templates gevonden voor de varianten van dit design',
    }]
  }

  // Download design image once (original quality — not resized, Illustrator needs full res)
  const designBuffer = await getDesignImageBuffer(design.driveFileId)

  const results: PrintFileResult[] = []
  for (const template of jobs) {
    const result = await generateAndSaveSinglePrintFile(
      designId, design.designCode, productType, designBuffer, template
    )
    results.push(result)
  }

  // Mark workflow step
  const successCount = results.filter((r) => !r.skipped).length
  if (successCount > 0) {
    await prisma.workflowStep.upsert({
      where: { designId_step: { designId, step: 'PRINT_GENERATION' } },
      create: {
        designId,
        step: 'PRINT_GENERATION',
        status: 'COMPLETED',
        completedAt: new Date(),
        data: JSON.stringify({ printFiles: successCount }),
      },
      update: {
        status: 'COMPLETED',
        completedAt: new Date(),
        data: JSON.stringify({ printFiles: successCount }),
      },
    })
  }

  return results
}

/**
 * Regenerate a single print file for a specific sizeKey.
 */
export async function regenerateSinglePrintFile(
  designId: string,
  sizeKey: string
): Promise<PrintFileResult> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { variants: { take: 1 } },
  })

  if (!design) throw new Error(`Design niet gevonden: ${designId}`)
  if (!design.driveFileId) throw new Error('Geen Drive-bestand gekoppeld aan dit design')

  const productType = (design.variants[0]?.productType ?? design.designType) as 'IB' | 'SP' | 'MC' | undefined
  if (!productType) throw new Error('Geen producttype gevonden')

  const template = getPrintTemplateForSize('IB', sizeKey)
  if (!template) throw new Error(`Geen print template gevonden voor sizeKey: ${sizeKey}`)

  const designBuffer = await getDesignImageBuffer(design.driveFileId)

  return generateAndSaveSinglePrintFile(
    designId, design.designCode, productType, designBuffer, template
  )
}

/**
 * Delete all print file records for a design from the DB.
 */
export async function deleteAllPrintFilesForDesign(designId: string): Promise<number> {
  const { count } = await prisma.designPrintFile.deleteMany({ where: { designId } })
  return count
}

/**
 * Download design image from Drive at full resolution (no resize).
 * Used for print generation where Illustrator needs the full resolution image.
 */
async function getDesignImageBuffer(driveFileId: string): Promise<Buffer> {
  const { google } = await import('googleapis')
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = await import('./env')

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.get(
    { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data as ArrayBuffer)
}
