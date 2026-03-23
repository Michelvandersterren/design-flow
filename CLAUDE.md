# Design Flow - Print-on-Demand Product Workflow System

## Overview

A local web application that syncs designs from Notion, generates AI content, translates via DeepL, and manages Shopify product publishing.

## Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: SQLite via Prisma ORM
- **APIs**: Notion API, Claude Sonnet (Anthropic), DeepL, Shopify
- **Location**: `/Users/Michel/Desktop/Shopify/design-flow/`

## Project Structure

```
design-flow/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── dev.db           # SQLite database
├── src/
│   ├── app/
│   │   ├── api/         # API routes
│   │   │   ├── notion/  # Notion sync
│   │   │   ├── designs/ # CRUD operations
│   │   │   └── ai/      # AI content generation
│   │   ├── page.tsx     # Dashboard
│   │   └── designs/[id]/page.tsx  # Design detail
│   └── lib/
│       ├── prisma.ts    # DB client
│       ├── notion.ts    # Notion client
│       ├── ai.ts        # Claude Sonnet
│       └── translation.ts  # DeepL
├── .env                 # Environment variables
└── package.json
```

## Data Models

### Design
- `notionId`: Notion page ID
- `designCode`: Unique design identifier (e.g., "CALMM")
- `designName`, `designType`, `styleFamily`
- `inductionFriendly`, `circleFriendly`, `splashFriendly`: Boolean flags
- `collections`, `colorTags`: JSON arrays
- `status`: DRAFT | LIVE
- `notionData`: Full Notion page JSON

### Variant
- Links to Design
- `sku`: Product SKU (e.g., "IB-CALMM-520-350")
- `ean`: Product barcode
- `productType`: IB (Induction) | MC (Circle) | SP (Splash)
- `size`, `price`, `shopifyVariantId`

### Content
- Links to Design
- `language`: NL | DE | EN | FR
- `title`, `description`, `seoTitle`, `seoDescription`, `altText`
- `generatedAt`: Timestamp

### WorkflowStep
- Tracks workflow progress per design
- `step`: DESIGN_SYNC | CONTENT_GENERATED | TRANSLATED | VARIANTS_CREATED | PUBLISHED
- `status`: pending | in_progress | completed | failed

## Key Integrations

### Notion Design Library
- Database ID: `cdfd18fb-5193-4666-a885-b9e8d1c538bf`
- Integration: "Design_Flow" (token in `.env`)
- Fields: Design Name, Design Code, Design Type, Style Family, Collection, Color Tags, Live, Induction-friendly, Circle-friendly, Splash-friendly

### Shopify
- 405 products, 305 unique design codes
- SKU structure: `{PREFIX}-{CODE}-{WIDTH}-{HEIGHT}`
- Prefixes: IB (Inductiebeschermers), MC (Muurcirkels), SP (Spatschermen)

### Claude Sonnet (AI Content)
- Generates: descriptions, alt-text, SEO titles/descriptions
- Prompts in Dutch context

### DeepL (Translation)
- NL ↔ DE (primary)
- EN ↔ FR (planned)

## Environment Variables

```env
NOTION_TOKEN=ntn_...
NOTION_DATABASE_ID=cdfd18fb-5193-4666-a885-b9e8d1c538bf
ANTHROPIC_API_KEY=sk-ant-...
DEEPL_API_KEY=...
SHOPIFY_ACCESS_TOKEN=...
```

## Commands

```bash
npm run dev          # Start development server
npm run db:push      # Push schema changes
npm run db:studio    # Open Prisma Studio
npx prisma generate  # Generate Prisma client
```

## Workflow Steps

1. **Sync** - Pull designs from Notion Design Library
2. **Generate** - Create AI content (NL descriptions)
3. **Translate** - DeepL to DE (and future EN/FR)
4. **Variants** - Create product variants with SKUs/EANs
5. **Publish** - Push to Shopify

## Current Status

- ✅ Full Notion sync: 291 designs, 0 errors
- ✅ AI content generation (Claude Sonnet) working — tested on Taupe Mist (TAUPM)
- ✅ Translation via Claude (NL → DE) working — DeepL optional when key is added
- ✅ Variant generation (IB: 19 sizes, MC: 4 sizes) working — idempotent
- ✅ Shopify product payload builder working — awaiting SHOPIFY_ACCESS_TOKEN

### Translation
- Primary: Claude Sonnet (works without DeepL key)
- Fallback to DeepL when `DEEPL_API_KEY` is set in `.env`
- Supported: NL → DE (EN, FR planned)

### Variant Sizes (IB)
- 19 standard sizes from 52×35cm to 91.6×52.7cm
- SKU format: `IB-{CODE}-{WIDTH_MM}-{HEIGHT_MM}` (e.g., `IB-TAUPM-520-350`)
- Prices: €33.50–€37.50 based on size

### Variant Sizes (MC)
- 4 standard diameters: 400, 600, 800, 1000mm
- SKU format: `MC-{CODE}-{DIAMETER_MM}` (e.g., `MC-TAUPM-600`)
- Prices: €19.95–€44.95

### API Routes
- `POST /api/designs/[id]/variants` — generate variants from design flags
- `GET  /api/designs/[id]/variants` — list variants grouped by type
- `POST /api/designs/[id]/translate` — translate NL content to DE/EN/FR
- `POST /api/designs/[id]/publish` — create draft product on Shopify (needs token)
- `GET  /api/designs/[id]/publish` — preview Shopify payload (no token needed)

### Next Steps
1. Add `SHOPIFY_ACCESS_TOKEN` to `.env` → publishing becomes live
2. Add `DEEPL_API_KEY` to `.env` → translations switch to DeepL
3. EAN generation (GS1 API or manual assignment)
4. Write-back to Notion (set Live = true after publish)
5. UI: dashboard + bulk actions for new design batches
