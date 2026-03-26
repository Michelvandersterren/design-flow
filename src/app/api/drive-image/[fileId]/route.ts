import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } from '@/lib/env'

/**
 * Proxy route for Google Drive images.
 *
 * Uses the service account to download the file via the Drive API, which
 * works reliably for files in Shared Drives regardless of public permissions.
 * This also avoids cross-origin issues since the browser only talks to our origin.
 *
 * Usage: /api/drive-image/{fileId}
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params

  if (!fileId || !/^[\w-]+$/.test(fileId)) {
    return new NextResponse('Invalid fileId', { status: 400 })
  }

  try {
    const auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })

    const drive = google.drive({ version: 'v3', auth })

    // Get MIME type first
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    })
    const mimeType = meta.data.mimeType || 'image/jpeg'

    // Download file content
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )

    const buffer = Buffer.from(res.data as ArrayBuffer)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    })
  } catch (err) {
    console.error(`[drive-image] Failed to fetch fileId=${fileId}:`, err)
    return new NextResponse('Failed to fetch from Drive', { status: 502 })
  }
}
