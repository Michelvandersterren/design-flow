import { NextRequest, NextResponse } from 'next/server'

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || ''
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || ''
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || ''

/**
 * GET /api/shopify/oauth/callback
 * Shopify redirects here after the merchant clicks "Install".
 * We exchange the `code` for a permanent offline access token.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const hmac = searchParams.get('hmac')

  if (!code || !shop) {
    return NextResponse.json({ error: 'Missing code or shop parameter' }, { status: 400 })
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      return NextResponse.json(
        { error: `Token exchange failed: ${tokenRes.status}`, details: body },
        { status: 500 }
      )
    }

    const data = await tokenRes.json()
    const accessToken: string = data.access_token

    // Show the token clearly so it can be copied into .env
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head><title>Shopify OAuth Success</title>
<style>body{font-family:monospace;padding:40px;max-width:700px}
.token{background:#f0fdf4;border:2px solid #22c55e;padding:20px;border-radius:8px;
word-break:break-all;font-size:18px;margin:20px 0}
.warning{background:#fef9c3;border:1px solid #eab308;padding:12px;border-radius:6px;font-size:13px}
</style></head>
<body>
<h2>✅ Access token verkregen</h2>
<p>Kopieer deze token en zet hem in <code>.env</code> als <code>SHOPIFY_ACCESS_TOKEN</code>:</p>
<div class="token">${accessToken}</div>
<div class="warning">
⚠️ Sla deze token veilig op. Vernieuw de pagina niet — de token wordt maar één keer getoond.
</div>
<p>Shop: <strong>${shop}</strong></p>
<p>Scopes: <strong>${data.scope}</strong></p>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
