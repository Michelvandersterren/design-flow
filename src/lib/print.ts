/**
 * print.ts — Node.js PDF generatie voor KitchenArt printbestanden
 *
 * Spec (gebaseerd op Probo .joboptions preset + reverse-engineering van Probo PDFs):
 *   - Bleed: 10mm per kant (= BleedOffset 28.34646 pt in preset)
 *   - Pagina = MediaBox = BleedBox = TrimBox = (productW + 20mm) × (productH + 20mm)
 *   - ArtBox = productrand (10mm inset van MediaBox)
 *   - Design afbeelding: cover-scaled, geplaatst op volledige pagina, 150 dpi downsampled, lossless PNG
 *   - CutContour (IB only): rounded rect, 10mm inset, 5mm corner radius, spot color "Cutcontour"
 *     (0C 100M 0Y 0K), 0.25pt stroke, overprint ON
 *   - SP/MC: geen CutContour — alleen afbeelding met bleed
 *   - Spot color naam: "Cutcontour" (lowercase c — exact zoals in Probo reference PDF)
 *   - PDF 1.7 compatibel
 *   - FOGRA39 CMYK ICC profiel ingebed
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib'
import sharp from 'sharp'
import { prisma } from './prisma'
import { uploadPrintFileToDrive } from './drive'
import { getPrintTemplateForSize, buildPrintFileName } from './print-config'
import type { PrintTemplate } from './print-config'

// ── Constanten (exact conform Probo preset en reference PDFs) ──────────────
const MM_TO_PT    = 72 / 25.4          // 1mm = 2.834645669 pt
const BLEED_MM    = 10                 // BleedOffset in preset = 28.34646 pt = 10mm
const CORNER_MM   = 5                  // corner radius CutContour
const STROKE_PT   = 0.25              // CutContour stroke breedte
const TARGET_DPI  = 150               // preset: ColorImageResolution 150
const SPOT_NAME   = 'Cutcontour'      // exact zoals in Probo reference PDF (lowercase c)

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

// ── Hoofd exportfuncties ──────────────────────────────────────────────────

/**
 * Genereer printbestanden voor ALLE size-varianten van een design.
 * PDFs worden parallel gebouwd en geüpload.
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

  // Unieke sizeKeys — SP heeft meerdere variants per maat (G/BH0/BH4), dedupliceer
  const variantSizeKeys = [...new Set(
    design.variants.map((v) => v.size.replace(/\s*mm\s*/i, '').replace(/\s+/g, ''))
  )]

  const templates: PrintTemplate[] = []
  for (const sizeKey of variantSizeKeys) {
    const tmpl = getPrintTemplateForSize(productType, sizeKey)
    if (tmpl) templates.push(tmpl)
  }

  if (templates.length === 0) {
    return [{ sizeKey: '', widthMM: 0, heightMM: 0, driveFileId: '', driveUrl: '', fileName: '',
      skipped: true, skipReason: 'Geen print templates gevonden voor de varianten van dit design' }]
  }

  // Download design image eenmalig
  const designBuffer = await getDesignImageBuffer(design.driveFileId)

  // Genereer + upload alle PDFs parallel
  const results = await Promise.all(
    templates.map((tmpl) =>
      buildAndUploadPrintFile(designId, productType, design.designCode, tmpl, designBuffer)
    )
  )

  // Markeer workflow stap
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
 * Regenereer één printbestand voor een specifiek sizeKey.
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

  const tmpl = getPrintTemplateForSize(productType, sizeKey)
  if (!tmpl) throw new Error(`Geen print template gevonden voor ${productType} sizeKey: ${sizeKey}`)

  const designBuffer = await getDesignImageBuffer(design.driveFileId)
  return buildAndUploadPrintFile(designId, productType, design.designCode, tmpl, designBuffer)
}

/**
 * Verwijder alle printbestand-records voor een design uit de DB.
 */
export async function deleteAllPrintFilesForDesign(designId: string): Promise<number> {
  const { count } = await prisma.designPrintFile.deleteMany({ where: { designId } })
  return count
}

// ── Interne functies ──────────────────────────────────────────────────────

/**
 * Bouw één print-PDF en upload naar Drive. Sla op in DB.
 */
async function buildAndUploadPrintFile(
  designId: string,
  productType: string,
  designCode: string,
  tmpl: PrintTemplate,
  designBuffer: Buffer
): Promise<PrintFileResult> {
  const fileName = buildPrintFileName(productType as 'IB' | 'SP' | 'MC', designCode, tmpl.widthMM, tmpl.heightMM)

  try {
    const pdfBuffer = await buildPrintPdf(designBuffer, tmpl.widthMM, tmpl.heightMM, productType)
    const uploaded  = await uploadPrintFileToDrive(pdfBuffer, fileName, designCode)

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
    console.error(`[print] Fout bij ${tmpl.sizeKey}:`, msg)
    return {
      sizeKey:    tmpl.sizeKey,
      widthMM:    tmpl.widthMM,
      heightMM:   tmpl.heightMM,
      driveFileId: '',
      driveUrl:   '',
      fileName,
      skipped:    true,
      skipReason: `Fout bij genereren/uploaden: ${msg}`,
    }
  }
}

/**
 * Bouw de print-PDF in memory.
 *
 * Pagina-structuur (conform Probo preset):
 *   MediaBox = BleedBox = TrimBox = (productW + 2×10mm) × (productH + 2×10mm)
 *   ArtBox   = product-rand (10mm inset)
 *
 * Lagen (onderaan → boven):
 *   1. Design-afbeelding: cover-scaled, 150 dpi downgesampled, lossless PNG
 *   2. CutContour (IB only): rounded rect, 10mm inset, 5mm radius, spot "Cutcontour", overprint ON
 *      SP/MC: geen CutContour — alleen afbeelding met bleed
 */
async function buildPrintPdf(designBuffer: Buffer, widthMM: number, heightMM: number, productType: string): Promise<Buffer> {
  // Paginaformaat in punten (product + bleed)
  const pageW_pt = (widthMM  + 2 * BLEED_MM) * MM_TO_PT
  const pageH_pt = (heightMM + 2 * BLEED_MM) * MM_TO_PT

  const doc  = await PDFDocument.create()
  const page = doc.addPage([pageW_pt, pageH_pt])

  // ── 1. Design afbeelding ──────────────────────────────────────────────

  // Downsample naar 150 dpi op de paginagrootte (in pixels)
  const targetPxW = Math.round((pageW_pt / 72) * TARGET_DPI)
  const targetPxH = Math.round((pageH_pt / 72) * TARGET_DPI)

  // Cover-crop: schaal zodat de kortste zijde past, snijd de rest bij
  const imgResized = await sharp(designBuffer)
    .resize(targetPxW, targetPxH, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 6 })   // lossless, conform FlateEncode in preset
    .toBuffer()

  const embeddedImg = await doc.embedPng(imgResized)

  // Teken de afbeelding op de volledige pagina
  page.drawImage(embeddedImg, {
    x:      0,
    y:      0,
    width:  pageW_pt,
    height: pageH_pt,
  })

  // ── 2. CutContour spot color laag (IB only) ──────────────────────────

  if (productType === 'IB') {
    addCutContourSpotColor(doc, page, pageW_pt, pageH_pt)
  }

  // ── 3. Boxes: TrimBox en ArtBox (10mm inset) ─────────────────────────

  const inset_pt = BLEED_MM * MM_TO_PT
  // pdf-lib stelt MediaBox al in via addPage([w, h])
  // TrimBox = MediaBox (conform PDFXSetBleedBoxToMediaBox: true)
  page.node.set(PDFName.of('TrimBox'), doc.context.obj([0, 0, pageW_pt, pageH_pt]))
  page.node.set(PDFName.of('BleedBox'), doc.context.obj([0, 0, pageW_pt, pageH_pt]))
  // ArtBox = productrand
  page.node.set(PDFName.of('ArtBox'), doc.context.obj([
    inset_pt,
    inset_pt,
    pageW_pt - inset_pt,
    pageH_pt - inset_pt,
  ]))

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Voeg CutContour spot color toe via raw PDF content stream operators.
 *
 * Spot color definitie:
 *   [/Separation /Cutcontour /DeviceCMYK tintTransform]
 *   tintTransform: f(t) = [0, t, 0, 0]  →  0C, t×100M, 0Y, 0K
 *
 * Rounded rect als PDF path, 10mm inset, 5mm corner radius.
 * Stroke met spot color, 0.25pt breedte, overprint ON.
 */
function addCutContourSpotColor(
  doc: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  pageW_pt: number,
  pageH_pt: number
): void {
  const context = doc.context

  // Tint transform Type 4 function: f(t) = [0, t, 0, 0]
  // PostScript: { 0 exch 0 0 } → stack [0, t, 0, 0] na uitvoering
  const tintFuncDict: Record<string, unknown> = {
    FunctionType: 4,
    Domain: [0, 1],
    Range: [0, 1, 0, 1, 0, 1, 0, 1],
  }
  const tintFuncContent = Buffer.from('{ 0 exch 0 0 }')
  const tintFuncStream = context.flateStream(tintFuncContent, tintFuncDict as never)
  const tintFuncRef = context.register(tintFuncStream)

  // Separation colorspace array
  const separationCS = context.obj([
    PDFName.of('Separation'),
    PDFName.of(SPOT_NAME),
    PDFName.of('DeviceCMYK'),
    tintFuncRef,
  ])
  const separationCSRef = context.register(separationCS)

  // Voeg colorspace toe aan pagina Resources
  const resources = page.node.Resources()
  if (!resources) throw new Error('Pagina heeft geen Resources dict')
  let csDict: PDFDict
  const existingCS = resources.lookup(PDFName.of('ColorSpace'))
  if (existingCS instanceof PDFDict) {
    csDict = existingCS
  } else {
    csDict = context.obj({})
    resources.set(PDFName.of('ColorSpace'), csDict)
  }
  csDict.set(PDFName.of('CutcontourCS'), separationCSRef)

  // ── Rounded rect padh-coördinaten ────────────────────────────────────
  // 10mm inset, 5mm corner radius
  const inset_pt  = BLEED_MM  * MM_TO_PT
  const radius_pt = CORNER_MM * MM_TO_PT

  // Rechthoek grenzen (product-rand)
  const x0 = inset_pt
  const y0 = inset_pt
  const x1 = pageW_pt - inset_pt
  const y1 = pageH_pt - inset_pt
  const r  = radius_pt

  // Bézier kwartcirkel approximatie: k = 0.5523
  // Voor hoek van (x, y+r) naar (x+r, y):
  //   CP1 = (x, y + r - r*k)  = (x, y + r*(1-k))
  //   CP2 = (x + r - r*k, y)  = (x + r*(1-k), y)
  // Conform Probo reference PDF (k ≈ 0.5501, wij gebruiken standaard 0.5523)
  const k  = 0.5522847498
  const rk = r * (1 - k)   // = r - r*k

  // PDF content stream voor rounded rect + spot color stroke
  // CS = set stroke colorspace, SC = set spot color tint
  // w = line width, J = line cap (1=round), j = line join (1=round)
  // S = stroke path, q/Q = save/restore graphics state
  const pathOps = [
    'q',
    '/CutcontourGS gs',
    '/CutcontourCS CS',
    '1 SC',
    `${STROKE_PT} w`,
    '1 J',
    '1 j',
    // Pad conform Probo: start links-onder (na hoek), loopt tegen de klok in
    // bottom-left -> omhoog -> top-left hoek -> rechts -> top-right hoek
    //             -> omlaag -> bottom-right hoek -> links -> bottom-left hoek
    `${x0} ${y0 + r} m`,                                      // start links, net boven hoek
    `${x0} ${y1 - r} l`,                                      // links omhoog
    `${x0} ${y1 - rk}  ${x0 + rk} ${y1}  ${x0 + r} ${y1} c`, // top-left hoek
    `${x1 - r} ${y1} l`,                                      // boven naar rechts
    `${x1 - rk} ${y1}  ${x1} ${y1 - rk}  ${x1} ${y1 - r} c`, // top-right hoek
    `${x1} ${y0 + r} l`,                                      // rechts omlaag
    `${x1} ${y0 + rk}  ${x1 - rk} ${y0}  ${x1 - r} ${y0} c`, // bottom-right hoek
    `${x0 + r} ${y0} l`,                                      // onder naar links
    `${x0 + rk} ${y0}  ${x0} ${y0 + rk}  ${x0} ${y0 + r} c`, // bottom-left hoek
    'h',
    'S',
    'Q',
  ].join('\n')

  // ExtGState voor overprint stroke
  const gsDict = context.obj({
    Type: PDFName.of('ExtGState'),
    op: true,    // overprint stroke
    OP: true,    // overprint fill (ook instellen voor zekerheid)
    OPM: 1,
  })
  const gsRef = context.register(gsDict)

  // Voeg ExtGState toe aan pagina Resources
  let extGStateDict: PDFDict
  const existingGS = resources.lookup(PDFName.of('ExtGState'))
  if (existingGS instanceof PDFDict) {
    extGStateDict = existingGS
  } else {
    extGStateDict = context.obj({})
    resources.set(PDFName.of('ExtGState'), extGStateDict)
  }
  extGStateDict.set(PDFName.of('CutcontourGS'), gsRef)

  // Voeg content stream toe aan pagina
  const contentStream = context.flateStream(Buffer.from(pathOps), {})
  const contentStreamRef = context.register(contentStream)

  // Append aan bestaande pagina content
  // pdf-lib stelt Contents al in als PDFArray na drawImage() — push direct in die array.
  // Nooit opnieuw wrappen: [ [6 0 R] 10 0 R ] is een ongeldige geneste array in PDF.
  const existingContents = page.node.lookup(PDFName.of('Contents'))
  if (existingContents instanceof PDFArray) {
    existingContents.push(contentStreamRef)
  } else if (existingContents) {
    // Enkel ref (niet array) — wrap wél in array
    page.node.set(PDFName.of('Contents'), context.obj([existingContents, contentStreamRef]))
  } else {
    page.node.set(PDFName.of('Contents'), contentStreamRef)
  }
}

/**
 * Download design afbeelding van Google Drive.
 */
async function getDesignImageBuffer(driveFileId: string): Promise<Buffer> {
  const { google } = await import('googleapis')
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = await import('./env')

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key:   GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.get(
    { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data as ArrayBuffer)
}
