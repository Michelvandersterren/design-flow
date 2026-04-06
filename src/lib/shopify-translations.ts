/**
 * Shopify Translations API (GraphQL)
 *
 * Pushes translated content (DE / EN / FR) to Shopify using the
 * Admin GraphQL API's `translationsRegister` mutation.
 *
 * Shopify locale codes: nl → nl (default, no push needed)
 *                       de → de
 *                       en → en
 *                       fr → fr
 *
 * Fields pushed per locale:
 *   - Product: title, body_html
 *   - Metafield custom.product_information: value
 *   - Metafield custom.marketplace_description: value
 *   - Metafield global.title_tag: value
 *   - Metafield global.description_tag: value
 *   - Metafield custom.google_description: value
 *   - Metafield custom.infographic_1: value (file_reference — Shopify File GID)
 *   - Metafield custom.infographic_2: value (file_reference — Shopify File GID)
 */

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || ''
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-04'

// Shopify language codes: our DB language → Shopify locale
const LOCALE_MAP: Record<string, string> = {
  de: 'de',
  en: 'en',
  fr: 'fr',
}

async function shopifyGraphQL(query: string, variables: Record<string, unknown> = {}) {
  const url = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify GraphQL error ${response.status}: ${body}`)
  }

  const data = await response.json()
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
  }
  return data
}

/**
 * Convert plain-text paragraphs to HTML for Shopify body_html.
 */
function toBodyHtml(text: string | null): string {
  if (!text) return ''
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

/**
 * Fetch all metafields for a product (via GraphQL) and return a map of
 * "namespace.key" → { id (GID), digest }.
 * The digest is required for the translationsRegister mutation.
 */
async function getProductMetafields(
  shopifyProductGid: string
): Promise<Map<string, { id: string; digest: string | null }>> {
  const query = `
    query GetProductMetafields($id: ID!) {
      product(id: $id) {
        metafields(first: 50) {
          edges {
            node {
              id
              namespace
              key
              value
            }
          }
        }
      }
    }
  `
  const data = await shopifyGraphQL(query, { id: shopifyProductGid })
  const map = new Map<string, { id: string; digest: string | null }>()
  for (const edge of data.data?.product?.metafields?.edges ?? []) {
    const node = edge.node
    map.set(`${node.namespace}.${node.key}`, { id: node.id, digest: null })
  }
  return map
}

/**
 * Push translations for one language to Shopify.
 *
 * @param shopifyProductId  Numeric Shopify product ID (string)
 * @param language          Our DB language code ('de' | 'en' | 'fr')
 * @param content           Translated content object from DB
 * @param metafieldMap      Map of "namespace.key" → GID from getProductMetafields()
 */
async function pushTranslationsForLocale(
  shopifyProductId: string,
  language: string,
  content: {
    description: string | null
    longDescription: string | null
    seoTitle: string | null
    seoDescription: string | null
    googleShoppingDescription: string | null
  },
  metafieldMap: Map<string, { id: string; digest: string | null }>
) {
  const locale = LOCALE_MAP[language]
  if (!locale) return

  const productGid = `gid://shopify/Product/${shopifyProductId}`

  // Build translations array for the product itself
  type Translation = { key: string; value: string; locale: string; translatableContentDigest: string }
  const translations: Translation[] = []

  // We need the translatableContentDigest for each field.
  // Fetch it via translatableResource query.
  const digestQuery = `
    query GetTranslatableResource($id: ID!) {
      translatableResource(resourceId: $id) {
        translatableContent {
          key
          value
          digest
          locale
        }
      }
    }
  `
  const digestData = await shopifyGraphQL(digestQuery, { id: productGid })
  const translatableContent: { key: string; value: string; digest: string; locale: string }[] =
    digestData.data?.translatableResource?.translatableContent ?? []

  const digestMap = new Map(translatableContent.map((c) => [c.key, c.digest]))

  // body_html (short description)
  const bodyDigest = digestMap.get('body_html')

  if (bodyDigest && content.description) {
    translations.push({
      key: 'body_html',
      value: toBodyHtml(content.description),
      locale,
      translatableContentDigest: bodyDigest,
    })
  }

  // Metafield translations
  const metafieldTranslations: Array<{ gid: string; key: string; value: string; digest: string }> = []

  const addMetafieldTranslation = async (
    namespaceKey: string,
    value: string | null,
    contentKey: string
  ) => {
    if (!value) return
    const entry = metafieldMap.get(namespaceKey)
    if (!entry) return

    // Fetch metafield translatable digest
    const mfDigestData = await shopifyGraphQL(digestQuery, { id: entry.id })
    const mfContent: { key: string; digest: string }[] =
      mfDigestData.data?.translatableResource?.translatableContent ?? []
    const mfDigest = mfContent.find((c) => c.key === contentKey || c.key === 'value')?.digest
    if (mfDigest) {
      metafieldTranslations.push({ gid: entry.id, key: 'value', value, digest: mfDigest })
    }
  }

  // Fetch all metafield digests in parallel (was 5 sequential GraphQL calls)
  await Promise.all([
    addMetafieldTranslation('custom.product_information',      content.description,                   'value'),
    addMetafieldTranslation('custom.marketplace_description',  toBodyHtml(content.longDescription),   'value'),
    addMetafieldTranslation('custom.long_description',         content.longDescription,               'value'),
    addMetafieldTranslation('global.title_tag',                content.seoTitle,                      'value'),
    addMetafieldTranslation('global.description_tag',          content.seoDescription,                'value'),
    addMetafieldTranslation('custom.google_description',       content.googleShoppingDescription,     'value'),
  ])

  // Register product-level translations
  if (translations.length > 0) {
    const mutation = `
      mutation RegisterTranslations($resourceId: ID!, $translations: [TranslationInput!]!) {
        translationsRegister(resourceId: $resourceId, translations: $translations) {
          translations { key locale value }
          userErrors { field message }
        }
      }
    `
    await shopifyGraphQL(mutation, { resourceId: productGid, translations })
  }

  // Register metafield translations in parallel (was sequential one-by-one)
  if (metafieldTranslations.length > 0) {
    const mutation = `
      mutation RegisterTranslations($resourceId: ID!, $translations: [TranslationInput!]!) {
        translationsRegister(resourceId: $resourceId, translations: $translations) {
          translations { key locale value }
          userErrors { field message }
        }
      }
    `
    await Promise.all(
      metafieldTranslations.map((mft) =>
        shopifyGraphQL(mutation, {
          resourceId: mft.gid,
          translations: [
            {
              key: mft.key,
              value: mft.value,
              locale,
              translatableContentDigest: mft.digest,
            },
          ],
        })
      )
    )
  }
}

/**
 * Push all available translations (DE / EN / FR) to Shopify for a given design.
 *
 * @param designId          Internal design ID
 * @param shopifyProductId  Numeric Shopify product ID (string)
 * @param content           All content rows for the design (from DB)
 */
export async function pushTranslationsToShopify(
  shopifyProductId: string,
  translatedContent: Array<{
    language: string
    description: string | null
    longDescription: string | null
    seoTitle: string | null
    seoDescription: string | null
    googleShoppingDescription: string | null
  }>
): Promise<{ pushed: string[]; errors: Record<string, string> }> {
  const productGid = `gid://shopify/Product/${shopifyProductId}`

  // Get metafield GIDs once
  let metafieldMap: Map<string, { id: string; digest: string | null }>
  try {
    metafieldMap = await getProductMetafields(productGid)
  } catch {
    metafieldMap = new Map()
  }

  const pushed: string[] = []
  const errors: Record<string, string> = {}

  // Push all locales in parallel (was sequential for-loop)
  const localeContents = translatedContent.filter((c) => LOCALE_MAP[c.language])
  const results = await Promise.allSettled(
    localeContents.map(async (content) => {
      await pushTranslationsForLocale(shopifyProductId, content.language, content, metafieldMap)
      return content.language
    })
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const lang = localeContents[i].language
    if (result.status === 'fulfilled') {
      pushed.push(lang)
    } else {
      errors[lang] = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.error(`Translation push failed for ${lang}:`, result.reason)
    }
  }

  return { pushed, errors }
}

/**
 * Infographic translation entry: maps a metafield key + language to a Shopify File GID.
 */
export type InfographicTranslationEntry = {
  metafieldKey: string      // 'infographic_1', 'infographic_2', 'infographic_3', etc.
  language: string          // 'de' | 'en' | 'fr'
  shopifyFileGid: string    // e.g. "gid://shopify/MediaImage/123456"
}

/**
 * Push file_reference translations for infographic metafields.
 *
 * For each infographic metafield (custom.infographic_1 / _2 / _3),
 * register the translated Shopify File GID as the value for each locale.
 *
 * The NL value is already set as the default metafield value (pointing to the
 * product image). This function pushes the DE/EN/FR overrides.
 *
 * @param shopifyProductId      Numeric Shopify product ID (string)
 * @param infographicTranslations  Array of { metafieldKey, language, shopifyFileGid }
 */
export async function pushInfographicTranslations(
  shopifyProductId: string,
  infographicTranslations: InfographicTranslationEntry[]
): Promise<{ pushed: number; errors: string[] }> {
  if (infographicTranslations.length === 0) {
    return { pushed: 0, errors: [] }
  }

  const productGid = `gid://shopify/Product/${shopifyProductId}`
  const errors: string[] = []
  let pushed = 0

  // Get metafield GIDs for custom.infographic_1 and custom.infographic_2
  let metafieldMap: Map<string, { id: string; digest: string | null }>
  try {
    metafieldMap = await getProductMetafields(productGid)
  } catch {
    return { pushed: 0, errors: ['Failed to fetch metafield GIDs'] }
  }

  const digestQuery = `
    query GetTranslatableResource($id: ID!) {
      translatableResource(resourceId: $id) {
        translatableContent {
          key
          value
          digest
          locale
        }
      }
    }
  `

  const translationMutation = `
    mutation RegisterTranslations($resourceId: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $resourceId, translations: $translations) {
        translations { key locale value }
        userErrors { field message }
      }
    }
  `

  // Group translations by metafieldKey to minimize API calls
  const byMetafield = new Map<string, InfographicTranslationEntry[]>()
  for (const t of infographicTranslations) {
    const existing = byMetafield.get(t.metafieldKey) ?? []
    existing.push(t)
    byMetafield.set(t.metafieldKey, existing)
  }

  for (const [metafieldKey, translations] of byMetafield) {
    const entry = metafieldMap.get(`custom.${metafieldKey}`)
    if (!entry) {
      errors.push(`Metafield custom.${metafieldKey} not found on product`)
      continue
    }

    // Fetch the translatable content digest for this metafield
    let mfDigest: string | undefined
    try {
      const mfDigestData = await shopifyGraphQL(digestQuery, { id: entry.id })
      const mfContent: { key: string; digest: string }[] =
        mfDigestData.data?.translatableResource?.translatableContent ?? []
      mfDigest = mfContent.find((c) => c.key === 'value')?.digest
    } catch (err) {
      errors.push(`Failed to fetch digest for custom.${metafieldKey}: ${err}`)
      continue
    }

    if (!mfDigest) {
      errors.push(`No translatable digest found for custom.${metafieldKey}`)
      continue
    }

    // Push all locale translations for this metafield in parallel
    const results = await Promise.allSettled(
      translations.map(async (t) => {
        const locale = LOCALE_MAP[t.language]
        if (!locale) throw new Error(`Unknown locale: ${t.language}`)

        const result = await shopifyGraphQL(translationMutation, {
          resourceId: entry.id,
          translations: [{
            key: 'value',
            value: t.shopifyFileGid,
            locale,
            translatableContentDigest: mfDigest!,
          }],
        })

        // Check for userErrors from the translationsRegister mutation
        const userErrors = result.data?.translationsRegister?.userErrors ?? []
        if (userErrors.length > 0) {
          const errMsg = userErrors.map((e: { message: string }) => e.message).join('; ')
          throw new Error(`translationsRegister userErrors: ${errMsg}`)
        }

        console.log(`[InfographicTranslations] Pushed ${t.metafieldKey} (${t.language}) → ${t.shopifyFileGid}`)
        return t.language
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        pushed++
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
        errors.push(`${metafieldKey}: ${msg}`)
      }
    }
  }

  return { pushed, errors }
}
