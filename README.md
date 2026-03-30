# Design Flow - Print-on-Demand Product Workflow Manager

Een lokale webapplicatie voor het beheren van het volledige print-on-demand productworkflow voor KitchenArt, van design tot Shopify publicatie.

## Features

- **Notion Integratie**: Synchroniseer designs automatisch vanuit je Notion Design Library
- **AI Content Generatie**: Claude Sonnet genereert productbeschrijvingen, SEO-content en Google Shopping descriptions op basis van het design (vision)
- **Automatische Vertaling**: NL naar DE, EN, FR vertalingen via Claude
- **Variant Beheer**: Automatisch SKU's en EAN-codes genereren voor inductiebeschermers, muurcirkels en spatschermen
- **Mockup Pipeline**: Photoshop JSX genereert JPEG mockups vanuit 44 PSD templates, opgeslagen op Google Drive
- **Print PDF Generatie**: PDF printbestanden via pdf-lib met CutContour spot color en 10mm bleed
- **Shopify Publicatie**: Direct publiceren naar Shopify met alle metafields, vertalingen en variant images
- **Health Check Dashboard**: 12 issue types detecteren (ontbrekende content, EANs, mockups, etc.)
- **Content Review**: Split-panel review UI met quality scoring op basis van brand voice regels
- **Bulk Regeneration**: Selectief content heropbouwen na brand voice wijzigingen
- **Post-Publish Verification**: Shopify product vergelijking met app-data
- **Workflow Tracking**: Volg de status van elke stap in het workflow proces

## Tech Stack

- **Frontend**: Next.js 15 (App Router, TypeScript, Turbopack)
- **Database**: SQLite via Prisma ORM
- **AI**: Anthropic Claude Sonnet (vision + text)
- **Integraties**: Notion, Shopify (REST + GraphQL), Google Drive, GS1 NL
- **Mockups**: Adobe Photoshop JSX (osascript)
- **PDFs**: pdf-lib
- **Tests**: Vitest (91 unit + 23 integration)

## Installatie

1. Kloon de repository:
   ```bash
   git clone https://github.com/Michelvandersterren/design-flow.git
   ```
2. Installeer dependencies:
   ```bash
   npm install
   ```
3. Kopieer `.env.example` naar `.env` en vul de API keys in:
   - `NOTION_TOKEN` - Notion integration token
   - `ANTHROPIC_API_KEY` - Anthropic API key voor Claude
   - `SHOPIFY_ACCESS_TOKEN` - Shopify Admin API token
   - `GOOGLE_SERVICE_ACCOUNT_KEY` - Google service account JSON
   - `GOOGLE_DRIVE_FOLDER_ID` - Google Drive folder ID
   - `GS1_CLIENT_ID` / `GS1_CLIENT_SECRET` - GS1 NL API credentials

4. Genereer Prisma client en push database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Start de ontwikkelserver:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

## Gebruik

### 1. Designs Synchroniseren
Klik op "Sync from Notion" om alle designs vanuit je Notion Design Library te importeren.

### 2. Design Beheren
Klik op een design om het te beheren:
- AI content genereren (NL)
- Content vertalen naar DE, EN, FR
- Variants aanmaken met SKU's en EAN-codes
- Mockups genereren via Photoshop
- Printbestanden genereren (PDF)
- Publiceren naar Shopify

### 3. Bulk Workflow
Gebruik het bulk workflow om meerdere designs tegelijk te verwerken:
1. Selecteer designs in DRAFT of REVIEW status
2. Start de pipeline: NL content → DE vertaling → EN vertaling → FR vertaling → variants
3. Review en keur goed
4. Bulk publish naar Shopify

### 4. Quality Control
- **Health Check** (`/health`): Detecteert ontbrekende content, EANs, mockups en andere issues
- **Content Review** (`/review`): Quality scoring op basis van brand voice, verboden woorden en AI-patronen
- **Post-Publish Verification**: Vergelijk app-data met live Shopify producten

## Workflow Stappen

1. **DESIGN_UPLOAD** - Design informatie is ingevuld
2. **CONTENT_GENERATION** - AI content is gegenereerd (NL)
3. **AI_REVIEW** - Content is reviewed
4. **TRANSLATION** - Vertalingen zijn gegenereerd (DE, EN, FR)
5. **MOCKUP_GENERATION** - Mockups zijn aangemaakt (44 templates)
6. **PRINTFILE_GENERATION** - Printbestanden zijn klaar (PDF met bleed)
7. **EAN_GENERATION** - EAN codes zijn toegewezen en GS1 geregistreerd
8. **SHOPIFY_PUBLISH** - Product is gepubliceerd naar Shopify
9. **NOTION_SYNC** - Notion is bijgewerkt met Shopify URL

## Commands

```bash
npm run dev              # Start dev server (Turbopack, port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Unit tests (91 tests)
npm run test:integration # Integration tests (23 tests, temp DB)
npm run test:all         # All tests

npm run db:push          # Apply schema changes
npm run db:generate      # Regenerate Prisma client
npm run db:studio        # Open Prisma Studio GUI
npx tsc --noEmit         # TypeScript check
```

## API Endpoints

### Designs
- `GET /api/designs` - Lijst designs (gepagineerd, filterable op status/collection/styleFamily/search)
- `POST /api/designs` - Maak nieuw design aan
- `GET /api/designs/[id]` - Haal design details op
- `PATCH /api/designs/[id]` - Update design
- `DELETE /api/designs/[id]` - Verwijder design (cascade)
- `POST /api/designs/[id]/variants` - Maak variants aan
- `POST /api/designs/[id]/translate` - Vertaal content (NL naar DE/EN/FR)
- `PATCH /api/designs/[id]/content` - Inline content edit per taal
- `POST /api/designs/[id]/fork` - Kopieer design voor ander producttype
- `POST /api/designs/[id]/mockup` - Genereer mockups
- `POST /api/designs/[id]/publish` - Publiceer naar Shopify
- `POST /api/designs/[id]/shopify-update` - Update bestaand Shopify product
- `POST /api/designs/[id]/verify` - Post-publish verificatie
- `POST /api/designs/approve` - Bulk approve
- `POST /api/designs/bulk-status` - Batch status transitions

### Overig
- `POST /api/ai/generate` - Genereer AI content (Claude vision)
- `POST /api/notion` - Sync met Notion
- `GET /api/health` - Health check (12 issue types)
- `GET /api/review` - Content quality review
- `GET/POST /api/regenerate` - Bulk content regeneration
- `GET/PUT /api/brand-voice` - Brand voice document
- `POST /api/ean/assign` - EAN toewijzing
- `POST /api/ean/gs1-sync` - GS1 backfill registratie
- `POST /api/workflow/bulk` - Bulk workflow pipeline
- `POST /api/workflow/bulk-publish` - Bulk Shopify publish

## Product Types & SKU Structuur

| Product | Prefix | Voorbeeld SKU | Materialen |
|---------|--------|---------------|------------|
| Inductiebeschermer | IB | IB-CALMM-520-350 | Vinyl |
| Muurcirkel | MC | MC-CALMM-600-ADI-1 | ADI (Aluminium Dibond), FRX (Forex) |
| Spatscherm | SP | SP-CALMM-600-300-G | G (Geen), BH0 (Boorgaten), BH4 (Boorgaten + afstandhouders) |
