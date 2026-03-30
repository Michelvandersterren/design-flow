import { describe, it, expect } from 'vitest'
import {
  checkContent,
  FORBIDDEN_WORDS,
  AMPLIFIER_WORDS,
  type ContentInput,
} from '@/lib/quality'

// Helper to create a valid NL content object with all fields filled
function validNlContent(overrides?: Partial<ContentInput>): ContentInput {
  return {
    language: 'nl',
    description: 'Een stijlvolle inductiebeschermer met een uniek design.',
    longDescription: 'Deze inductiebeschermer combineert functionaliteit met een prachtig design. Gemaakt van hoogwaardig vinyl, beschermt het je kookplaat tegen krassen en vuil. Het design is gekozen om bij elke keukeninrichting te passen.',
    seoTitle: 'Marble Dream | Inductiebeschermer | KitchenArt',
    seoDescription: 'Ontdek de Marble Dream inductiebeschermer bij KitchenArt. Bescherm je kookplaat met stijl en kies uit diverse maten.',
    googleShoppingDescription: 'Marble Dream inductiebeschermer van KitchenArt. Gemaakt van hoogwaardig vinyl (2mm dik), anti-slip, waterafstotend en brandvertragend (B1-classificatie). Beschikbaar in diverse maten passend bij alle gangbare inductiekookplaten. Op bestelling gemaakt, levertijd 1-3 werkdagen. Geschikt voor dagelijks gebruik in elke keuken, eenvoudig schoon te maken met een vochtige doek.',
    ...overrides,
  }
}

function validDeContent(overrides?: Partial<ContentInput>): ContentInput {
  return {
    language: 'de',
    description: 'Ein stilvoller Induktionsschutz mit einem einzigartigen Design.',
    longDescription: 'Dieser Induktionsschutz kombiniert Funktionalitat mit einem wunderschonen Design.',
    seoTitle: 'Marble Dream | Induktionsschutz | KitchenArt',
    seoDescription: 'Entdecken Sie den Marble Dream Induktionsschutz bei KitchenArt. Schutzen Sie Ihr Kochfeld mit Stil.',
    googleShoppingDescription: 'Marble Dream Induktionsschutz von KitchenArt. Hergestellt aus hochwertigem Vinyl (2mm dick), rutschfest, wasserabweisend und schwer entflammbar (B1-Klassifizierung). In verschiedenen Grossen erhaltlich passend fuer alle gaengigen Induktionskochfelder. Auf Bestellung gefertigt, Lieferzeit 1-3 Werktage. Geeignet fuer den taeglichen Gebrauch in jeder Kueche.',
    ...overrides,
  }
}

describe('checkContent', () => {
  describe('perfect content', () => {
    it('should score 100 for valid NL content with all fields', () => {
      const result = checkContent(validNlContent())
      expect(result.score).toBe(100)
      expect(result.issues).toHaveLength(0)
    })

    it('should score 100 for valid DE content with all fields', () => {
      const result = checkContent(validDeContent())
      expect(result.score).toBe(100)
      expect(result.issues).toHaveLength(0)
    })
  })

  describe('missing fields', () => {
    it('should deduct 20 for missing SEO title', () => {
      const result = checkContent(validNlContent({ seoTitle: null }))
      expect(result.score).toBeLessThanOrEqual(80)
      expect(result.issues.some((i) => i.field === 'seoTitle' && i.severity === 'error')).toBe(true)
    })

    it('should deduct 20 for empty SEO title', () => {
      const result = checkContent(validNlContent({ seoTitle: '   ' }))
      expect(result.issues.some((i) => i.field === 'seoTitle' && i.severity === 'error')).toBe(true)
    })

    it('should deduct 20 for missing SEO description', () => {
      const result = checkContent(validNlContent({ seoDescription: null }))
      expect(result.score).toBeLessThanOrEqual(80)
      expect(result.issues.some((i) => i.field === 'seoDescription' && i.severity === 'error')).toBe(true)
    })

    it('should deduct 15 for missing description', () => {
      const result = checkContent(validNlContent({ description: null }))
      expect(result.score).toBeLessThanOrEqual(85)
      expect(result.issues.some((i) => i.field === 'description' && i.severity === 'error')).toBe(true)
    })

    it('should deduct 10 for missing long description', () => {
      const result = checkContent(validNlContent({ longDescription: null }))
      expect(result.score).toBeLessThanOrEqual(90)
      expect(result.issues.some((i) => i.field === 'longDescription')).toBe(true)
    })

    it('should deduct 10 for missing Google Shopping description', () => {
      const result = checkContent(validNlContent({ googleShoppingDescription: null }))
      expect(result.score).toBeLessThanOrEqual(90)
      expect(result.issues.some((i) => i.field === 'googleShoppingDescription')).toBe(true)
    })

    it('should have very low score when all fields are missing', () => {
      const result = checkContent({
        language: 'nl',
        description: null,
        longDescription: null,
        seoTitle: null,
        seoDescription: null,
        googleShoppingDescription: null,
      })
      // 20 (seoTitle) + 20 (seoDescription) + 15 (description) + 10 (longDescription) + 10 (googleShopping) = 75 deductions
      expect(result.score).toBe(25)
      expect(result.issues.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('SEO title length', () => {
    it('should warn when SEO title exceeds 60 chars', () => {
      const result = checkContent(validNlContent({
        seoTitle: 'A'.repeat(61) + ' KitchenArt',
      }))
      expect(result.issues.some((i) => i.field === 'seoTitle' && i.message.includes('te lang'))).toBe(true)
    })

    it('should warn when SEO title is shorter than 20 chars', () => {
      const result = checkContent(validNlContent({
        seoTitle: 'KitchenArt',
      }))
      expect(result.issues.some((i) => i.field === 'seoTitle' && i.message.includes('te kort'))).toBe(true)
    })

    it('should not warn for SEO title between 20 and 60 chars', () => {
      const result = checkContent(validNlContent({
        seoTitle: 'Marble Dream | Inductie | KitchenArt',
      }))
      const titleIssues = result.issues.filter((i) => i.field === 'seoTitle')
      expect(titleIssues).toHaveLength(0)
    })
  })

  describe('NL-specific: KitchenArt in SEO title', () => {
    it('should warn if NL SEO title does not contain KitchenArt', () => {
      const result = checkContent(validNlContent({
        seoTitle: 'Marble Dream | Inductiebeschermer',
      }))
      expect(result.issues.some((i) => i.message.includes('KitchenArt'))).toBe(true)
    })

    it('should not warn for DE content without KitchenArt', () => {
      const result = checkContent(validDeContent({
        seoTitle: 'Marble Dream | Induktionsschutz',
      }))
      // DE content should not trigger KitchenArt warning
      expect(result.issues.some((i) => i.message.includes('KitchenArt'))).toBe(false)
    })
  })

  describe('SEO description length', () => {
    it('should warn when SEO description exceeds 160 chars', () => {
      const result = checkContent(validNlContent({
        seoDescription: 'A'.repeat(161),
      }))
      expect(result.issues.some((i) => i.field === 'seoDescription' && i.message.includes('te lang'))).toBe(true)
    })

    it('should warn when SEO description is shorter than 50 chars', () => {
      const result = checkContent(validNlContent({
        seoDescription: 'Korte tekst.',
      }))
      expect(result.issues.some((i) => i.field === 'seoDescription' && i.message.includes('te kort'))).toBe(true)
    })
  })

  describe('Google Shopping description length', () => {
    it('should warn when too short (< 300 chars)', () => {
      const result = checkContent(validNlContent({
        googleShoppingDescription: 'Te korte Google Shopping tekst.',
      }))
      expect(result.issues.some((i) => i.field === 'googleShoppingDescription' && i.message.includes('te kort'))).toBe(true)
    })

    it('should warn when too long (> 500 chars)', () => {
      const result = checkContent(validNlContent({
        googleShoppingDescription: 'A'.repeat(501),
      }))
      expect(result.issues.some((i) => i.field === 'googleShoppingDescription' && i.message.includes('te lang'))).toBe(true)
    })

    it('should not warn when between 300-500 chars', () => {
      const result = checkContent(validNlContent({
        googleShoppingDescription: 'A'.repeat(400),
      }))
      const gsIssues = result.issues.filter((i) => i.field === 'googleShoppingDescription')
      expect(gsIssues).toHaveLength(0)
    })
  })

  describe('forbidden words (NL only)', () => {
    it.each(FORBIDDEN_WORDS)('should detect forbidden word "%s"', (word) => {
      const result = checkContent(validNlContent({
        description: `Dit is een ${word} product.`,
      }))
      expect(result.issues.some((i) => i.message.includes(word))).toBe(true)
    })

    it('should not flag forbidden words in DE content', () => {
      const result = checkContent(validDeContent({
        description: 'Dit is een goedkoop product.',
      }))
      // DE content should not check for NL forbidden words
      expect(result.issues.some((i) => i.message.includes('goedkoop'))).toBe(false)
    })
  })

  describe('amplifier words (NL only)', () => {
    it.each(AMPLIFIER_WORDS)('should detect amplifier word "%s"', (word) => {
      const result = checkContent(validNlContent({
        longDescription: `Dit product is ${word} mooi.`,
      }))
      expect(result.issues.some((i) => i.message.includes(word))).toBe(true)
    })
  })

  describe('exclamation marks (NL only)', () => {
    it('should warn about exclamation marks in NL content', () => {
      const result = checkContent(validNlContent({
        description: 'Geweldige keuken accessoire!',
      }))
      // "geweldige" is forbidden too, but check specifically for exclamation
      expect(result.issues.some((i) => i.message.includes('Uitroepteken'))).toBe(true)
    })

    it('should not warn about exclamation marks in DE content', () => {
      const result = checkContent(validDeContent({
        description: 'Tolles Kuchenzubehor!',
      }))
      expect(result.issues.some((i) => i.message.includes('Uitroepteken'))).toBe(false)
    })
  })

  describe('rhetorical questions', () => {
    it('should warn when NL description starts with rhetorical question', () => {
      const starters = ['Wil', 'Wist', 'Heb', 'Ben', 'Zou', 'Ken', 'Heeft']
      for (const starter of starters) {
        const result = checkContent(validNlContent({
          description: `${starter} je een mooie keuken?`,
        }))
        expect(
          result.issues.some((i) => i.message.includes('retorische vraag')),
          `Should detect rhetorical question starting with "${starter}"`
        ).toBe(true)
      }
    })

    it('should not warn if question word is not at start', () => {
      const result = checkContent(validNlContent({
        description: 'Een product dat wil je zeker hebben.',
      }))
      expect(result.issues.some((i) => i.message.includes('retorische vraag'))).toBe(false)
    })
  })

  describe('em-dashes', () => {
    it('should detect em-dashes in any language', () => {
      const nlResult = checkContent(validNlContent({
        description: 'Een stijlvol design — perfect voor elke keuken.',
      }))
      expect(nlResult.issues.some((i) => i.message.includes('Em-dash'))).toBe(true)

      const deResult = checkContent(validDeContent({
        description: 'Ein stilvolles Design — perfekt fur jede Kuche.',
      }))
      expect(deResult.issues.some((i) => i.message.includes('Em-dash'))).toBe(true)
    })

    it('should not flag en-dashes', () => {
      const result = checkContent(validNlContent({
        description: 'Marble Dream – een prachtig design.',
      }))
      expect(result.issues.some((i) => i.message.includes('Em-dash'))).toBe(false)
    })
  })

  describe('scoring', () => {
    it('score should never go below 0', () => {
      // Stack many issues
      const result = checkContent({
        language: 'nl',
        description: 'Wil je een goedkoop simpel basic normaal standaard gewoon doorsnee product!',
        longDescription: null,
        seoTitle: null,
        seoDescription: null,
        googleShoppingDescription: null,
      })
      expect(result.score).toBeGreaterThanOrEqual(0)
    })

    it('score should never exceed 100', () => {
      const result = checkContent(validNlContent())
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })
})
