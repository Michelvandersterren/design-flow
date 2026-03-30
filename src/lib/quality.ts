/**
 * Content quality checking logic.
 * Extracted from the review API route so it can be unit tested independently.
 */

export type Severity = 'error' | 'warning'

export interface QualityIssue {
  field: string
  severity: Severity
  message: string
  matchedWords?: string[] // words to highlight in the UI
}

export interface ContentQuality {
  language: string
  issues: QualityIssue[]
  score: number // 0-100
}

// ── Default forbidden words (NL fallback when no DB words provided) ──────────

export const FORBIDDEN_WORDS = [
  'goedkoop', 'budgetvriendelijk', 'simpel', 'standaard', 'gewoon', 'basic',
  'normaal', 'doorsnee', 'super', 'geweldig', 'fantastisch', 'waanzinnig',
  'top-kwaliteit', 'beste van de markt', 'naadloos', 'moeiteloos', 'perfect',
  'optimaal', 'ultiem',
]

export const AMPLIFIER_WORDS = ['echt', 'werkelijk', 'daadwerkelijk']

// ── Internal helpers ────────────────────────────────────────────────────────

const CONTENT_FIELD_KEYS = ['description', 'longDescription', 'seoTitle', 'seoDescription', 'googleShoppingDescription'] as const

type ContentFieldKey = typeof CONTENT_FIELD_KEYS[number]

/** Check a single text for forbidden/amplifier words, returning per-word matches. */
function findBadWords(text: string, wordList: string[], matchWholeWord: boolean): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const word of wordList) {
    if (matchWholeWord) {
      const regex = new RegExp(`\\b${word}\\b`, 'i')
      if (regex.test(lower)) found.push(word)
    } else {
      if (lower.includes(word.toLowerCase())) found.push(word)
    }
  }
  return found
}

/**
 * Parse a comma-separated doNotUse string from the brand voice DB into a word list.
 * Strips parenthetical notes like "kleurrijk (te algemeen)" → "kleurrijk".
 */
export function parseDoNotUseWords(doNotUse: string | null | undefined): string[] {
  if (!doNotUse || !doNotUse.trim()) return []
  return doNotUse
    .split(',')
    .map((w) => w.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase())
    .filter((w) => w.length > 0)
}

// ── Quality check logic ─────────────────────────────────────────────────────

export interface ContentInput {
  language: string
  description: string | null
  longDescription: string | null
  seoTitle: string | null
  seoDescription: string | null
  googleShoppingDescription: string | null
}

export interface CheckContentOptions {
  /** Comma-separated forbidden words from the brand voice DB for this language. */
  doNotUseWords?: string | null
}

export function checkContent(content: ContentInput, options?: CheckContentOptions): ContentQuality {
  const issues: QualityIssue[] = []
  let deductions = 0

  const { language, description, longDescription, seoTitle, seoDescription, googleShoppingDescription } = content

  // SEO Title checks
  if (!seoTitle || seoTitle.trim() === '') {
    issues.push({ field: 'seoTitle', severity: 'error', message: 'SEO titel ontbreekt' })
    deductions += 20
  } else {
    if (seoTitle.length > 60) {
      issues.push({ field: 'seoTitle', severity: 'warning', message: `SEO titel te lang: ${seoTitle.length}/60 tekens` })
      deductions += 5
    }
    if (seoTitle.length < 20) {
      issues.push({ field: 'seoTitle', severity: 'warning', message: `SEO titel te kort: ${seoTitle.length} tekens (min 20)` })
      deductions += 5
    }
    if (language === 'nl' && !seoTitle.toLowerCase().includes('kitchenart')) {
      issues.push({ field: 'seoTitle', severity: 'warning', message: 'SEO titel bevat niet "KitchenArt"' })
      deductions += 3
    }
  }

  // SEO Description checks
  if (!seoDescription || seoDescription.trim() === '') {
    issues.push({ field: 'seoDescription', severity: 'error', message: 'SEO beschrijving ontbreekt' })
    deductions += 20
  } else {
    if (seoDescription.length > 160) {
      issues.push({ field: 'seoDescription', severity: 'warning', message: `SEO beschrijving te lang: ${seoDescription.length}/160 tekens` })
      deductions += 5
    }
    if (seoDescription.length < 50) {
      issues.push({ field: 'seoDescription', severity: 'warning', message: `SEO beschrijving te kort: ${seoDescription.length} tekens (min 50)` })
      deductions += 5
    }
  }

  // Description checks
  if (!description || description.trim() === '') {
    issues.push({ field: 'description', severity: 'error', message: 'Korte beschrijving ontbreekt' })
    deductions += 15
  }

  // Long description checks
  if (!longDescription || longDescription.trim() === '') {
    issues.push({ field: 'longDescription', severity: 'warning', message: 'Lange beschrijving ontbreekt' })
    deductions += 10
  }

  // Google Shopping description checks
  if (!googleShoppingDescription || googleShoppingDescription.trim() === '') {
    issues.push({ field: 'googleShoppingDescription', severity: 'warning', message: 'Google Shopping beschrijving ontbreekt' })
    deductions += 10
  } else {
    const len = googleShoppingDescription.length
    if (len < 300) {
      issues.push({ field: 'googleShoppingDescription', severity: 'warning', message: `Google Shopping te kort: ${len} tekens (min 300)` })
      deductions += 5
    }
    if (len > 500) {
      issues.push({ field: 'googleShoppingDescription', severity: 'warning', message: `Google Shopping te lang: ${len} tekens (max 500)` })
      deductions += 3
    }
  }

  // ── Per-field brand voice checks ──────────────────────────────────────

  // Build a map of field -> text for per-field checks
  const fieldTexts: Record<ContentFieldKey, string | null> = {
    description,
    longDescription,
    seoTitle,
    seoDescription,
    googleShoppingDescription,
  }

  // Determine which forbidden words to check:
  // - If doNotUseWords is provided from DB, use those (works for any language)
  // - Otherwise, use hardcoded FORBIDDEN_WORDS (NL only, backward compatible)
  const hasDbWords = options?.doNotUseWords != null && options.doNotUseWords.trim() !== ''
  const forbiddenWordList = hasDbWords
    ? parseDoNotUseWords(options.doNotUseWords)
    : (language === 'nl' ? FORBIDDEN_WORDS : [])

  // Amplifier words are NL-specific concepts, always use hardcoded list
  const amplifierWordList = language === 'nl' ? AMPLIFIER_WORDS : []

  // Track which words have already been reported (deduct score only once per word)
  const reportedForbidden = new Set<string>()
  const reportedAmplifiers = new Set<string>()
  let exclamationReported = false
  let emDashReported = false

  for (const fieldKey of CONTENT_FIELD_KEYS) {
    const text = fieldTexts[fieldKey]
    if (!text) continue

    // Forbidden words
    if (forbiddenWordList.length > 0) {
      const forbidden = findBadWords(text, forbiddenWordList, false)
      if (forbidden.length > 0) {
        issues.push({
          field: fieldKey,
          severity: 'warning',
          message: `Verboden woord${forbidden.length > 1 ? 'en' : ''}: ${forbidden.map((w) => `"${w}"`).join(', ')}`,
          matchedWords: forbidden,
        })
        for (const w of forbidden) {
          if (!reportedForbidden.has(w)) {
            deductions += 5
            reportedForbidden.add(w)
          }
        }
      }
    }

    // Amplifier words (NL only)
    if (amplifierWordList.length > 0) {
      const amplifiers = findBadWords(text, amplifierWordList, true)
      if (amplifiers.length > 0) {
        issues.push({
          field: fieldKey,
          severity: 'warning',
          message: `Versterker-woord${amplifiers.length > 1 ? 'en' : ''}: ${amplifiers.map((w) => `"${w}"`).join(', ')} (vermijden)`,
          matchedWords: amplifiers,
        })
        for (const w of amplifiers) {
          if (!reportedAmplifiers.has(w)) {
            deductions += 3
            reportedAmplifiers.add(w)
          }
        }
      }
    }

    // Exclamation marks (NL only)
    if (language === 'nl' && text.includes('!') && !exclamationReported) {
      issues.push({ field: fieldKey, severity: 'warning', message: 'Uitroepteken gevonden (vermijden in brand voice)' })
      deductions += 3
      exclamationReported = true
    }

    // Em-dashes (all languages)
    if (text.includes('\u2014') && !emDashReported) {
      issues.push({ field: fieldKey, severity: 'warning', message: 'Em-dash (\u2014) gevonden (vermijden)', matchedWords: ['\u2014'] })
      deductions += 3
      emDashReported = true
    }
  }

  // Rhetorical question at start of description (NL only)
  if (language === 'nl' && description && /^(wil|wist|heb|ben|zou|ken|heeft)\s/i.test(description.trim())) {
    issues.push({ field: 'description', severity: 'warning', message: 'Beschrijving begint met retorische vraag (vermijden)' })
    deductions += 3
  }

  const score = Math.max(0, Math.min(100, 100 - deductions))
  return { language, issues, score }
}
