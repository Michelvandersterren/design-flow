import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn, execSync } from 'child_process'
import { prisma } from './prisma'
import { getFileAsBase64, uploadDesignToDrive } from './drive'
import { getTemplatesForProduct, getSizeSpecificTemplates, getTemplateById, IB_SIZE_KEY_ALIASES } from './mockup-config'
import type { MockupTemplate } from './mockup-config'

const JSX_SCRIPT = path.join(process.cwd(), 'scripts', 'generate-mockup.jsx')
const CONFIG_PATH = '/tmp/mockup-job.json'
const RESULT_PATH = '/tmp/mockup-job-result.json'
const OUT_DIR = path.join(os.tmpdir(), 'mockup-out')

// How long to wait for Photoshop to finish one mockup (ms)
const PS_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const POLL_INTERVAL_MS = 2_000

// Template IDs whose PSDs contain Dutch infographic text.
// These get generated once per language (NL/DE/EN/FR).
// All other templates produce only the NL version (language-neutral images).
const INFOGRAPHIC_TEMPLATE_IDS = new Set(['IB-mockup4', 'IB-mockup5', 'IB-mockup6', 'SP-mockup5'])
export const SUPPORTED_LANGUAGES = ['nl', 'de', 'en', 'fr'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export interface MockupResult {
  templateId: string
  outputName: string
  label: string
  sizeKey?: string
  language: Language
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

const PRODUCT_TYPE_LABELS: Record<Language, Record<string, string>> = {
  nl: { IB: 'inductiebeschermer', SP: 'spatscherm', MC: 'muurcirkel' },
  de: { IB: 'Induktionsschutz', SP: 'Spritzschutz', MC: 'Wandkreis' },
  en: { IB: 'induction protector', SP: 'splashback', MC: 'wall circle' },
  fr: { IB: 'protecteur induction', SP: 'crédence', MC: 'cercle mural' },
}

/**
 * Bouwt een SEO alt-tekst voor een mockup afbeelding.
 * Gebruikt het template label — bijv. "sfeer keuken" — voor een beschrijvende, unieke alt.
 * For non-NL infographic mockups, uses the localized product type name.
 */
function buildMockupAltText(designName: string, productType: string, label: string, language: Language = 'nl'): string {
  const typeLabel = PRODUCT_TYPE_LABELS[language]?.[productType] ?? PRODUCT_TYPE_NL[productType] ?? productType.toLowerCase()
  return `${designName} ${typeLabel} ${label} — KitchenArt`.slice(0, 125)
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
  designCode: string,
  language: Language = 'nl'
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

  const langSuffix = language === 'nl' ? '' : `-${language}`
  const outPath = path.join(OUT_DIR, `${designCode}-${template.outputName}${langSuffix}.jpg`)

  // Write job config — include language for infographic text swap
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    psdPath: template.psdPath,
    designPath: designTempPath,
    outPath,
    language,
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
 * Build the Drive filename for a mockup.
 * Format: {designCode}-{productType}-{outputName}.jpg          (NL)
 *         {designCode}-{productType}-{outputName}-{lang}.jpg   (DE/EN/FR)
 * Example: KA001-IB-sfeer-keuken.jpg, KA001-IB-sfeer-keuken-de.jpg
 */
function buildDriveFilename(designCode: string, productType: string, outputName: string, language: Language = 'nl'): string {
  const langSuffix = language === 'nl' ? '' : `-${language}`
  return `${designCode}-${productType}-${outputName}${langSuffix}.jpg`
}

/**
 * Generate and save a single mockup template for a design.
 * Used both by batch generation and per-template regeneration.
 *
 * @param saveSizeKey  The original variant sizeKey to store in DB. When provided,
 *                     this overrides template.sizeKey so the UI can match
 *                     m.sizeKey === vSizeKey even when an alias was used for PSD lookup.
 * @param language     Target language for infographic text swap (defaults to 'nl').
 */
async function generateAndSaveSingleMockup(
  designId: string,
  designCode: string,
  designName: string,
  productType: 'IB' | 'SP' | 'MC',
  designBuffer: Buffer,
  template: MockupTemplate,
  saveSizeKey?: string,
  language: Language = 'nl'
): Promise<MockupResult> {
  try {
    const outPath = await generateMockupViaPhotoshop(designBuffer, template, designCode, language)

    const mockupBuffer = fs.readFileSync(outPath)
    const mockupFileName = buildDriveFilename(designCode, productType, template.outputName, language)

    const uploaded = await uploadDesignToDrive(
      mockupBuffer,
      mockupFileName,
      'image/jpeg',
      `${designCode}-mockup`
    )

    try { fs.unlinkSync(outPath) } catch (_) {}

    const altText = buildMockupAltText(designName, productType, template.label, language)

    // Store the original variant sizeKey (saveSizeKey) when provided, not the resolved PSD key.
    // This lets the UI match m.sizeKey === vSizeKey correctly.
    const dbSizeKey = saveSizeKey !== undefined ? saveSizeKey : (template.sizeKey ?? null)

    // Delete existing record for this template+sizeKey+language combo, then create fresh.
    // We match on sizeKey too so that multiple variant sizes sharing the same PSD template
    // (via IB_SIZE_KEY_ALIASES) each get their own DB row.
    await prisma.designMockup.deleteMany({
      where: { designId, templateId: template.id, sizeKey: dbSizeKey, language },
    })
    await prisma.designMockup.create({
      data: {
        designId,
        templateId: template.id,
        outputName: template.outputName,
        productType,
        sizeKey: dbSizeKey,
        language,
        driveFileId: uploaded.fileId,
        driveUrl: uploaded.webContentLink,
        altText,
      },
    })

    return {
      templateId: template.id,
      outputName: template.outputName,
      label: template.label,
      sizeKey: dbSizeKey ?? undefined,
      language,
      driveFileId: uploaded.fileId,
      driveUrl: uploaded.webContentLink,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      templateId: template.id,
      outputName: template.outputName,
      label: template.label,
      sizeKey: saveSizeKey ?? template.sizeKey,
      language,
      driveFileId: '',
      driveUrl: '',
      skipped: true,
      skipReason: `Fout bij genereren: ${msg}`,
    }
  }
}

/**
 * Generate ALL mockups for a design (generic + all size-specific matched to variants).
 * This is the single entry point for "Mockups genereren".
 */
export async function generateAllMockupsForDesign(designId: string): Promise<MockupResult[]> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { variants: true },
  })

  if (!design) throw new Error(`Design niet gevonden: ${designId}`)
  if (!design.driveFileId) throw new Error('Geen Drive-bestand gekoppeld aan dit design')

  const productType = (design.variants[0]?.productType ?? design.designType) as 'IB' | 'SP' | 'MC' | undefined
  if (!productType) throw new Error('Geen producttype gevonden — stel designType in of genereer eerst varianten')

  // Download design image once
  const { base64 } = await getFileAsBase64(design.driveFileId)
  const designBuffer = Buffer.from(base64, 'base64')

  // Generic templates (no sizeKey)
  const genericTemplates = getTemplatesForProduct(productType, undefined)

  // Size-specific templates filtered to actual variant sizes.
  // For IB products, resolve each variant sizeKey through the alias map to find the
  // matching PSD sizeKey. Other product types have exact sizeKey matches in the config.
  const variantSizeKeys = new Set(
    design.variants.map((v) => v.size.replace(/\s*mm\s*/i, '').replace(/\s+/g, ''))
  )

  // Build a map: resolvedPsdKey → Set of original variant sizeKeys that map to it.
  // This lets us pick the right PSD template and still store the original sizeKey in DB.
  const resolvedToOriginals = new Map<string, Set<string>>()
  for (const vKey of variantSizeKeys) {
    const resolvedKey = productType === 'IB'
      ? (IB_SIZE_KEY_ALIASES[vKey] ?? vKey)
      : vKey
    if (!resolvedToOriginals.has(resolvedKey)) resolvedToOriginals.set(resolvedKey, new Set())
    resolvedToOriginals.get(resolvedKey)!.add(vKey)
  }

  // For each matching size-specific template, create one job per original variant sizeKey.
  type TemplateWithSaveKey = { template: MockupTemplate; saveSizeKey: string }
  const sizeSpecificJobs: TemplateWithSaveKey[] = []
  for (const template of getSizeSpecificTemplates(productType)) {
    if (!template.sizeKey) continue
    const originals = resolvedToOriginals.get(template.sizeKey)
    if (!originals) continue
    for (const origKey of originals) {
      sizeSpecificJobs.push({ template, saveSizeKey: origKey })
    }
  }

  if (genericTemplates.length === 0 && sizeSpecificJobs.length === 0) {
    return [{
      templateId: 'none',
      outputName: 'none',
      label: 'geen templates',
      language: 'nl' as Language,
      driveFileId: '',
      driveUrl: '',
      skipped: true,
      skipReason: `Geen templates geconfigureerd voor ${productType}`,
    }]
  }

  const results: MockupResult[] = []

  // Run generic templates (no saveSizeKey needed)
  // For infographic templates, generate one mockup per language (NL/DE/EN/FR).
  // For all other templates, generate only NL (they contain no translatable text).
  for (const template of genericTemplates) {
    if (INFOGRAPHIC_TEMPLATE_IDS.has(template.id)) {
      for (const lang of SUPPORTED_LANGUAGES) {
        const result = await generateAndSaveSingleMockup(
          designId, design.designCode, design.designName, productType, designBuffer, template,
          undefined, lang
        )
        results.push(result)
      }
    } else {
      const result = await generateAndSaveSingleMockup(
        designId, design.designCode, design.designName, productType, designBuffer, template
      )
      results.push(result)
    }
  }

  // Run size-specific jobs, each tagged with the original variant sizeKey.
  // Size-specific templates are never infographic templates, so always NL only.
  for (const { template, saveSizeKey } of sizeSpecificJobs) {
    const result = await generateAndSaveSingleMockup(
      designId, design.designCode, design.designName, productType, designBuffer, template, saveSizeKey
    )
    results.push(result)
  }

  // Save first successful mockup URL to variants (used as "main" mockup thumbnail)
  const firstSuccess = results.find((r) => !r.skipped)
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
        data: JSON.stringify({ mockups: results.filter((r) => !r.skipped).length }),
      },
      update: {
        status: 'COMPLETED',
        completedAt: new Date(),
        data: JSON.stringify({ mockups: results.filter((r) => !r.skipped).length }),
      },
    })
  }

  return results
}

/**
 * Regenerate a single mockup by templateId.
 * Used by the per-mockup "Opnieuw genereren" button.
 *
 * For infographic templates, pass a specific language to regenerate just that
 * language variant, or omit language to regenerate all 4 language variants.
 */
export async function regenerateSingleMockup(
  designId: string,
  templateId: string,
  language?: Language
): Promise<MockupResult | MockupResult[]> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { variants: { take: 1 } },
  })

  if (!design) throw new Error(`Design niet gevonden: ${designId}`)
  if (!design.driveFileId) throw new Error('Geen Drive-bestand gekoppeld aan dit design')

  const productType = (design.variants[0]?.productType ?? design.designType) as 'IB' | 'SP' | 'MC' | undefined
  if (!productType) throw new Error('Geen producttype gevonden')

  const template = getTemplateById(templateId)
  if (!template) throw new Error(`Template niet gevonden: ${templateId}`)

  // Retrieve the existing sizeKey so size-specific mockups keep their bucket after regeneration
  const existing = await prisma.designMockup.findFirst({
    where: { designId, templateId },
    select: { sizeKey: true },
  })

  const { base64 } = await getFileAsBase64(design.driveFileId)
  const designBuffer = Buffer.from(base64, 'base64')

  const saveSizeKey = existing?.sizeKey ?? undefined

  // For infographic templates: regenerate all languages (or just the requested one)
  if (INFOGRAPHIC_TEMPLATE_IDS.has(templateId)) {
    const langs = language ? [language] : [...SUPPORTED_LANGUAGES]
    const results: MockupResult[] = []
    for (const lang of langs) {
      results.push(await generateAndSaveSingleMockup(
        designId, design.designCode, design.designName, productType, designBuffer, template,
        saveSizeKey, lang
      ))
    }
    return language ? results[0] : results
  }

  // Non-infographic: always NL
  return generateAndSaveSingleMockup(
    designId, design.designCode, design.designName, productType, designBuffer, template,
    saveSizeKey, 'nl'
  )
}

/**
 * Delete all mockups for a design from the DB.
 * Does NOT delete the Drive files (they can be reused / overwritten on next generation).
 */
export async function deleteAllMockupsForDesign(designId: string): Promise<number> {
  const { count } = await prisma.designMockup.deleteMany({ where: { designId } })
  return count
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

// ---------------------------------------------------------------------------
// Legacy exports — kept for backwards compatibility during transition
// ---------------------------------------------------------------------------

/**
 * @deprecated Use generateAllMockupsForDesign instead.
 * Kept temporarily so the old API route still compiles.
 */
export async function generateMockupsForDesign(
  designId: string,
  sizeKey?: string
): Promise<MockupResult[]> {
  if (!sizeKey || sizeKey === 'all') {
    return generateAllMockupsForDesign(designId)
  }

  // Single-sizeKey path (used by old per-variant buttons — may be removed later)
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { variants: { take: 1 } },
  })
  if (!design) throw new Error(`Design niet gevonden: ${designId}`)
  if (!design.driveFileId) throw new Error('Geen Drive-bestand gekoppeld')

  const productType = (design.variants[0]?.productType ?? design.designType) as 'IB' | 'SP' | 'MC' | undefined
  if (!productType) throw new Error('Geen producttype')

  const { base64 } = await getFileAsBase64(design.driveFileId)
  const designBuffer = Buffer.from(base64, 'base64')

  const templates = getTemplatesForProduct(productType, sizeKey)
  const results: MockupResult[] = []
  for (const template of templates) {
    results.push(await generateAndSaveSingleMockup(
      designId, design.designCode, design.designName, productType, designBuffer, template
    ))
  }
  return results
}

/**
 * @deprecated Use generateAllMockupsForDesign instead.
 */
export async function generateSizeSpecificMockupsForDesign(
  designId: string
): Promise<MockupResult[]> {
  return generateAllMockupsForDesign(designId)
}
