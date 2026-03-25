import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy route for Google Drive images.
 *
 * drive.usercontent.google.com returns `cross-origin-resource-policy: same-site`
 * which blocks <img> tags on a different origin (e.g. localhost:3000) from loading
 * the image. By proxying through this Next.js route the browser only talks to our
 * own origin, so there is no cross-origin restriction.
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

  const driveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=view`

  let upstream: Response
  try {
    upstream = await fetch(driveUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: {
        // Pass a browser-like User-Agent so Google doesn't block the server request
        'User-Agent': 'Mozilla/5.0 (compatible; design-flow-proxy/1.0)',
      },
    })
  } catch (err) {
    return new NextResponse('Failed to fetch from Drive', { status: 502 })
  }

  if (!upstream.ok) {
    return new NextResponse(`Drive returned ${upstream.status}`, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg'

  // If Drive returns HTML (e.g. virus scan warning page), return 502
  if (contentType.includes('text/html')) {
    return new NextResponse('Drive returned HTML instead of image — file may require login or is too large', { status: 502 })
  }

  const body = await upstream.arrayBuffer()

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Cache for 1 hour in the browser, 24 hours on CDN/proxy
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
