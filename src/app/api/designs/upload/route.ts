import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadDesignToDrive } from '@/lib/drive'

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/tiff']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const designName = (formData.get('designName') as string | null)?.trim()
    const designCode = (formData.get('designCode') as string | null)?.trim().toUpperCase()
    const designType = (formData.get('designType') as string | null)?.trim() || null

    // AI-suggested metadata (optional) — convert comma-separated to JSON arrays
    const collectionsRaw = (formData.get('collections') as string | null)?.trim() || ''
    const colorTagsRaw = (formData.get('colorTags') as string | null)?.trim() || ''
    const collections = collectionsRaw ? JSON.stringify(collectionsRaw.split(',').map((s) => s.trim()).filter(Boolean)) : null
    const colorTags = colorTagsRaw ? JSON.stringify(colorTagsRaw.split(',').map((s) => s.trim()).filter(Boolean)) : null
    const inductionFriendly = formData.get('inductionFriendly') === 'true'
    const circleFriendly = formData.get('circleFriendly') === 'true'
    const splashFriendly = formData.get('splashFriendly') === 'true'

    // Validatie
    if (!file) {
      return NextResponse.json({ error: 'Geen bestand meegegeven' }, { status: 400 })
    }
    if (!designName) {
      return NextResponse.json({ error: 'Ontwerp naam is verplicht' }, { status: 400 })
    }
    if (!designCode) {
      return NextResponse.json({ error: 'Ontwerp code is verplicht' }, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Bestandstype niet toegestaan. Gebruik: PNG, JPG, WebP of TIFF` },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Bestand is te groot (max 50MB)' },
        { status: 400 }
      )
    }

    // Check of design code al bestaat
    const existing = await prisma.design.findUnique({ where: { designCode } })
    if (existing) {
      return NextResponse.json(
        { error: `Design code "${designCode}" is al in gebruik` },
        { status: 409 }
      )
    }

    // Upload naar Google Drive
    const buffer = Buffer.from(await file.arrayBuffer())
    const driveResult = await uploadDesignToDrive(buffer, file.name, file.type, designCode)

    // Sla design op in DB met status DRAFT (automatisch goedgekeurd)
    const design = await prisma.design.create({
      data: {
        designCode,
        designName,
        designType,
        status: 'DRAFT',
        driveFileId: driveResult.fileId,
        driveFileName: driveResult.fileName,
        collections,
        colorTags,
        inductionFriendly,
        circleFriendly,
        splashFriendly,
      },
    })

    return NextResponse.json({
      success: true,
      design: {
        id: design.id,
        designCode: design.designCode,
        designName: design.designName,
        designType: design.designType,
        status: design.status,
        driveFileId: driveResult.fileId,
        driveFileName: driveResult.fileName,
        thumbnailUrl: `https://drive.usercontent.google.com/download?id=${driveResult.fileId}&export=view`,
      },
    })
  } catch (error) {
    console.error('Upload fout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload mislukt' },
      { status: 500 }
    )
  }
}
