/**
 * Migration script: Copy existing BrandVoice fields to _nl variants.
 *
 * Run with: npx tsx scripts/migrate-brand-voice-i18n.ts
 *
 * This script:
 * 1. Reads the current BrandVoice record (key='main')
 * 2. Copies doNotUse → doNotUse_nl, seoKeywords* → seoKeywords*_nl, etc.
 * 3. Writes the _nl fields back to the database
 *
 * Safe to run multiple times (idempotent).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const bv = await prisma.brandVoice.findUnique({ where: { key: 'main' } })
  if (!bv) {
    console.log('No brand voice record found — nothing to migrate.')
    return
  }

  // Read old fields via raw query (they may still exist in SQLite even after schema change)
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT doNotUse, seoKeywordsIB, seoKeywordsMC, seoKeywordsSP,
           exampleDescriptionIB, exampleDescriptionMC, exampleDescriptionSP
    FROM BrandVoice WHERE key = 'main'
  `
  const old = rows[0]
  if (!old) {
    console.log('No brand voice row found via raw query.')
    return
  }

  const updates: Record<string, string | null> = {}

  // Only copy if the _nl field is currently empty (don't overwrite existing data)
  if (!bv.doNotUse_nl && old.doNotUse) updates.doNotUse_nl = old.doNotUse as string
  if (!bv.seoKeywordsIB_nl && old.seoKeywordsIB) updates.seoKeywordsIB_nl = old.seoKeywordsIB as string
  if (!bv.seoKeywordsMC_nl && old.seoKeywordsMC) updates.seoKeywordsMC_nl = old.seoKeywordsMC as string
  if (!bv.seoKeywordsSP_nl && old.seoKeywordsSP) updates.seoKeywordsSP_nl = old.seoKeywordsSP as string
  if (!bv.exampleDescriptionIB_nl && old.exampleDescriptionIB) updates.exampleDescriptionIB_nl = old.exampleDescriptionIB as string
  if (!bv.exampleDescriptionMC_nl && old.exampleDescriptionMC) updates.exampleDescriptionMC_nl = old.exampleDescriptionMC as string
  if (!bv.exampleDescriptionSP_nl && old.exampleDescriptionSP) updates.exampleDescriptionSP_nl = old.exampleDescriptionSP as string

  if (Object.keys(updates).length === 0) {
    console.log('All _nl fields already populated or old fields empty — nothing to migrate.')
    return
  }

  await prisma.brandVoice.update({
    where: { key: 'main' },
    data: updates,
  })

  console.log(`Migrated ${Object.keys(updates).length} fields to _nl variants:`)
  for (const [key, val] of Object.entries(updates)) {
    console.log(`  ${key}: ${(val as string).substring(0, 60)}...`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
