# Design Flow — Print-on-Demand Product Workflow System

## Overview

Full end-to-end pipeline for KitchenArt (kitchenart.nl):
Notion design library → mockup generation (Photoshop JSX) → Google Drive storage → Shopify publishing with images → bulk publish → multi-language content (NL/DE/EN).

**Local web UI** — Next.js 14 + SQLite (Prisma), runs on port 3000 (`npm run dev`).

## Tech Stack

- **Frontend**: Next.js 14 + TypeScript
- **Database**: SQLite via Prisma ORM
- **APIs**: Notion, Anthropic Claude Sonnet, Shopify Admin API, Google Drive
- **Mockups**: Photoshop JSX (osascript), PSD/PSB templates
- **Location**: `/Users/Michel/Desktop/Shopify/design-flow/`

## Project Structure

```
design-flow/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── dev.db              # SQLite database
├── scripts/
│   └── generate-mockup.jsx # Photoshop JSX — fully working
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/generate/          # AI content generation (Claude vision)
│   │   │   ├── brand-voice/          # Brand voice document management
│   │   │   ├── designs/
│   │   │   │   ├── [id]/route.ts     # GET/PATCH/DELETE design
│   │   │   │   ├── [id]/content/     # PATCH — inline content edit per language
│   │   │   │   ├── [id]/fork/        # POST — create copy for different productType
│   │   │   │   ├── [id]/mockup/      # POST generate, GET status
│   │   │   │   ├── [id]/publish/     # POST/GET — Shopify publish
│   │   │   │   ├── [id]/translate/   # POST — NL → DE/EN
│   │   │   │   ├── [id]/variants/    # POST — generate variants
│   │   │   │   ├── analyze-image/    # POST — Claude vision on Drive image
│   │   │   │   ├── approve/          # POST — bulk approve
│   │   │   │   └── upload/           # POST — upload new design
│   │   │   ├── notion/               # Notion sync
│   │   │   ├── shopify/              # Shopify helpers
│   │   │   └── workflow/
│   │   │       ├── bulk/             # NL → DE → EN → variants pipeline
│   │   │       └── bulk-publish/     # Bulk Shopify publish (APPROVED only)
│   │   ├── brand-voice/              # Brand voice UI
│   │   ├── upload/                   # Upload new design UI
│   │   ├── page.tsx                  # Dashboard
│   │   └── designs/[id]/page.tsx     # Design detail page
│   └── lib/
│       ├── ai.ts             # Claude Sonnet — content generation
│       ├── constants.ts      # Collections, sizes, pricing
│       ├── drive.ts          # Google Drive — upload, list, base64 (resized via sharp)
│       ├── env.ts            # Environment variable helpers
│       ├── mockup-config.ts  # 44 PSD templates mapped (IB/SP/MC)
│       ├── mockup.ts         # Mockup generation + altText helper
│       ├── notion.ts         # Notion read/write
│       ├── prisma.ts         # Prisma client
│       ├── shopify.ts        # Shopify Admin API
│       ├── translation.ts    # NL → DE/EN via Claude
│       └── variants.ts       # Variant generation (IB/MC/SP sizes + pricing)
├── public/
├── .env                      # Environment variables (never commit)
└── package.json
```

## Data Models (prisma/schema.prisma)

### Design
- `notionId`, `designCode`, `designName`, `designType`, `styleFamily`
- `inductionFriendly`, `circleFriendly`, `splashFriendly`: product type flags
- `collections`, `colorTags`: JSON arrays (strings)
- `driveFileId`, `driveFileName`: source design file on Google Drive
- `status`: DRAFT → CONTENT_GENERATING → REVIEW → APPROVED → PUBLISHING → LIVE | FAILED | ARCHIVED

### Variant
- `productType`: IB | MC | SP
- `sku`: e.g. `IB-CALMM-520-350`
- `ean`: EAN-13 barcode
- `gs1Registered`: Boolean — true when EAN is registered with GS1 NL Verified by GS1
- `size`, `material`, `price`, `weight`
- `shopifyProductId`, `shopifyVariantId`

### Content
- `language`: nl | de | en | fr
- `description`: korte beschrijving (1-2 zinnen) — Shopify `body_html`, verschijnt boven de koop-knop
- `longDescription`: lange beschrijving (2-3 paragrafen) — Shopify metafield `custom.marketplace_description` (als HTML)
- `seoTitle`, `seoDescription`, `googleShoppingDescription`
- `translationStatus`
- `altText` veld bestaat nog in DB (nullable) maar wordt niet meer gebruikt — nooit verwijderen via migratie

### DesignMockup
- `templateId`, `outputName`, `productType`
- `sizeKey`: e.g. `"500x350"` for size-specific templates (null for generic)
- `driveFileId`, `driveUrl` (webContentLink)
- `altText`: SEO alt text using template label, e.g. `"Botanisch inductiebeschermer sfeer keuken — KitchenArt"`

### WorkflowStep
- `step`, `status`: pending | in_progress | completed | failed

## Key Integrations

### Notion Design Library
- Database ID: `cdfd18fb-5193-4666-a885-b9e8d1c538bf`
- Integration: "Design_Flow" (token in `.env` as `NOTION_TOKEN`)
- Write-back: sets Live=true + Shopify URL after publish

### Google Drive
- Stores source design files + generated mockups
- `drive.ts`: `getFileAsBase64()` resizes to max 1500×1500px via `sharp` before sending to Claude (avoids 5MB limit)
- `driveUrl` stored as `webContentLink`; view URL built as `https://drive.google.com/file/d/{fileId}/view`

### Shopify
- SKU structure: `{PREFIX}-{CODE}-{WIDTH}-{HEIGHT}` (IB/SP) or `MC-{CODE}-{DIAMETER}-{MAT}-{SUFFIX}` (MC)
- Publishes as DRAFT; bulk publish only for APPROVED designs
- Images: mockup `driveUrl` passed as `images[{ src }]` — Drive URL public access not yet verified
- `body_html` = korte description (`description` veld)
- Long description via metafield `custom.marketplace_description` (multi_line_text_field, HTML)

### Claude Sonnet (AI Content)
- Content generation uses actual image (Claude vision) + brand voice document + product type
- Translation: NL → DE, EN
- Image resize: max 1500×1500px JPEG q85 via `sharp` before base64 encoding

### Mockup Pipeline (Photoshop JSX)
- Script: `scripts/generate-mockup.jsx`
- Execution: `osascript -e 'tell application "Adobe Photoshop 2026" to do javascript file "..."'`
- PNG input only — JPEG converted via `sips` first
- PSB files must live alongside their PSDs
- PSB canvas dimensions: IB=738×501px, SP=914×508px, MC=1000×1000px
- 4 MC PSDs have broken SO named `'remove'` — handled by try/catch
- **Never call `save()` on original PSDs** — works with copies only
- 44 templates total: 13 IB (5 generic + 8 size-specific) + 19 SP + 12 MC

### PSD Template Folders
- `/Users/Michel/Desktop/Shopify/New Products/Mockups IB/` — 13 PSDs
- `/Users/Michel/Desktop/Shopify/New Products/Mockups SP/` — 19 PSDs
- `/Users/Michel/Desktop/Shopify/New Products/Mockups MC/` — 12 PSDs

## Product Types & Sizes

### IB — Inductiebeschermers
- 19 standard sizes: 52×35cm → 91.6×52.7cm
- Material: Vinyl texture overlay
- SKU: `IB-{CODE}-{WIDTH_MM}-{HEIGHT_MM}`
- Prices: €33.50–€37.50

### SP — Spatschermen
- Multiple sizes
- Material: Aluminium-Dibond, matte coating (no vinyl texture)
- SKU: `SP-{CODE}-{WIDTH_MM}-{HEIGHT_MM}`

### MC — Muurcirkels
- 4 diameters: 400, 600, 800, 1000mm
- 2 materialen: Aluminium Dibond (ADI) + Forex (FRX) — 8 varianten per design
- SKU: `MC-{CODE}-{DIAMETER}-{MAT}-{SUFFIX}` (bijv. `MC-KAL-600-ADI-1`)
- Materiaalcodes: `ADI` (Aluminium Dibond), `FRX` (Forex)
- Suffix: `1` voor 400/600mm, `2` voor 800/1000mm
- Shopify opties: "Diameter" + "Materiaal" (2 opties, net als SP)
- Prijzen ADI: €39,50 / €54,50 / €79,50 / €120,00
- Prijzen FRX: €29,50 / €44,50 / €59,50 / €94,50

## Environment Variables

```env
NOTION_TOKEN=ntn_...
NOTION_DATABASE_ID=cdfd18fb-5193-4666-a885-b9e8d1c538bf
ANTHROPIC_API_KEY=sk-ant-...
SHOPIFY_ACCESS_TOKEN=...
SHOPIFY_STORE_DOMAIN=kitchenart.myshopify.com
GOOGLE_SERVICE_ACCOUNT_KEY=...   # or path to JSON
GOOGLE_DRIVE_FOLDER_ID=...
```

## Commands

```bash
npm run dev              # Start development server (port 3000)
npm run db:push          # Push schema changes (npx prisma db push)
npm run db:studio        # Open Prisma Studio
npx prisma generate      # Generate Prisma client
kill $(lsof -t -i:3000)  # Kill stuck dev server
rm -rf .next             # Wipe Next.js cache (then restart)
```

## Workflow

1. **Upload** — drag design PNG/JPEG to `/upload`, AI analyses image, suggests collections/colors
2. **Generate** — NL content via Claude vision (image + brand voice + product type)
3. **Translate** — NL → DE, EN via Claude
4. **Variants** — generate all SKU/EAN variants per product type
5. **Mockups** — Photoshop generates JPEG mockups from PSDs, saved to Drive
6. **Publish** — single design or bulk publish APPROVED designs to Shopify as DRAFT
7. **Live** — Notion write-back sets Live=true + Shopify URL

## Completed Features

- ✅ Full Notion sync (291 designs)
- ✅ AI content generation with Claude vision
- ✅ Multi-language: NL/DE/EN translation (description + longDescription)
- ✅ Variant generation with EAN-13
- ✅ Shopify publish (single + bulk for APPROVED)
- ✅ Mockup pipeline via Photoshop JSX (44 templates, all working)
- ✅ Google Drive integration (upload + thumbnails)
- ✅ Upload page with AI-suggested collections (checkbox UI)
- ✅ Design fork — copy design for different product type (IB/SP/MC)
- ✅ Mockup section split: generic mockups + size-specific per variant
- ✅ Alt-text auto-generation per mockup (`buildMockupAltText()`)
- ✅ Content inline editing — NL/DE/EN cards editable in place
- ✅ Image resize via sharp (fixes Claude 5MB base64 limit)
- ✅ Design detail page redesign: tabs, sticky header, workflow progress, lightbox
- ✅ Print PDFs via pdf-lib with CutContour spot color + 10mm bleed
- ✅ Split content: `description` (kort, Shopify body_html) + `longDescription` (lang, metafield)
- ✅ MC 8 varianten: 4 diameters × 2 materialen (ADI + Forex)
- ✅ Approve flow: Goedkeuren/Afwijzen knoppen (detail) + bulk approve (homepage)

## Known Issues / Backlog

- Shopify images: `driveUrl` passed as `images[{ src }]` — Drive public access confirmed (mockup uploads use `permissions.create({ role: 'reader', type: 'anyone' })`), but not yet verified end-to-end in production
- EN translation: works via Claude, but was only recently wired up

---

## Session — 2026-03-25: Mockup system refactor

### Changes committed (16fd12d)

**`prisma/schema.prisma`**
- Added `sizeKey String?` to `DesignMockup` model; `prisma db push` already applied

**`src/lib/mockup-config.ts`**
- Added `label: string` to `MockupTemplate` interface
- All templates now have meaningful `outputName` slugs (e.g. `sfeer-keuken`, `product-50x35`)
- Added `getTemplateById(templateId)` helper

**`src/lib/mockup.ts`**
- `buildMockupAltText` uses `template.label` instead of stripping `"mockup-"` prefix
- Drive filename format: `{designCode}-{productType}-{outputName}.jpg`
- New `generateAllMockupsForDesign` — single entry point (generic + size-specific in one call)
- New `regenerateSingleMockup(designId, templateId)` — per-template regeneration
- New `deleteAllMockupsForDesign(designId)` — bulk delete from DB (Drive files kept)
- Saves `sizeKey` field on `DesignMockup` records
- Old functions kept as `@deprecated` wrappers

**`src/app/api/designs/[id]/mockup/route.ts`**
- `POST {}` → `generateAllMockupsForDesign()`
- `POST { templateId }` → `regenerateSingleMockup()`
- `DELETE` → `deleteAllMockupsForDesign()`

**`src/app/globals.css`**
- Added `btn-danger` + `btn-danger:hover`

**`src/app/designs/[id]/page.tsx`**
- `DesignMockup` interface: added `sizeKey?: string | null`
- New state: `deletingMockups`, `regeneratingMockup`
- New functions: `generateMockups()`, `regenerateMockup(templateId)`, `deleteAllMockups()`
- Mockups UI: "Alle mockups verwijderen" button, ↺ per-mockup buttons, size-specific matched by `m.sizeKey === vSizeKey`

**`src/lib/prisma.ts`**
- Disabled verbose query logging — `log: ['error']` only

**`package.json`**
- `dev` script: `next dev --turbo` (Turbopack — 10-20x faster dev compile)

### Architecture notes
- **sizeKey format**: `v.size.replace(/\s*mm\s*/i, '').replace(/\s+/g, '')` → e.g. `"500x350"`
- **Root cause of old bug**: `m.templateId.includes(sizeKey)` was fragile — fixed by storing `sizeKey` in DB
- **Alt text format**: `{designName} {productTypeNL} {label} — KitchenArt` (max 125 chars)

---

## Session — 2026-03-25 (vervolg): IB sizeKey aliases + thumbnail URL fix + performance

### Changes committed (e15bc1d)

**`src/lib/mockup-config.ts`**
- Added `IB_SIZE_KEY_ALIASES`: maps 19 real IB variant sizeKeys → 8 PSD sizeKeys
  e.g. `800x520`, `810x520`, `812x527`, `830x515` → `mockup-1 80x52`

**`src/lib/mockup.ts`**
- `generateAllMockupsForDesign`: resolves alias before finding PSD, passes `saveSizeKey` (original variant key)
- `generateAndSaveSingleMockup`: accepts optional `saveSizeKey` param — stores original variant sizeKey in DB
- `deleteMany` scoped to `{ designId, templateId, sizeKey }` zo rows don't overwrite each other

**`src/app/designs/[id]/page.tsx`** + **`src/app/api/designs/upload/route.ts`**
- All `drive.google.com/thumbnail?id=...` URLs replaced with `drive.usercontent.google.com/download?id=...&export=view`
- Reden: thumbnail URL requires Google login in browser → broken `<img>` tags

**`.env`**
- `DATABASE_URL` updated: `file:./dev.db?connection_limit=1&socket_timeout=10`
- Reden: SQLite single-writer; multiple Prisma connections queue → slow responses

### Changes committed (099caa0)

**`src/lib/shopify.ts`**
- `shopifyFetch()`: added `signal: AbortSignal.timeout(8000)`
- Reden: Node fetch heeft geen default timeout; stalled Shopify DNS/TCP hing ~25s

**`src/app/designs/[id]/page.tsx`**
- Removed `fetchShopifyPreview()` from initial `useEffect`
- Replaced `shopifyPreview?.shopifyConfigured` state with `process.env.NEXT_PUBLIC_SHOPIFY_CONFIGURED === 'true'`

**`.env`** (local only, niet gecommit)
- Added `NEXT_PUBLIC_SHOPIFY_CONFIGURED=true`

### Open issue: afbeeldingen laden niet
- `drive.usercontent.google.com/download?id=...&export=view` werkt niet in browser (auth of CORS)
- Te onderzoeken: zijn Drive bestanden public, en welke URL-vorm werkt zonder login

---

## Session — 2026-03-25 (vervolg): UI redesign + print PDFs + content split

### Changes committed (3968165)

**`src/app/designs/[id]/page.tsx`**
- Volledig herontwerp van de design detailpagina
- Tabs: Overzicht / Mockups / Printbestanden / Content / Varianten
- Sticky header met thumbnail, naam en statusbadge
- Workflow-voortgangsbalk met 6 visuele checkmarks
- Grotere mockup-thumbnails (240×180px) met lightbox/modal (Escape-toets)
- Progressiebalk bij printbestanden genereren
- Aanmaakdatum per printbestand
- ActionRow-componenten met statusindicators en disabled-hints

**`src/app/designs/[id]/error.tsx`** (nieuw)
- Next.js error boundary aangemaakt (ontbrak → crash bij refresh)

### Changes committed (ce31309)

**`src/app/designs/[id]/page.tsx`** + sub-componenten
- `React` import toegevoegd (ontbrak → `React.ReactNode` crash)

### Changes committed (a08d58d / 69c7562 / 2eb6c57)

**`src/lib/print.ts`** — PDF generatie volledig herschreven van Illustrator → pdf-lib (Node.js)
**`src/lib/print-config.ts`** — 19 IB print templates (afmetingen in mm + sizeKey)
- CutContour spot color correct geïmplementeerd
- 10mm bleed
- Bug fix: CutContour stream gepusht in bestaande PDFArray

### Changes committed (4e9b775): Split AI content in description + longDescription

**`prisma/schema.prisma`**
- `longDescription String?` toegevoegd aan `Content` model (`prisma db push`)

**`src/lib/ai.ts`**
- `GeneratedContent` interface: nieuw veld `longDescription`
- Prompt genereert expliciet twee aparte velden:
  - `description`: 1-2 zinnen, wervend, voor boven de koop-knop
  - `longDescription`: 2-3 paragrafen, uitgebreider, voor verderop op de pagina

**`src/lib/translation.ts`**
- `TranslationFields` type: bevat `longDescription`
- DeepL-pad: `longDescription` als 2e tekst in array (index 1, rest schuift op)
- Claude-pad: veld opgenomen in JSON-prompt; regex-fallback ook bijgewerkt
- `max_tokens` verhoogd naar 3000

**`src/lib/shopify.ts`**
- `body_html` = `toBodyHtml(nlContent.description)` (kort)
- `longDescription` → metafield `custom.long_description` (type `multi_line_text_field`, alleen als aanwezig)

**`src/app/api/ai/generate/route.ts`**
- `longDescription` opgeslagen bij zowel create als update

**`src/app/api/designs/[id]/content/route.ts`**
- `longDescription` opgenomen in PATCH-body verwerking

**`src/app/designs/[id]/page.tsx`**
- `Content` interface: `longDescription: string | null`
- `ContentEditFields`: nieuw veld `longDescription`
- Edit-formulier: textarea voor "Korte beschrijving" (3 rijen) + "Lange beschrijving" (6 rijen)
- Read-only view: twee aparte `<details>` collapsibles

### Changes committed (this session): CLAUDE.md + .gitignore

**`CLAUDE.md`** — bijgewerkt met alle sessies van vandaag
**`.gitignore`** — `*.tsbuildinfo` toegevoegd (auto-gegenereerd bestand)

---

## Session — 2026-03-25 (vervolg): Fase 2–5 — Google Shopping, Shopify update, Translations API

### SEO metafields (committed: 24268d7)
- `src/lib/shopify.ts`: `global.title_tag` + `global.description_tag` toegevoegd als metafields in `buildShopifyProduct()`

### Fase 2 — Google Shopping Description (unstaged → now committed)
- `src/lib/ai.ts`: `googleShoppingDescription` in `GeneratedContent` interface, prompt (instructie #6, max 150 chars, factual/feature-driven, Google Shopping spec), JSON parse, fallback, `max_tokens` → 2000
- `prisma/schema.prisma`: `googleShoppingDescription String?` op `Content` model (`prisma db push` gedaan)
- `src/app/api/ai/generate/route.ts`: `googleShoppingDescription` opgeslagen bij create + update
- `src/lib/translation.ts`: `TranslationFields` uitgebreid, DeepL array index 5, Claude fallback + beide upsert-paden bijgewerkt
- `src/lib/shopify.ts`: metafield `custom.google_shopping_description` (single_line_text_field) toegevoegd aan `buildShopifyProduct()`
- `src/app/api/designs/[id]/content/route.ts`: PATCH accepteert + slaat `googleShoppingDescription` op
- `src/app/designs/[id]/page.tsx`: `Content` interface uitgebreid, `ContentEditFields` uitgebreid, edit-form + read-only view tonen Google Shopping veld

### Fase 4 — Shopify product update (unstaged → now committed)
- `src/lib/shopify.ts`: `updateShopifyProduct()` functie — PUT body_html + upsert alle metafields via REST
- `src/app/api/designs/[id]/shopify-update/route.ts`: NEW — `POST /api/designs/[id]/shopify-update`
- `src/app/designs/[id]/page.tsx`: "Shopify bijwerken" knop (verschijnt alleen als `alreadyOnShopify`), `updateShopify()` handler, result feedback

### Fase 5 — Translations API (unstaged → now committed)
- `src/lib/shopify-translations.ts`: NEW — `pushTranslationsToShopify()` via Shopify GraphQL Admin API
  - `translationsRegister` mutation voor product + metafields per locale (DE/EN/FR)
  - Digest fetching via `translatableResource` query
  - Metafield GIDs via `getProductMetafields()`
- Geïntegreerd in:
  - `src/app/api/designs/[id]/publish/route.ts` — na `createShopifyProduct()` (non-fatal)
  - `src/app/api/workflow/bulk-publish/route.ts` — na `createShopifyProduct()` (non-fatal)
  - `src/app/api/designs/[id]/shopify-update/route.ts` — na `updateShopifyProduct()` (non-fatal)

### Architecture notes (Translations API)
- REST `/translations` endpoint is deprecated — GraphQL `translationsRegister` is de juiste weg
- Elke vertaalde field vereist een `translatableContentDigest` opgehaald via `translatableResource` query
- Metafield-vertalingen hebben hun eigen GID en digest (apart van product-level velden)
- NL is de default store-taal → geen translation push voor NL nodig
- Alle translation errors zijn non-fatal (gelogd, product-publish slaagt altijd)

---

## Session — 2026-03-25 (vervolg): Drive proxy fix + Translations title fix + Stijlfamilies

### Drive image proxy fix

**`src/app/api/drive-image/[fileId]/route.ts`**
- `params` type gewijzigd naar `Promise<{ fileId: string }>` + `await params` (Next.js 14+ async params patroon — alle andere routes gebruikten dit al)
- `redirect: 'follow'` toegevoegd aan `fetch()` (Drive redirect naar `usercontent` subdomein)
- HTML content-type detectie: als Drive een loginpagina teruggeeft (text/html), 502 retourneren i.p.v. kapotte image-bytes

### Translations API title fix

**`src/lib/shopify-translations.ts`**
- Verwijderd: `title` vertaling (was `content.seoTitle` → Shopify product `title` field)
- De product-titel is de designnaam — niet taalspecifiek, mag niet worden overschreven
- Alleen `body_html` en metafields worden nu als vertalingen gepusht

### Stijlfamilies (al volledig gebouwd in eerdere sessie — gedocumenteerd)

**`src/app/api/designs/style-families/route.ts`** — volledig werkend:
- `GET` → lijst van stijlfamilies uit DB
- `POST` → Claude groepeert designs in stijlfamilies + Notion write-back via `updateStyleFamilyInNotion()`

**`src/app/page.tsx`** — dashboard heeft "Stijlfamilies genereren" knop + resultaatweergave

**`src/lib/notion.ts`** — `updateStyleFamilyInNotion()` bestaat al

---

## Session — 2026-03-25 (vervolg): Volledige Shopify metadata coverage + altText verwijderd

### Changes committed (664e832): Full Shopify metadata coverage + remove Content.altText

**`src/lib/shopify.ts`**
- `PRODUCT_MATERIAL` constante toegevoegd bovenaan: `{ IB: "Vinyl texture overlay", MC: "Aluminium-Dibond matte", SP: "Aluminium-Dibond matte" }`
- `buildShopifyProduct()`: 3 nieuwe **product metafields**:
  - `custom.product_type` (single_line_text_field) — IB / MC / SP code
  - `custom.material` (single_line_text_field) — statisch label per producttype
  - `custom.induction_compatible` (single_line_text_field) — `"true"` of `"false"` string
- `buildShopifyProduct()`: **variant metafields** per variant:
  - `custom.width_mm` + `custom.height_mm` (IB/SP) — afmeting in mm, integer_type
  - `custom.diameter_mm` (MC) — diameter in mm, integer_type
  - `custom.ean` (alle types, indien aanwezig) — EAN-13 barcode, single_line_text_field
  - `custom.material` (SP only) — label string uit `SP_MATERIALS` constante
- `updateShopifyProduct()`: query uitgebreid met `variants: { take: 1 }`; upsert van de 3 nieuwe product metafields (`product_type`, `material`, `induction_compatible`)

**`src/lib/ai.ts`**
- `altText` verwijderd uit `GeneratedContent` interface, prompt, JSON parse-resultaat en fallback return

**`src/app/api/ai/generate/route.ts`**
- `altText` verwijderd uit `prisma.content.update` en `prisma.content.create`

**`src/app/api/designs/[id]/content/route.ts`**
- `altText` verwijderd uit destructuring en `data` object in PATCH-handler

**`src/app/designs/[id]/page.tsx`**
- `altText` verwijderd uit `Content` interface, `ContentEditFields` type, `openContentEdit` initialisatie, edit form velden en read-only `<ContentField>` weergave

**`src/lib/translation.ts`**
- `altText` verwijderd uit `TranslationFields` type, Claude regex fallback, Claude return object, DeepL array (geherindexeerd 0–4), alle variabele assignments en beide DB upsert-paden

### Changes committed (eca01c9): Fix Google Shopping description length

**`src/lib/ai.ts`**
- Google Shopping description instructie bijgewerkt van "min 70 / max 150 tekens" naar **300–500 tekens** (conform GMC best practice)
- Fallback waarde bijgewerkt naar een volwaardige zin van ~160 tekens

### Architecture notes
- `Content.altText` bestaat nog als nullable kolom in de DB — **nooit verwijderen via migratie**; het wordt simpelweg niet meer geschreven of gelezen
- Shopify REST API accepteert `metafields` array direct op elk variant-object in de product creation payload
- Variant size format: IB/SP = `"520x350"` (B×H in mm), MC = `"600"` (diameter in mm)
- SP material labels komen uit `SP_MATERIALS` in `constants.ts`: G = Glas, BH0 = Brushed, BH4 = Brushed + 4mm

---

## Session — 2026-03-26: Printbestanden SP en MC

### Changes committed (2bdd912): Add SP and MC print file support

**`src/lib/print-config.ts`**
- `PRINT_BASE` constante hernoemd naar `IB_PRINT_BASE`
- `SP_PRINT_TEMPLATES` toegevoegd: 12 maten conform `SP_SIZES` in `constants.ts`, sizeKey = `"{width}x{height}"` (bijv. `"600x300"`)
- `MC_PRINT_TEMPLATES` toegevoegd: 4 diameters (400/600/800/1000mm), sizeKey = diameter als string (bijv. `"600"`), widthMM = heightMM = diameter
- `getPrintTemplateForSize()`: SP en MC branches toegevoegd
- `getAllPrintTemplates()`: SP en MC branches toegevoegd
- `buildPrintFileName()`: MC krijgt apart formaat zonder hoogte — `mc-{code}-{diameter}.pdf`
- Doc-comment bijgewerkt met SP/MC spec

**`src/lib/print.ts`**
- `generateAllPrintFilesForDesign()`: IB-only guard verwijderd; gebruikt nu `getPrintTemplateForSize(productType, sizeKey)` — werkt voor IB/SP/MC
- SP deduplicatie: meerdere variants per maat (G/BH0/BH4) worden automatisch gereduceerd tot unieke sizeKeys
- `regenerateSinglePrintFile()`: `getPrintTemplateForSize('IB', ...)` → `getPrintTemplateForSize(productType, ...)`; foutmelding toont nu ook productType

### Architecture notes
- SP: één PDF per unieke maat (G/BH0/BH4 materiaalvarianten delen hetzelfde printbestand — materiaal beïnvloedt alleen boorgaten/ophanging, niet het printoppervlak)
- MC: geen cirkel-CutContour — zelfde afgeronde rechthoek als IB/SP; widthMM = heightMM = diameter
- SP/MC `psdPath` veld is leeg string `""` (geen PSD-bestanden nodig — PDF wordt puur via pdf-lib gegenereerd)

### Changes committed (f5f7a1a): Fix CutContour IB-only guard

**`src/lib/print.ts`**
- `buildPrintPdf()`: `productType: string` parameter toegevoegd
- `addCutContourSpotColor()` wordt nu alleen aangeroepen als `productType === 'IB'`
- SP/MC PDFs bevatten alleen afbeelding + bleed (geen CutContour)
- Doc-comment bijgewerkt: "CutContour (IB only)" + SP/MC spec vermeld
- `buildAndUploadPrintFile()`: geeft `productType` door aan `buildPrintPdf()`

---

## EAN Codes — Architectuur & GS1 Integratie (bijgewerkt 2026-03-26)

### Huidige implementatie

| Bestand | Rol |
|---|---|
| `src/lib/ean.ts` | Core EAN logica: check-digit berekening, validatie, sequentiële generatie, bulk-assign |
| `src/lib/gs1.ts` | GS1 NL OAuth2 token ophalen + `registerGtin()` functie |
| `src/lib/variants.ts` | EAN wordt toegewezen + GS1 registratie gestart bij aanmaken van elke variant (IB/SP/MC) |
| `src/app/api/ean/assign/route.ts` | REST API: `POST /api/ean/assign` (vul ontbrekende EANs), `GET` (preview hoeveel ontbreken) |
| `src/app/api/ean/gs1-sync/route.ts` | `POST /api/ean/gs1-sync` — backfill: registreert alle bestaande EANs met `gs1Registered=false` |
| `src/lib/shopify.ts` | EAN naar Shopify als `barcode` veld + metafield `custom.ean` |
| `prisma/schema.prisma` | `Variant.ean String?` + `Variant.gs1Registered Boolean @default(false)` |

**EAN generatie algoritme** (`src/lib/ean.ts`):
- GS1 bedrijfsprefix KitchenArt: **`8721476`** (hardcoded als seed `8721476881239`)
- Strategie: hoogste bestaande EAN in DB ophalen → +1 → check-digit herberekenen
- Volledig offline/lokaal — GS1 API is alleen voor *registratie*, niet voor generatie

**EAN toewijzing + registratie**: bij `generateSpVariants()`, `generateIbVariants()`, `generateMcVariants()` — elke variant krijgt direct een EAN via `await generateNextEan()`, daarna wordt `registerGtin()` non-fatal aangeroepen.

### GS1 NL API integratie

**Authorization API** (`https://gs1nl-api-acc.gs1.nl/authorization/token`):
- `POST` met `client_id` en `client_secret` als **headers** (niet body)
- Geeft `{ access_token, expires_in, token_type, scope }`
- Token wordt gecached in memory tot verloopdatum (minus 60s buffer)

**GTIN Registration API** (`https://gs1nl-api-acc.gs1.nl/gtin-registration-api/RegistrateGtinProducts`):
- `POST` met Bearer token + JSON body
- Asynchroon (bulk) proces — we sturen per variant, fire-and-forget
- Verplichte velden: `accountnumber`, `Gtin`, `Status`, `Gpc`, `ConsumerUnit`, `PackagingType`, `TargetMarketCountry`, `Description`, `Language`, `BrandName`, `ContractNumber`

**Env vars** (in `.env`, nooit committen):
```
GS1_CLIENT_ID=               # sandbox client ID uit GS1 developer portal
GS1_CLIENT_SECRET=           # sandbox client secret uit GS1 developer portal
GS1_ACCOUNT_NUMBER=          # bedrijfsnummer uit MijnGS1 (huidig: 87214768)
GS1_CONTRACT_NUMBER=         # contractnummer uit MijnGS1 > Company > Contracts
GS1_SUBSCRIPTION_KEY=        # Ocp-Apim-Subscription-Key — nog toe te voegen aan gs1.ts
```

**Non-fatal gedrag**: als `GS1_ACCOUNT_NUMBER` leeg is (dev/CI) skip de registratie stil. Als de API-aanroep faalt → `console.warn`, variant-aanmaak gaat door, `gs1Registered` blijft `false`.

**Backfill bestaande EANs**: `POST /api/ean/gs1-sync` — idempotent, verwerkt alles met `gs1Registered=false`.

### 🔴 Openstaand — wachten op subscription key

**Probleem**: GTIN Registration API geeft `401: Access denied due to missing subscription key`. De API verwacht naast de Bearer token ook een `Ocp-Apim-Subscription-Key` header (Azure API Management).

**Wat er nog moet gebeuren**:
1. `GS1_SUBSCRIPTION_KEY` toevoegen aan `.env` — key staat op `https://gs1nl-api-acc-developer.gs1.nl` → profiel → subscriptions → Primary key (aangevraagd, nog niet ontvangen)
2. `src/lib/gs1.ts` — `Ocp-Apim-Subscription-Key: ${GS1_SUBSCRIPTION_KEY}` toevoegen aan de fetch headers in `registerGtin()`
3. Daarna opnieuw `POST /api/ean/gs1-sync` draaien om alle 300 bestaande EANs te registreren

**Accountnummer**: `87214768` (bedrijfsnummer MijnGS1) — werkt, OAuth2 token wordt succesvol opgehaald. Onduidelijk of het 13-cijferig formaat vereist is; testen na subscription key fix.

---

## Session — 2026-03-26 (vervolg): MockupCard footer alt-text fix

### Changes committed (9b93e6e): Fix MockupCard alt-text altijd tonen in footer

**`src/app/designs/[id]/page.tsx`** (MockupCard footer, ~regel 1558)
- Alt-text wordt nu **altijd** getoond onder de mockup naam — ook als leeg
- Lege alt-text toont `Geen alt-text` in lichtgrijs (`#d1d5db`)
- Font-size verhoogd van 10px → 11px; kleur van `#9ca3af` → `#6b7280` (meer contrast)
- Italic stijl verwijderd; `title` attribuut toegevoegd (full tekst bij hover op ellipsis)
- Conditional `{altText && altText !== name && ...}` vervangen door onvoorwaardelijke render

---

## Session — 2026-03-26 (vervolg): Drive proxy auth fix + SP sized mockup fix + Shopify metafields coverage + UI metafields

### Changes committed (f9a503c): Drive proxy auth + SP sized mockup sizeKey fix

**`src/app/api/drive-image/[fileId]/route.ts`**
- Proxy gebruikt nu **Google APIs JWT service account** i.p.v. anonieme fetch
- Imports: `google` + `JWT` uit `googleapis` en `google-auth-library`
- Service account key ingelezen via `GOOGLE_SERVICE_ACCOUNT_KEY` env var (JSON string)
- JWT scope: `https://www.googleapis.com/auth/drive.readonly`
- Download URL: `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
- Access token wordt per request opgehaald via `jwt.getClient().getAccessToken()`
- Fix: werkt nu voor bestanden in Shared Drive (vereisen auth)

**`src/lib/mockup.ts`** (`regenerateSingleMockup`)
- Laadt eerst bestaand `DesignMockup` record op uit DB om de originele `sizeKey` te bewaren
- Zonder deze fix: na regeneratie werd `sizeKey = undefined` opgeslagen → sized mockups verdwenen uit UI
- Geeft de `sizeKey` door aan `generateAndSaveSingleMockup()` als `saveSizeKey`

### Changes committed (73c478b): Full Shopify metafield coverage (product + variant)

**`src/lib/shopify.ts`**

**Nieuwe product metafields in `buildShopifyProduct()`:**
| Metafield | Waarde |
|---|---|
| `custom.manufacturer` | `"probo"` (statisch) |
| `custom.modelnaam` | `design.designName` |
| `custom.color_plain` | `"Full-colour"` (statisch) |
| `custom.google_custom_product` | `"True"` (statisch) |
| `custom.material_plain` | `"Vinyl"` / `"Aluminium-Dibond"` per producttype |
| `custom.beschrijving_afbeelding` | `driveFileId` van eerste mockup |
| `custom.product_information` | `nlContent.description` (plain text) |
| `custom.marketplace_description` | `toBodyHtml(nlContent.description)` (HTML, voor Bol.com) |
| `custom.google_description` | `nlContent.googleShoppingDescription` (renamed van `custom.google_shopping_description`) |

**Nieuwe variant metafields per variant:**
| Metafield | Waarde |
|---|---|
| `custom.materiaal` | SP: label uit SP_MATERIALS; IB/MC: uit MATERIAL_PLAIN |
| `custom.maateenheid` | `"cm"` (statisch) |
| `custom.product_breedte` | breedte in cm (number_decimal) |
| `custom.product_hoogte` | hoogte in cm (number_decimal) |
| `mm-google-shopping.condition` | `"new"` |
| `mm-google-shopping.gender` | `"unisex"` |
| `mm-google-shopping.age_group` | `"adult"` |
| `mm-google-shopping.mpn` | `v.sku` |

**`updateShopifyProduct()`** uitgebreid: upsert van alle nieuwe product metafields (`manufacturer`, `modelnaam`, `color_plain`, `google_custom_product`, `material_plain`) en product_information / marketplace_description / long_description / google_description

**Let op**: `custom.google_shopping_description` (oude key) vervangen door `custom.google_description`

### Changes (current session): UI metafields zichtbaar in design detail pagina

**`src/app/designs/[id]/page.tsx`**

**Content tab** — nieuw: "Shopify Metafields (product)" sectie boven de taalkaarten:
- Toont read-only grid van alle product-niveau metafields die naar Shopify gaan
- Alleen zichtbaar als NL content beschikbaar is (anders irrelevant)
- Velden: `custom.manufacturer`, `custom.modelnaam`, `custom.color_plain`, `custom.google_custom_product`, `custom.material`, `custom.material_plain`, `custom.beschrijving_afbeelding`, `custom.product_information`, `custom.marketplace_description`, `custom.long_description`, `custom.google_description`, `global.title_tag`, `global.description_tag`
- Waarden afgeleid in de component zelf (statische constanten + content velden)
- Niet-ingevulde velden tonen "— niet ingevuld" in grijs

**Varianten tab** — tabel uitgebreid met Shopify metafield kolommen:
- Basis kolommen: Type, Maat (mm), SKU, EAN, Prijs, Shopify ID
- Extra metafield kolommen (visueel gescheiden met border): `materiaal`, `breedte (cm)`, `hoogte (cm)`, `mpn`, `condition/gender/age`
- Materiaal feed waarde: SP-varianten tonen vertaald label (GLAS→Gehard Glas etc.); IB/MC tonen statisch materiaal
- Dimensies in cm berekend uit variant `size` veld (mm → cm met 1 decimaal)
- `minWidth` van tabel vergroot naar 900px; horizontaal scrollbaar

## Session — 2026-03-26 (vervolg): marketplace_description fix + google_description_de + translations fix

### Bevinding: `custom.marketplace_description` correct waarde
Inspectie van bestaand Shopify product (ID 9649643356502) toonde: `custom.marketplace_description` bevat **de long description als HTML** — niet de korte description. Vorige implementatie stuurde `toBodyHtml(description)` (fout); correct is `toBodyHtml(longDescription)`.

### Changes committed:

**`src/lib/shopify.ts`**

- `buildShopifyProduct()`:
  - `custom.marketplace_description`: waarde gewijzigd van `toBodyHtml(nlContent.description)` naar `toBodyHtml(nlContent.longDescription)` — conditioneel op `longDescription` (niet meer op `description`)
  - Nieuw: `custom.google_description_de` — DE Google Shopping description als aparte metafield (niet via Translations API), waarde = `deContent.googleShoppingDescription`

- `updateShopifyProduct()`:
  - `custom.marketplace_description`: zelfde fix als hierboven
  - `custom.product_information` en `custom.marketplace_description` nu apart geconditioneerd (i.p.v. beide op `nlContent.description`)
  - Nieuw: upsert van `custom.google_description_de` uit DE content

**`src/lib/shopify-translations.ts`**

- Regel 184 bug gefixed: `custom.google_shopping_description` (stale key) vervangen door `custom.google_description`
- Twee nieuwe metafield translations toegevoegd:
  - `custom.product_information` → `content.description` (plain text, DE/EN versie)
  - `custom.marketplace_description` → `toBodyHtml(content.longDescription)` (HTML, DE/EN versie)
- Header comment bijgewerkt

### Metafield overzicht (volledig, na deze sessie)

**Product metafields (NL, via REST bij create/update):**
| Metafield | Waarde |
|---|---|
| `custom.design_code` | `design.designCode` |
| `custom.product_type` | `firstType` (IB/MC/SP) |
| `custom.manufacturer` | `"probo"` |
| `custom.modelnaam` | `design.designName` |
| `custom.color_plain` | `"Full-colour"` |
| `custom.google_custom_product` | `"True"` |
| `custom.induction_compatible` | `String(design.inductionFriendly)` |
| `custom.material` | per producttype (verbose label) |
| `custom.material_plain` | per producttype (feed label) |
| `custom.beschrijving_afbeelding` | `driveFileId` eerste mockup |
| `custom.product_information` | `nlContent.description` (plain) |
| `custom.marketplace_description` | `toBodyHtml(nlContent.longDescription)` (HTML) |
| `custom.google_description` | `nlContent.googleShoppingDescription` |
| `mm-google-shopping.condition` | `"new"` |
| `mm-google-shopping.gender` | `"unisex"` |
| `mm-google-shopping.age_group` | `"adult"` |
| `global.title_tag` | `nlContent.seoTitle` |
| `global.description_tag` | `nlContent.seoDescription` |

**Translations API (DE/EN/FR, via GraphQL):**
| Metafield | Waarde |
|---|---|
| `body_html` | `toBodyHtml(content.description)` |
| `custom.product_information` | `content.description` |
| `custom.marketplace_description` | `toBodyHtml(content.longDescription)` |
| `global.title_tag` | `content.seoTitle` |
| `global.description_tag` | `content.seoDescription` |
| `custom.google_description` | `content.googleShoppingDescription` |

---

## Session — 2026-03-26 (vervolg): Terug-knop fix + pdf-lib corrupt node_modules

### Changes committed (c9cfab4): Terug-knop + pdf-lib lazy import

**`src/app/designs/[id]/page.tsx`**
- "← Terug" knop gebruikte `router.push('/')` — vervangen door `router.back()` met `router.push('/')` als fallback als `window.history.length <= 1`
- Root cause van "knop doet niets": de 500 op `/api/designs/[id]/printfile` voorkwam dat de pagina correct hydreerde, waardoor alle `onClick` handlers inactief bleven

**`src/lib/print.ts`**
- Tijdelijk: `pdf-lib` top-level import vervangen door `await import('pdf-lib')` in `buildPrintPdf()` als workaround voor Turbopack crash
- Later teruggedraaid (zie c9cfab4 → 5bd87ca)

### Changes committed (5bd87ca): pdf-lib corrupt node_modules fix

**Root cause**: `node_modules/pdf-lib/cjs/core/embedders/CustomFontEmbedder.js` en andere embedder bestanden ontbraken — corrupte installatie. Dit veroorzaakte `Cannot convert undefined or null to object` bij elke `require('pdf-lib')`, ook via dynamische import.

**Fix**: `npm remove pdf-lib && npm install pdf-lib` — schone herinstallatie. Daarna:
- Top-level import hersteld in `src/lib/print.ts`
- `addCutContourSpotColor()` signatuur terug naar normaal (geen doorgegeven types meer)
- `package.json` + `package-lock.json` gecommit met correcte pdf-lib installatie

### Diagnose-aanpak
1. `curl` op endpoint → exacte foutmelding in HTML response zichtbaar
2. `node -e "require('pdf-lib')"` hangt → package zelf kapot
3. `ls node_modules/pdf-lib/cjs/core/embedders/` → `CustomFontEmbedder.js` ontbreekt
4. `npm remove pdf-lib && npm install pdf-lib` → opgelost

### Architectuurnotities
- `pdf-lib` in `serverExternalPackages` (next.config.js) is correct en moet blijven staan
- Turbopack bundelt `pdf-lib` niet zelf — Node laadt het als external module
- Als `pdf-lib` ooit opnieuw crasht: check eerst of `node_modules/pdf-lib/cjs/core/embedders/` volledig is

---

## Session — 2026-03-27: Bug fixes bulk workflow + TypeScript errors

### Code review resultaten (alle routes gelezen, geteste endpoints)

**Werkende endpoints** (code review + eerder live getest):
- `GET/POST /api/ai/generate` ✅ — correct, slaat alle velden op, geen altText
- `POST /api/designs/[id]/fork` ✅ — correct, kopieert design naar ander producttype
- `POST /api/workflow/bulk-publish` ✅ — correct, non-fatal translation push, Notion write-back
- `/upload` pagina ✅ — correct, AI-analyse, form pre-fill, product type flags
- `/brand-voice` pagina ✅ — correct, sectie-navigatie, FAQ-beheer, save

### Bug fixes committed (this session)

**Bug 1 — `src/app/api/workflow/bulk/route.ts`** (altText + ontbrekende velden)
- `altText: content.altText` verwijderd uit `content.upsert` create/update body
- `longDescription: content.longDescription` en `googleShoppingDescription: content.googleShoppingDescription` toegevoegd
- Root cause: stale velden uit een oudere versie van de Content upsert

**Bug 2 — `src/app/api/workflow/bulk/route.ts`** (productType fallback)
- `inductionFriendly ? 'INDUCTION' : circleFriendly ? 'CIRCLE' : 'INDUCTION'` vervangen door
  `splashFriendly ? 'SPLASH' : circleFriendly ? 'CIRCLE' : 'INDUCTION'`
- Root cause: `splashFriendly` werd nooit als eerste gecheckt → SP-designs kregen INDUCTION producttype voor AI content generatie

**Bug 3 — `src/app/designs/[id]/page.tsx`** (TypeScript: skipped/skipReason)
- `r.skipped` en `r.skipReason` gecasted naar `(r as MockupGenerateResult).skipped` / `(r as MockupGenerateResult).skipReason`
- Root cause: union type `DesignMockup | MockupGenerateResult` — alleen MockupGenerateResult heeft die velden

**Bug 4 — `src/lib/print.ts`** (TypeScript: productType string → union type)
- `buildPrintFileName(productType, ...)` → `buildPrintFileName(productType as 'IB' | 'SP' | 'MC', ...)`
- Root cause: `buildAndUploadPrintFile()` heeft `productType: string`, maar `buildPrintFileName()` verwacht `'IB' | 'SP' | 'MC'`

**Bug 5 — `src/lib/print.ts`** (TypeScript: resources possibly undefined)
- Na `const resources = page.node.Resources()`: null-guard `if (!resources) throw new Error(...)` toegevoegd
- Root cause: `PDFPage.node.Resources()` return type is `PDFDict | undefined` volgens TypeScript

**TypeScript check**: `npx tsc --noEmit` → 0 errors na alle fixes

---

## Session — 2026-03-27 (vervolg): Metafield restructuring — deduplicatie + Google Shopping naar product-level

### Channable + Shopify Translations — Research

Channable's Shopify Markets importer heeft een "Include translated metafields" instelling die Shopify Translations API waarden importeert als aparte velden per taal (bijv. `title_fr`, `marketplace_description_de`). Dit bevestigt:
- Per-taal metafields zijn **niet nodig** — enkele metafield + Shopify Translations API is correct
- `custom.google_description_de` als apart metafield is overbodig
- `custom.long_description` is een duplicaat van `custom.marketplace_description` (beide bevatten dezelfde HTML)

### Changes (dit session): Metafield restructuring

**`src/lib/shopify.ts`**

`buildShopifyProduct()`:
- `custom.long_description` metafield verwijderd (was duplicaat van `marketplace_description`)
- `custom.google_description_de` metafield verwijderd (Translations API handelt DE vertaling af)
- `mm-google-shopping.condition/gender/age_group` verplaatst van **variant-level** naar **product-level**
- Variant metafields: alleen `mm-google-shopping.mpn` (= SKU) behouden per variant

`updateShopifyProduct()`:
- `custom.long_description` upsert verwijderd
- `custom.google_description_de` upsert verwijderd
- `mm-google-shopping.condition/gender/age_group` upserts toegevoegd op product-level
- JSDoc comment bijgewerkt

**`src/lib/shopify-translations.ts`**
- `custom.long_description` verwijderd uit `addMetafieldTranslation` calls (regel 183)
- `custom.long_description` verwijderd uit file header comment

**`src/app/designs/[id]/page.tsx`**

Content tab — Shopify Metafields (product) sectie:
- `custom.marketplace_description` display label gecorrigeerd: was `'(HTML versie van korte beschrijving)'`, nu `'(HTML versie van lange beschrijving)'`
- `custom.long_description` rij verwijderd
- Nieuwe rijen: `mm-google-shopping.condition`, `mm-google-shopping.gender`, `mm-google-shopping.age_group`

Varianten tab — metafield kolommen:
- `condition/gender/age` kolom verwijderd (data cel + header)
- `colSpan` van metafield header: 5 → 4
- Behouden: materiaal, breedte (cm), hoogte (cm), mpn

**TypeScript check**: `npx tsc --noEmit` → 0 errors

---

## Session — 2026-03-27 (vervolg): MC varianten uitbreiding + Brand voice update + Approve flow

### MC varianten uitbreiding (commit bb8df50)

MC designs genereren nu **8 varianten** (4 diameters × 2 materialen) in plaats van 4.

**`src/lib/constants.ts`**
- `MC_MATERIALS` array toegevoegd: `[{ code: 'ADI', label: 'Aluminium Dibond' }, { code: 'FRX', label: 'Forex' }]`
- `MC_SIZES` herschreven met `priceAdi` / `priceFrx` / `suffix` / `label` (met ø prefix)

**`src/lib/variants.ts`**
- `buildMcSku()`: nu 4 params (`designCode, diameter, materialCode, suffix`)
- `generateMcVariants()`: itereert over `MC_SIZES × MC_MATERIALS` = 8 varianten
- Slaat `material` code (ADI/FRX) op in DB variant record

**`src/lib/shopify.ts`**
- MC verwijderd uit statische `PRODUCT_MATERIAL` / `MATERIAL_PLAIN` maps
- MC label helpers: `mcSizeLabel()` (diameter met ø), `mcMaterialLabel()` (ADI→Aluminium Dibond, FRX→Forex)
- MC variants krijgen `option1` (diameter) + `option2` (materiaal) — 2-optie product net als SP
- Materiaal metafield per variant i.p.v. statisch op product-level
- Product opties: `[{ name: 'Diameter' }, { name: 'Materiaal' }]`

**`src/app/designs/[id]/page.tsx`**
- `mcMaterialLabels` map + `getVariantMaterialFeed()` handelt MC per-variant materiaal in UI

### Brand voice DB update

- `materialMC`: herschreven naar alleen Aluminium Dibond + Forex (multiplex, dibond budget/premium/butler finish verwijderd)
- `doNotUse`: regel toegevoegd: "Materialen die we niet verkopen: multiplex, dibond budget, dibond premium, dibond butler finish"

### Approve flow

REVIEW → APPROVED transitie was niet exposed in de UI. Nu gebouwd:

**`src/app/designs/[id]/page.tsx`** — Detail pagina:
- `approving` state variabele
- `handleStatusChange(newStatus)` functie: PATCH naar `/api/designs/[id]` met `{ status: newStatus }`
- "Goedkeuren" knop (groen, zet REVIEW → APPROVED) + "Afwijzen" knop (rood border, zet REVIEW → DRAFT)
- Knoppen verschijnen naast "Bewerken" alleen wanneer `design.status === 'REVIEW'`
- Na status wijziging: `setDesign(data.design)` voor directe UI update

**`src/app/page.tsx`** — Homepage:
- `bulkApproving` state variabele
- `runBulkApprove()` functie: `Promise.all()` over alle REVIEW designs met PATCH naar APPROVED
- Blauwe knop "Keur X REVIEW goed" verschijnt wanneer `stats.review > 0`
- Bevestigingsdialoog vooraf; na voltooiing: `fetchDesigns()` herlaadt lijst

**Geen nieuw API endpoint nodig** — bestaande `PATCH /api/designs/[id]` accepteert `{ status: 'APPROVED' }` (Prisma skipt undefined velden)

### SKU fix: dubbele producttype prefix bij forked designs

**Probleem**: Forked designs krijgen een designCode met producttype suffix (bijv. `FRMHRF-MC`). De SKU-bouw functies voegden het producttype prefix ook toe, waardoor SKUs als `MC-FRMHRF-MC-400-ADI-1` ontstonden (dubbel `-MC-`). Shopify verwacht `MC-FRMHRF-400-ADI-1`.

**`src/lib/variants.ts`**
- Nieuwe helper `stripProductTypeSuffix(designCode)`: verwijdert trailing `-IB`, `-SP`, `-MC` via regex `/(-(IB|SP|MC))$/i`
- `buildIbSku()`, `buildMcSku()`, `buildSpSku()`: alle drie gebruiken nu `stripProductTypeSuffix(designCode)` voor de code in de SKU

**Data cleanup**: 3 forked designs (FRMHRF-MC, FRMHRF-SP, PPFIMP-SP) — alle 84 varianten verwijderd en opnieuw gegenereerd met correcte SKUs. Geen van deze designs was naar Shopify gepubliceerd.

**TypeScript check**: `npx tsc --noEmit` → 0 errors
