import { google } from 'googleapis'
import { Readable } from 'stream'
import { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID } from './env'
import sharp from 'sharp'

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  return google.drive({ version: 'v3', auth })
}

export interface DriveUploadResult {
  fileId: string
  fileName: string
  webViewLink: string
  webContentLink: string
}

export async function uploadDesignToDrive(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  designCode: string
): Promise<DriveUploadResult> {
  const drive = getDriveClient()

  // Gebruik design code als bestandsnaam zodat het herkenbaar is in Drive
  const ext = originalFileName.split('.').pop() || 'png'
  const fileName = `${designCode}.${ext}`

  const stream = Readable.from(buffer)

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, webViewLink, webContentLink',
  })

  const file = response.data

  if (!file.id) {
    throw new Error('Google Drive upload mislukt: geen file ID ontvangen')
  }

  // Maak het bestand publiek leesbaar zodat we het als afbeelding kunnen tonen
  await drive.permissions.create({
    fileId: file.id,
    supportsAllDrives: true,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  return {
    fileId: file.id,
    fileName: file.name || fileName,
    webViewLink: file.webViewLink || '',
    webContentLink: getDriveDirectUrl(file.id),
  }
}

/**
 * Returns a URL for a Drive file that can be embedded in <img> tags in the browser.
 *
 * We proxy through our own Next.js API route (/api/drive-image/{fileId}) because
 * drive.usercontent.google.com sets `cross-origin-resource-policy: same-site`,
 * which blocks cross-origin <img> loading in browsers.
 *
 * The proxy route fetches the image server-side (no CORP restriction) and
 * re-serves it with proper caching headers.
 *
 * For server-side use (e.g. Shopify image src), pass absolute=true to get the
 * full drive.usercontent.google.com URL directly.
 */
export function getDriveDirectUrl(fileId: string, absolute = false): string {
  if (absolute) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=view`
  }
  return `/api/drive-image/${fileId}`
}

export async function deleteDesignFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient()
  await drive.files.delete({ fileId, supportsAllDrives: true })
}

export interface DriveImageBase64 {
  base64: string
  mimeType: string
}

/**
 * Downloads a file from Google Drive and returns it as a base64 string.
 * Used to pass design images directly to Claude vision.
 */
export async function getFileAsBase64(fileId: string): Promise<DriveImageBase64> {
  const drive = getDriveClient()

  // First get the file metadata to know the mimeType
  const meta = await drive.files.get({
    fileId,
    fields: 'mimeType',
    supportsAllDrives: true,
  })
  const mimeType = meta.data.mimeType || 'image/png'

  // Download the file content as a stream, collect into buffer
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )

  const rawBuffer = Buffer.from(res.data as ArrayBuffer)

  // Resize to max 1500px to stay under Claude's 5MB base64 limit
  const buffer = await sharp(rawBuffer)
    .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  const base64 = buffer.toString('base64')

  return { base64, mimeType: 'image/jpeg' }
}
