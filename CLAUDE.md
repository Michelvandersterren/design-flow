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
- `description`, `altText`, `seoTitle`, `seoDescription`
- `translationStatus`

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
- ✅ Multi-language: NL/DE/EN translation
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

## Known Issues / Backlog

- Afbeeldingen worden niet getoond in de UI — `drive.usercontent.google.com/download?id=...&export=view` URLs laden niet in de browser (auth of CORS probleem) — **open**
- Shopify images: `driveUrl` passed as `images[{ src }]` — Drive public access not yet verified in production
- Stijlfamilies auto-generate: API not yet built (group designs into style families via Claude, write back to Notion)
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
