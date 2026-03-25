import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn, execSync } from 'child_process'
import { prisma } from './prisma'
import { getFileAsBase64, uploadDesignToDrive } from './drive'
import { getTemplatesForProduct } from './mockup-config'
import type { MockupTemplate } from './mockup-config'

const JSX_SCRIPT = path.join(process.cwd(), 'scripts', 'generate-mockup.jsx')
const CONFIG_PATH = '/tmp/mockup-job.json'
const RESULT_PATH = '/tmp/mockup-job-result.json'
const OUT_DIR = path.join(os.tmpdir(), 'mockup-out')

// How long to wait for Photoshop to finish one mockup (ms)
const PS_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const POLL_INTERVAL_MS = 2_000

export interface MockupResult {
  templateId: string
  outputName: string
  driveFileId: string
  driveUrl: string
  skipped?: boolean
  skipReason?: string
}

const PRODUCT_TYPE_NL: Record<string, string> = {
  IB: 'inductiebeschermer',
  SP: 'spatscherm',
  MC: 'muurcirkel',
}

/**
 * Bouwt een SEO alt-tekst voor een mockup afbeelding.
 * Deterministisch — geen AI-aanroep nodig.
 */
function buildMockupAltText(designName: string, productType: string, outputName: string): string {
  const typeNl = PRODUCT_TYPE_NL[productType] ?? productType.toLowerCase()
  // outputName is like "mockup-3" or "mockup-lifestyle" — trim the "mockup-" prefix
  const scene = outputName.replace(/^mockup-?/i, '').replace(/-/g, ' ').trim()
  if (scene) {
    return `${designName} ${typeNl} mockup — ${scene} — KitchenArt`.slice(0, 125)
  }
  return `${designName} ${typeNl} — KitchenArt`.slice(0, 125)
}

/**
 * Generate one mockup by calling Photoshop via osascript.
 *
 * osascript has a built-in AppleEvent timeout (~2 min) which fires before
 * Photoshop finishes large PSDs. We spawn it detached (fire-and-forget) and
 * poll for the result file that the JSX writes when done.
 */
async function generateMockupViaPhotoshop(
  designImageBuffer: Buffer,
  template: MockupTemplate,
  designCode: string
): Promise<string> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  // Write design to a temp PNG file.
  // PNG avoids the Camera Raw dialog that Photoshop shows for JPEGs when
  // placedLayerReplaceContents is used. We convert with sips (macOS built-in).
  const designJpgPath = path.join(os.tmpdir(), `design-${designCode}.jpg`)
  const designTempPath = path.join(os.tmpdir(), `design-${designCode}.png`)
  fs.writeFileSync(designJpgPath, designImageBuffer)
  execSync(`sips -s format png "${designJpgPath}" --out "${designTempPath}"`, { stdio: 'ignore' })
  try { fs.unlinkSync(designJpgPath) } catch (_) {}

  const outPath = path.join(OUT_DIR, `${designCode}-${template.outputName}.jpg`)

  // Write job config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    psdPath: template.psdPath,
    designPath: designTempPath,
    outPath,
  }))

  // Remove stale result file if present
  if (fs.existsSync(RESULT_PATH)) fs.unlinkSync(RESULT_PATH)

  // Fire osascript detached — do NOT block on it.
  // The JSX writes /tmp/mockup-job-result.json when done; we poll for that.
  const jsxEscaped = JSX_SCRIPT.replace(/"/g, '\\"')
  const child = spawn(
    'osascript',
    ['-e', `tell application "Adobe Photoshop 2026" to do javascript file "${jsxEscaped}"`],
    { detached: true, stdio: 'ignore' }
  )
  child.unref()

  // Poll for result file
  const deadline = Date.now() + PS_TIMEOUT_MS
  await new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      if (fs.existsSync(RESULT_PATH)) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() > deadline) {
        clearInterval(interval)
        reject(new Error(`Photoshop timeout na ${PS_TIMEOUT_MS / 1000}s — geen resultaat ontvangen`))
      }
    }, POLL_INTERVAL_MS)
  })

  const result = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf-8'))
  if (!result.success) {
    throw new Error(`Photoshop fout: ${result.error}`)
  }

  return result.outPath as string
}

/**
 * Generate all mockups for a design using Photoshop, then upload to Google Drive.
 */
export async function generateMockupsForDesign(
  designId: string,
  sizeKey?: string
): Promise<MockupResult[]> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { variants: { take: 1 } },
  })

  if (!design) throw new Error(`Design niet gevonden: ${designId}`)
  if (!design.driveFileId) throw new Error('Geen Drive-bestand gekoppeld aan dit design')

  // Prefer variant productType, fall back to design.designType
  const productType = (design.variants[0]?.productType ?? design.designType) as 'IB' | 'SP' | 'MC' | undefined
  if (!productType) throw new Error('Geen producttype gevonden — stel designType in of genereer eerst varianten')

  // Download design image from Drive
  const { base64 } = await getFileAsBase64(design.driveFileId)
  const designBuffer = Buffer.from(base64, 'base64')

  const templates = getTemplatesForProduct(productType, sizeKey)

  if (templates.length === 0) {
    return [{
      templateId: 'none',
      outputName: 'none',
      driveFileId: '',
      driveUrl: '',
      skipped: true,
      skipReason: `Geen templates geconfigureerd voor ${productType}${sizeKey ? ` maat ${sizeKey}` : ''}`,
    }]
  }

  const results: MockupResult[] = []

  for (const template of templates) {
    try {
      const outPath = await generateMockupViaPhotoshop(designBuffer, template, design.designCode)

      const mockupBuffer = fs.readFileSync(outPath)
      const mockupFileName = `${design.designCode}-${productType}-${template.outputName}.jpg`

      const uploaded = await uploadDesignToDrive(
        mockupBuffer,
        mockupFileName,
        'image/jpeg',
        `${design.designCode}-mockup`
      )

      results.push({
        templateId: template.id,
        outputName: template.outputName,
        driveFileId: uploaded.fileId,
        driveUrl: uploaded.webContentLink,
      })

      try { fs.unlinkSync(outPath) } catch (_) {}

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        templateId: template.id,
        outputName: template.outputName,
        driveFileId: '',
        driveUrl: '',
        skipped: true,
        skipReason: `Fout bij genereren: ${msg}`,
      })
    }
  }

  // Save all successful mockups to the DesignMockup table (upsert by templateId)
  const successes = results.filter((r) => !r.skipped)
  for (const r of successes) {
    const altText = buildMockupAltText(design.designName, productType, r.outputName)
    // Delete existing record for this template so we can replace it cleanly
    await prisma.designMockup.deleteMany({
      where: { designId, templateId: r.templateId },
    })
    await prisma.designMockup.create({
      data: {
        designId,
        templateId: r.templateId,
        outputName: r.outputName,
        productType,
        driveFileId: r.driveFileId,
        driveUrl: r.driveUrl,
        altText,
      },
    })
  }

  // Save first successful mockup URL to variants (used as "main" mockup thumbnail)
  const firstSuccess = successes[0]
  if (firstSuccess) {
    await prisma.variant.updateMany({
      where: { designId, productType },
      data: { mockupFilePath: firstSuccess.driveUrl },
    })

    await prisma.workflowStep.upsert({
      where: { designId_step: { designId, step: 'MOCKUP_GENERATION' } },
      create: {
        designId,
        step: 'MOCKUP_GENERATION',
        status: 'COMPLETED',
        completedAt: new Date(),
        data: JSON.stringify({ mockups: successes.length }),
      },
      update: {
        status: 'COMPLETED',
        completedAt: new Date(),
        data: JSON.stringify({ mockups: successes.length }),
      },
    })
  }

  return results
}

/**
 * Check which PSD source files exist on disk.
 */
export function checkTemplateStatus(productType: 'IB' | 'SP' | 'MC') {
  const templates = getTemplatesForProduct(productType)
  return templates.map((t) => ({
    id: t.id,
    psdPath: t.psdPath,
    ready: fs.existsSync(t.psdPath),
    sizeKey: t.sizeKey,
  }))
}
