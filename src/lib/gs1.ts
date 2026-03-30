/**
 * GS1 NL Integration
 *
 * Authorization API: POST {GS1_BASE_URL}/authorization/token
 *   - client_id and client_secret sent as request headers
 *   - Ocp-Apim-Subscription-Key header (Azure APIM subscription key)
 *   - Returns: { access_token, expires_in, token_type, scope }
 *
 * GTIN Registration API: POST {GS1_BASE_URL}/gtin-registration-api/RegistrateGtinProducts
 *   - Bearer token in Authorization header
 *   - Ocp-Apim-Subscription-Key header (Azure APIM subscription key)
 *   - Async bulk process — we fire-and-forget per variant (non-fatal)
 *
 * Environment: set GS1_BASE_URL to switch between acceptance and production.
 *   - Acceptance: https://gs1nl-api-acc.gs1.nl (default)
 *   - Production: https://gs1nl-api.gs1.nl
 *
 * Required env vars:
 *   GS1_CLIENT_ID       — OAuth client ID (from MijnGS1 > Mijn API's > Authenticatie)
 *   GS1_CLIENT_SECRET    — OAuth client secret (created in MijnGS1)
 *   GS1_API_KEY          — Azure APIM subscription key (from GS1 developer portal)
 *   GS1_ACCOUNT_NUMBER   — GS1 account/GLN number
 *   GS1_CONTRACT_NUMBER  — GS1 contract number (e.g. 10074745)
 */

import {
  GS1_API_KEY,
  GS1_CLIENT_ID,
  GS1_CLIENT_SECRET,
  GS1_ACCOUNT_NUMBER,
  GS1_CONTRACT_NUMBER,
  GS1_BASE_URL,
} from './env'

const AUTH_URL = `${GS1_BASE_URL}/authorization/token`
const GTIN_REGISTER_URL = `${GS1_BASE_URL}/gtin-registration-api/RegistrateGtinProducts`

/** GPC categories per KitchenArt product type (validated against GS1 Reference Data) */
const GPC_BY_PRODUCT_TYPE: Record<string, string> = {
  IB: 'Snijplanken',
  SP: 'Wandbekleding - Sierobjecten',
  MC: 'Schilderijen',
}
const DEFAULT_GPC = 'Schilderijen'

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

  const authHeaders: Record<string, string> = {
    'Content-Length': '0',
    client_id: GS1_CLIENT_ID,
    client_secret: GS1_CLIENT_SECRET,
  }
  // Azure APIM subscription key (required for all GS1 API calls)
  if (GS1_API_KEY) {
    authHeaders['Ocp-Apim-Subscription-Key'] = GS1_API_KEY
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: authHeaders,
    body: '',
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
  /** Brand name (max 70 chars). Defaults to 'KitchenArt'. */
  brandName?: string
  /** Product type code (IB/SP/MC) for GPC category selection */
  productType?: string
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
  if (!GS1_CLIENT_ID || !GS1_CLIENT_SECRET || !GS1_ACCOUNT_NUMBER || !GS1_API_KEY) {
    return false
  }

  const token = await fetchAccessToken()

  const gpc = opts.productType
    ? (GPC_BY_PRODUCT_TYPE[opts.productType] ?? DEFAULT_GPC)
    : DEFAULT_GPC

  const body = {
    accountnumber: GS1_ACCOUNT_NUMBER,
    RegistrationProducts: [
      {
        Index: 1,
        // Provide the full 13-digit GTIN (API also accepts 14-digit with leading 0)
        Gtin: opts.gtin,
        Status: 'Actief',
        Gpc: gpc,
        ConsumerUnit: 'Ja',
        PackagingType: 'Envelopverpakking',
        TargetMarketCountry: 'Nederland',
        Description: opts.description.slice(0, 300),
        Language: 'Nederlands',
        BrandName: (opts.brandName ?? 'KitchenArt').slice(0, 70),
        SubBrandName: '',
        NetContent: 1,
        MeasurementUnit: 'Stuk',
        ImageUrl: '',
        ContractNumber: GS1_CONTRACT_NUMBER,
      },
    ],
  }

  const regHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  if (GS1_API_KEY) {
    regHeaders['Ocp-Apim-Subscription-Key'] = GS1_API_KEY
  }

  const res = await fetch(GTIN_REGISTER_URL, {
    method: 'POST',
    headers: regHeaders,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GS1 GTIN registration failed (${res.status}): ${text}`)
  }

  return true
}
