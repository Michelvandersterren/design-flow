/**
 * GS1 NL Integration
 *
 * Authorization API: POST https://gs1nl-api-acc.gs1.nl/authorization/token
 *   - client_id and client_secret sent as request headers
 *   - Returns: { access_token, expires_in, token_type, scope }
 *
 * GTIN Registration API: POST https://gs1nl-api-acc.gs1.nl/gtin-registration-api/RegistrateGtinProducts
 *   - Bearer token in Authorization header
 *   - Async bulk process — we fire-and-forget per variant (non-fatal)
 */

import {
  GS1_CLIENT_ID,
  GS1_CLIENT_SECRET,
  GS1_ACCOUNT_NUMBER,
  GS1_CONTRACT_NUMBER,
} from './env'

const AUTH_URL = 'https://gs1nl-api-acc.gs1.nl/authorization/token'
const GTIN_REGISTER_URL =
  'https://gs1nl-api-acc.gs1.nl/gtin-registration-api/RegistrateGtinProducts'

// ── Token cache ──────────────────────────────────────────────────────────────

interface TokenCache {
  token: string
  expiresAt: number // epoch ms
}

let tokenCache: TokenCache | null = null

async function fetchAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60 s buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      client_id: GS1_CLIENT_ID,
      client_secret: GS1_CLIENT_SECRET,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GS1 auth failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number | string
    token_type: string
    scope: string
  }

  const expiresInSec =
    typeof data.expires_in === 'string'
      ? parseInt(data.expires_in, 10)
      : data.expires_in

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
  }

  return tokenCache.token
}

// ── GTIN registration ────────────────────────────────────────────────────────

export interface RegisterGtinOptions {
  /** The 13-digit EAN/GTIN string */
  gtin: string
  /** Short product description (max 300 chars) */
  description: string
  /** Brand name (max 70 chars) */
  brandName?: string
}

/**
 * Register a single GTIN with GS1 NL.
 *
 * This call is **non-fatal** by design — callers should wrap it in try/catch
 * and not let failures block variant creation.
 *
 * Returns true on success, false when credentials are not configured
 * (so it silently skips in dev/test environments).
 */
export async function registerGtin(opts: RegisterGtinOptions): Promise<boolean> {
  // Skip silently when credentials are absent (dev / CI)
  if (!GS1_CLIENT_ID || !GS1_CLIENT_SECRET || !GS1_ACCOUNT_NUMBER) {
    return false
  }

  const token = await fetchAccessToken()

  const body = {
    accountnumber: GS1_ACCOUNT_NUMBER,
    RegistrationProducts: [
      {
        Index: 1,
        // Provide the full 13-digit GTIN (API also accepts 14-digit with leading 0)
        Gtin: opts.gtin,
        Status: 'Actief',
        // Generic GPC category — can be made configurable later
        Gpc: 'Huishoudtextiel - Overig',
        ConsumerUnit: 'Ja',
        PackagingType: 'Envelopverpakking',
        TargetMarketCountry: 'Nederland',
        Description: opts.description.slice(0, 300),
        Language: 'Nederlands',
        BrandName: (opts.brandName ?? 'Splash & Grab').slice(0, 70),
        SubBrandName: '',
        NetContent: 1,
        MeasurementUnit: 'Stuk',
        ImageUrl: '',
        ContractNumber: GS1_CONTRACT_NUMBER,
      },
    ],
  }

  const res = await fetch(GTIN_REGISTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GS1 GTIN registration failed (${res.status}): ${text}`)
  }

  return true
}
