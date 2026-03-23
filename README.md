# Design Flow - Print-on-Demand Product Workflow Manager

Een lokale webapplicatie voor het beheren van het print-on-demand productworkflow, van design tot Shopify publicatie.

## Features

- **Notion Integratie**: Synchroniseer designs automatisch vanuit je Notion Design Library
- **AI Content Generatie**: Laat Claude Sonnet productbeschrijvingen, alt-teksten en SEO-content genereren
- **Automatische Vertaling**: DeepL integratie voor NL → DE, EN, FR vertalingen
- **Variant Beheer**: Automatisch SKU's genereren voor inductiebeschermers, muurcirkels en spatschermen
- **EAN Generatie**: GS1 compatible EAN codegeneratie per variant
- **Shopify Publicatie**: Direct publiceren naar Shopify via Admin API
- **Workflow Tracking**: Volg de status van elke stap in het workflow proces

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript)
- **Database**: SQLite via Prisma ORM
- **AI**: Anthropic Claude Sonnet
- **Vertaling**: DeepL API
- **Integraties**: Notion, Shopify

## Installatie

1. Kloon of kopieer de project directory
2. Installeer dependencies:
   ```bash
   npm install
   ```
3. Kopieer `.env.example` naar `.env` en vul de API keys in:
   - `NOTION_TOKEN` - Je Notion integration token
   - `ANTHROPIC_API_KEY` - Anthropic API key voor Claude
   - `DEEPL_API_KEY` - DeepL API key voor vertalingen
   - `SHOPIFY_ACCESS_TOKEN` - Shopify Admin API token

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
Klik op "Manage" bij een design om:
- Variants aan te maken (met SKU's)
- AI content te genereren
- Content te vertalen naar andere talen
- Workflow stappen te volgen

### 3. Content Genereren
1. Selecteer een product type (Inductiebeschermer, Muurcirkel, Spatscherm)
2. Klik "Generate NL Content (AI)" om beschrijving, alt-tekst en SEO-content te laten genereren
3. Vertalingen worden automatisch beschikbaar via de DeepL integratie

### 4. Variants Aanmaken
Klik "Create Variants" om automatisch alle standaard formaten aan te maken met correcte SKU's.

## Workflow Stappen

1. **DESIGN_UPLOAD** - Design informatie is ingevuld
2. **CONTENT_GENERATION** - AI content is gegenereerd
3. **AI_REVIEW** - Content is reviewed
4. **TRANSLATION** - Vertalingen zijn gegenereerd
5. **MOCKUP_GENERATION** - Mockups zijn aangemaakt
6. **PRINTFILE_GENERATION** - Printbestanden zijn klaar
7. **EAN_GENERATION** - EAN codes zijn toegewezen
8. **SHOPIFY_PUBLISH** - Product is gepubliceerd
9. **NOTION_SYNC** - Notion is bijgewerkt

## API Endpoints

- `GET /api/designs` - Haal alle designs op
- `POST /api/designs` - Maak nieuw design aan
- `GET /api/designs/[id]` - Haal design details op
- `PATCH /api/designs/[id]` - Update design
- `DELETE /api/designs/[id]` - Verwijder design
- `POST /api/designs/[id]/variants` - Maak variants aan
- `POST /api/designs/[id]/translate` - Vertaal content
- `POST /api/notion` - Sync met Notion
- `POST /api/ai/generate` - Genereer AI content

## Product Types & SKU Structuur

| Product | Prefix | Voorbeeld SKU |
|---------|--------|---------------|
| Inductiebeschermer | IB | IB-CALMM-520-350 |
| Muurcirkel | MC | MC-CALMM-400-ADI |
| Spatscherm | SP | SP-CALMM-600-300 |

## TODO

- [ ] Shopify publicatie integratie afmaken
- [ ] EAN generatie implementeren
- [ ] Mockup generatie integratie (Photoshop scripts)
- [ ] Printbestand management
- [ ] Notion write-back na publicatie
- [ ] Multi-shop ondersteuning
