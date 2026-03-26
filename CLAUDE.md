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
- `status`: DRAFT | REVIEW | APPROVED | LIVE | FAILED

### Variant
- `productType`: IB | MC | SP
- `sku`: e.g. `IB-CALMM-520-350`
- `ean`: EAN-13 barcode
- `size`, `material`, `price`, `weight`
- `shopifyProductId`, `shopifyVariantId`

### Content
- `language`: nl | de | en | fr
- `description`: korte beschrijving (1-2 zinnen) — Shopify `body_html`, verschijnt boven de koop-knop
- `longDescription`: lange beschrijving (2-3 paragrafen) — Shopify metafield `custom.long_description`
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
- SKU structure: `{PREFIX}-{CODE}-{WIDTH}-{HEIGHT}` (IB/SP) or `{PREFIX}-{CODE}-{DIAMETER}` (MC)
- Publishes as DRAFT; bulk publish only for APPROVED designs
- Images: mockup `driveUrl` passed as `images[{ src }]` — Drive URL public access not yet verified
- `body_html` = korte description (`description` veld)
- Long description via metafield `custom.long_description` (multi_line_text_field)

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
- Material: Aluminium-Dibond, matte coating (no vinyl texture)
- SKU: `MC-{CODE}-{DIAMETER_MM}`
- Prices: €19.95–€44.95

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

## EAN Codes — Architectuur & GS1 Inventarisatie (2026-03-26)

### Huidige implementatie

| Bestand | Rol |
|---|---|
| `src/lib/ean.ts` | Core EAN logica: check-digit berekening, validatie, sequentiële generatie, bulk-assign |
| `src/lib/variants.ts` | EAN wordt toegewezen bij aanmaken van elke variant (IB/SP/MC) |
| `src/app/api/ean/assign/route.ts` | REST API: `POST /api/ean/assign` (vul ontbrekende EANs), `GET` (preview hoeveel ontbreken) |
| `src/lib/shopify.ts` | EAN naar Shopify als `barcode` veld + metafield `custom.ean` |
| `prisma/schema.prisma` | `Variant.ean String?` met index |

**EAN generatie algoritme** (`src/lib/ean.ts`):
- GS1 bedrijfsprefix KitchenArt: **`8721476`** (hardcoded als seed `8721476881239`)
- Strategie: hoogste bestaande EAN in DB ophalen → +1 → check-digit herberekenen
- Volledig offline/lokaal — geen API-aanroep naar GS1 nodig

**EAN toewijzing**: bij `generateSpVariants()`, `generateIbVariants()`, `generateMcVariants()` — elke variant krijgt direct een EAN via `await generateNextEan()`.

### GS1 EAN aanvragen: inventarisatie

**Conclusie: GS1 biedt geen API voor het aanvragen van nieuwe EAN-codes.**

| Vraag | Antwoord |
|---|---|
| Heeft GS1 een API voor EAN-toewijzing? | **Nee.** GS1 API's zijn alleen voor *opzoeken* van bestaande codes (Verified by GS1, GS1 US Data Hub). Geen toewijzing via API. |
| Hoe werkt het GS1 model? | Je koopt een **bedrijfsprefix** bij GS1 NL. Daarna wijs jij zelf productnummers toe. Volledig automatiseerbaar in code. |
| Zijn er third-party EAN resellers? | Ja, maar **niet aanbevolen** — codes staan op naam van de reseller, niet van KitchenArt. Amazon/bol.com controleren dit via GS1 registry. |
| Wat kost GS1 NL lidmaatschap? | ~€100–300/jaar voor een 7-cijferig prefix (100.000 EAN-nummers capaciteit). Eenmalige setup. |

**KitchenArt heeft al een GS1 bedrijfsprefix** (`8721476`) — dit betekent dat de huidige implementatie volledig GS1-compliant is. Er is **geen actie vereist** om EAN-aanvraag te automatiseren: de generatie is al volledig geautomatiseerd en offline.

### Wat is er nodig voor EAN-automatisering?

**Niets nieuws** — het werkt al:
1. GS1 prefix `8721476` is in gebruik
2. `generateNextEan()` genereert sequentieel, volledig in-process
3. Elke nieuwe variant krijgt automatisch een EAN bij `generateVariants()`
4. Backfill via `POST /api/ean/assign` voor ontbrekende EANs

**Enige optionele verbetering**: EAN-nummers registreren in de GS1 online portal (gs1.nl) zodat ze ook verschijnen in "Verified by GS1" lookups. Dit is een handmatige stap, of te automatiseren via CSV-upload op gs1.nl (geen API beschikbaar). Voor KitchenArt's huidige schaal is dit niet urgent.
