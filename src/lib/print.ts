import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn } from 'child_process'
import { prisma } from './prisma'
import { uploadPrintFileToDrive } from './drive'
import { getPrintTemplateForSize, buildPrintFileName } from './print-config'
import type { PrintTemplate } from './print-config'

const JSX_SCRIPT        = path.join(process.cwd(), 'scripts', 'generate-print.jsx')
const BATCH_CONFIG_PATH = '/tmp/print-batch-job.json'
const BATCH_RESULT_PATH = '/tmp/print-batch-result.json'
const OUT_DIR           = path.join(os.tmpdir(), 'print-out')

// One Illustrator session for all PDFs — allow 10 minutes total
const AI_TIMEOUT_MS    = 10 * 60 * 1000
const POLL_INTERVAL_MS = 3_000

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

interface BatchJobItem {
  sizeKey: string
  designPath: string
  outPath: string
  widthMM: number
  heightMM: number
}

/**
 * Run ALL print PDFs for a design in a single Illustrator session.
 *
 * The JSX script reads /tmp/print-batch-job.json (array of jobs) and
 * processes them one by one, writing each PDF as it goes.
 * We poll until ALL output files exist.
 */
async function generateBatchViaIllustrator(
  jobs: BatchJobItem[],
  designCode: string
): Promise<void> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  // Remove any stale output PDFs for this run
  for (const job of jobs) {
    if (fs.existsSync(job.outPath)) fs.unlinkSync(job.outPath)
  }
  if (fs.existsSync(BATCH_RESULT_PATH)) fs.unlinkSync(BATCH_RESULT_PATH)

  // Write batch config
  fs.writeFileSync(BATCH_CONFIG_PATH, JSON.stringify({ jobs }))

  // Write AppleScript with generous timeout (10 min)
  const appleScriptPath = path.join(os.tmpdir(), `print-batch-${designCode}.applescript`)
  fs.writeFileSync(appleScriptPath, [
    `with timeout of 600 seconds`,
    `  tell application "Adobe Illustrator"`,
    `    do javascript file "${JSX_SCRIPT}"`,
    `  end tell`,
    `end timeout`,
  ].join('\n'), 'utf-8')

  const child = spawn('osascript', [appleScriptPath], {
    detached: false,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  child.stderr?.on('data', (d: Buffer) => {
    console.error('[print osascript stderr]', d.toString())
  })

  // Poll until ALL expected PDFs exist, or result file signals an early error
  const deadline = Date.now() + AI_TIMEOUT_MS
  await new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      try {
        // Check if batch result file exists (error signal from JSX)
        if (fs.existsSync(BATCH_RESULT_PATH) && fs.statSync(BATCH_RESULT_PATH).size > 0) {
          clearInterval(interval)
          resolve()
          return
        }
        // Check if all output PDFs exist and have content
        const allDone = jobs.every(
          (j) => fs.existsSync(j.outPath) && fs.statSync(j.outPath).size > 0
        )
        if (allDone) {
          clearInterval(interval)
          resolve()
          return
        }
        const doneSoFar = jobs.filter(
          (j) => fs.existsSync(j.outPath) && fs.statSync(j.outPath).size > 0
        ).length
        console.log(`[print] ${doneSoFar}/${jobs.length} PDFs gereed...`)

        if (Date.now() > deadline) {
          clearInterval(interval)
          reject(new Error(`Illustrator timeout — slechts ${doneSoFar}/${jobs.length} PDFs gegenereerd`))
        }
      } catch {
        // statSync can throw transiently — keep polling
      }
    }, POLL_INTERVAL_MS)
  })

  // Check for batch result error
  if (fs.existsSync(BATCH_RESULT_PATH) && fs.statSync(BATCH_RESULT_PATH).size > 0) {
    try {
      const raw = fs.readFileSync(BATCH_RESULT_PATH, 'utf-8')
      console.log('[print batch result]', raw)
      const parsed = JSON.parse(raw)
      if (!parsed.success) {
        throw new Error(`Illustrator batch fout: ${parsed.error}`)
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        console.warn('[print] Could not parse batch result JSON, continuing')
      } else {
        throw e
      }
    }
  }

  // Clean up
  try { fs.unlinkSync(appleScriptPath) } catch (_) {}
}

/**
 * Generate print PDFs for all size variants of a design in one Illustrator session,
 * then upload all to Drive in parallel.
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
    return [{ sizeKey: '', widthMM: 0, heightMM: 0, driveFileId: '', driveUrl: '', fileName: '',
      skipped: true, skipReason: `Printbestanden nog niet ondersteund voor ${productType}` }]
  }

  // Unique variant sizeKeys
  const variantSizeKeys = [...new Set(
    design.variants.map((v) => v.size.replace(/\s*mm\s*/i, '').replace(/\s+/g, ''))
  )]

  // Match to print templates
  const templates: PrintTemplate[] = []
  for (const sizeKey of variantSizeKeys) {
    const tmpl = getPrintTemplateForSize('IB', sizeKey)
    if (tmpl) templates.push(tmpl)
  }

  if (templates.length === 0) {
    return [{ sizeKey: '', widthMM: 0, heightMM: 0, driveFileId: '', driveUrl: '', fileName: '',
      skipped: true, skipReason: 'Geen print templates gevonden voor de varianten van dit design' }]
  }

  // Download design image once (full resolution — no resize for Illustrator)
  const designBuffer = await getDesignImageBuffer(design.driveFileId)
  const designTempPath = path.join(os.tmpdir(), `print-design-${design.designCode}.jpg`)
  fs.writeFileSync(designTempPath, designBuffer)

  // Build batch jobs
  const batchJobs: BatchJobItem[] = templates.map((tmpl) => ({
    sizeKey:    tmpl.sizeKey,
    designPath: designTempPath,
    outPath:    path.join(OUT_DIR, buildPrintFileName(productType, design.designCode, tmpl.widthMM, tmpl.heightMM)),
    widthMM:    tmpl.widthMM,
    heightMM:   tmpl.heightMM,
  }))

  // Generate all PDFs in one Illustrator session
  try {
    await generateBatchViaIllustrator(batchJobs, design.designCode)
  } finally {
    try { fs.unlinkSync(designTempPath) } catch (_) {}
  }

  // Upload all to Drive in parallel, save to DB
  const results = await Promise.all(
    templates.map(async (tmpl, i): Promise<PrintFileResult> => {
      const job      = batchJobs[i]
      const fileName = buildPrintFileName(productType, design.designCode, tmpl.widthMM, tmpl.heightMM)
      try {
        if (!fs.existsSync(job.outPath) || fs.statSync(job.outPath).size === 0) {
          return { sizeKey: tmpl.sizeKey, widthMM: tmpl.widthMM, heightMM: tmpl.heightMM,
            driveFileId: '', driveUrl: '', fileName,
            skipped: true, skipReason: 'Illustrator heeft geen PDF gegenereerd voor dit formaat' }
        }

        const pdfBuffer = fs.readFileSync(job.outPath)
        const uploaded  = await uploadPrintFileToDrive(pdfBuffer, fileName, design.designCode)
        try { fs.unlinkSync(job.outPath) } catch (_) {}

        // Upsert DB row
        await prisma.designPrintFile.deleteMany({ where: { designId, sizeKey: tmpl.sizeKey } })
        await prisma.designPrintFile.create({
          data: {
            designId,
            productType,
            sizeKey:     tmpl.sizeKey,
            widthMM:     tmpl.widthMM,
            heightMM:    tmpl.heightMM,
            fileName,
            driveFileId: uploaded.fileId,
            driveUrl:    uploaded.webViewLink,
          },
        })

        return {
          sizeKey:     tmpl.sizeKey,
          widthMM:     tmpl.widthMM,
          heightMM:    tmpl.heightMM,
          driveFileId: uploaded.fileId,
          driveUrl:    uploaded.webViewLink,
          fileName,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { sizeKey: tmpl.sizeKey, widthMM: tmpl.widthMM, heightMM: tmpl.heightMM,
          driveFileId: '', driveUrl: '', fileName,
          skipped: true, skipReason: `Fout bij uploaden: ${msg}` }
      }
    })
  )

  // Mark workflow step
  const successCount = results.filter((r) => !r.skipped).length
  if (successCount > 0) {
    await prisma.workflowStep.upsert({
      where:  { designId_step: { designId, step: 'PRINT_GENERATION' } },
      create: { designId, step: 'PRINT_GENERATION', status: 'COMPLETED',
                completedAt: new Date(), data: JSON.stringify({ printFiles: successCount }) },
      update: { status: 'COMPLETED', completedAt: new Date(),
                data: JSON.stringify({ printFiles: successCount }) },
    })
  }

  return results
}

/**
 * Regenerate a single print file for a specific sizeKey.
 * Still uses the batch infrastructure (batch of 1) for consistency.
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

  const tmpl = getPrintTemplateForSize('IB', sizeKey)
  if (!tmpl) throw new Error(`Geen print template gevonden voor sizeKey: ${sizeKey}`)

  const designBuffer   = await getDesignImageBuffer(design.driveFileId)
  const designTempPath = path.join(os.tmpdir(), `print-design-${design.designCode}.jpg`)
  fs.writeFileSync(designTempPath, designBuffer)

  const fileName = buildPrintFileName(productType, design.designCode, tmpl.widthMM, tmpl.heightMM)
  const outPath  = path.join(OUT_DIR, fileName)

  const batchJobs: BatchJobItem[] = [{
    sizeKey:    tmpl.sizeKey,
    designPath: designTempPath,
    outPath,
    widthMM:    tmpl.widthMM,
    heightMM:   tmpl.heightMM,
  }]

  try {
    await generateBatchViaIllustrator(batchJobs, design.designCode)
  } finally {
    try { fs.unlinkSync(designTempPath) } catch (_) {}
  }

  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    return { sizeKey, widthMM: tmpl.widthMM, heightMM: tmpl.heightMM,
      driveFileId: '', driveUrl: '', fileName,
      skipped: true, skipReason: 'Illustrator heeft geen PDF gegenereerd' }
  }

  try {
    const pdfBuffer = fs.readFileSync(outPath)
    const uploaded  = await uploadPrintFileToDrive(pdfBuffer, fileName, design.designCode)
    try { fs.unlinkSync(outPath) } catch (_) {}

    await prisma.designPrintFile.deleteMany({ where: { designId, sizeKey } })
    await prisma.designPrintFile.create({
      data: { designId, productType, sizeKey, widthMM: tmpl.widthMM, heightMM: tmpl.heightMM,
              fileName, driveFileId: uploaded.fileId, driveUrl: uploaded.webViewLink },
    })

    return { sizeKey, widthMM: tmpl.widthMM, heightMM: tmpl.heightMM,
             driveFileId: uploaded.fileId, driveUrl: uploaded.webViewLink, fileName }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { sizeKey, widthMM: tmpl.widthMM, heightMM: tmpl.heightMM,
      driveFileId: '', driveUrl: '', fileName,
      skipped: true, skipReason: `Fout bij uploaden: ${msg}` }
  }
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
