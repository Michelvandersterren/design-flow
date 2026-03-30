/**
 * Content quality checking logic.
 * Extracted from the review API route so it can be unit tested independently.
 */

export type Severity = 'error' | 'warning'

export interface QualityIssue {
  field: string
  severity: Severity
  message: string
}

export interface ContentQuality {
  language: string
  issues: QualityIssue[]
  score: number // 0-100
}

// ── Forbidden words (from brand voice guidelines) ───────────────────────────

export const FORBIDDEN_WORDS = [
  'goedkoop', 'budgetvriendelijk', 'simpel', 'standaard', 'gewoon', 'basic',
  'normaal', 'doorsnee', 'super', 'geweldig', 'fantastisch', 'waanzinnig',
  'top-kwaliteit', 'beste van de markt', 'naadloos', 'moeiteloos', 'perfect',
  'optimaal', 'ultiem',
]

export const AMPLIFIER_WORDS = ['echt', 'werkelijk', 'daadwerkelijk']

// ── Quality check logic ─────────────────────────────────────────────────────

export interface ContentInput {
  language: string
  description: string | null
  longDescription: string | null
  seoTitle: string | null
  seoDescription: string | null
  googleShoppingDescription: string | null
}

export function checkContent(content: ContentInput): ContentQuality {
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

  // Brand voice checks (only for NL content)
  if (language === 'nl') {
    const allText = [description, longDescription, seoDescription, googleShoppingDescription]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    // Check forbidden words
    for (const word of FORBIDDEN_WORDS) {
      if (allText.includes(word.toLowerCase())) {
        issues.push({ field: 'general', severity: 'warning', message: `Verboden woord gevonden: "${word}"` })
        deductions += 5
      }
    }

    // Check amplifier words
    for (const word of AMPLIFIER_WORDS) {
      // Match as standalone word
      const regex = new RegExp(`\\b${word}\\b`, 'i')
      if (regex.test(allText)) {
        issues.push({ field: 'general', severity: 'warning', message: `Versterker-woord gevonden: "${word}" (vermijden)` })
        deductions += 3
      }
    }

    // Check for exclamation marks
    if (allText.includes('!')) {
      issues.push({ field: 'general', severity: 'warning', message: 'Uitroepteken gevonden (vermijden in brand voice)' })
      deductions += 3
    }

    // Check for rhetorical questions at start
    if (description && /^(wil|wist|heb|ben|zou|ken|heeft)\s/i.test(description.trim())) {
      issues.push({ field: 'description', severity: 'warning', message: 'Beschrijving begint met retorische vraag (vermijden)' })
      deductions += 3
    }
  }

  // Check for em-dashes in all languages
  const allText = [description, longDescription, seoDescription, googleShoppingDescription]
    .filter(Boolean)
    .join(' ')
  if (allText.includes('—')) {
    issues.push({ field: 'general', severity: 'warning', message: 'Em-dash (—) gevonden (vermijden)' })
    deductions += 3
  }

  const score = Math.max(0, Math.min(100, 100 - deductions))
  return { language, issues, score }
}
