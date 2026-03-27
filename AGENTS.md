# Design Flow — Agent Instructions

Full end-to-end print-on-demand pipeline for KitchenArt (kitchenart.nl).
Notion design library → mockup generation (Photoshop JSX) → Google Drive → Shopify publishing.

**Local web UI**: Next.js 15 + TypeScript + SQLite (Prisma), runs on port 3000.
**Location**: `/Users/Michel/Desktop/Shopify/design-flow/`

---

## Build / Lint / Type-check Commands

```bash
npm run dev              # Start dev server with Turbopack (port 3000)
npm run build            # Production build
npm run lint             # ESLint (eslint-config-next)
npx tsc --noEmit         # TypeScript check — run this before committing

npm run db:push          # Apply schema changes to SQLite (npx prisma db push)
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:studio        # Open Prisma Studio GUI
```

There are **no automated tests** in this project. Verify changes by:
1. `npx tsc --noEmit` — must produce 0 errors
2. `npm run lint` — must produce 0 errors
3. Manual test via `npm run dev` in the browser

```bash
kill $(lsof -t -i:3000)  # Kill stuck dev server
rm -rf .next             # Wipe Next.js cache when build behaves unexpectedly
```

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # Next.js Route Handlers (server-only)
│   │   ├── ai/generate/        # POST — Claude vision content generation
│   │   ├── designs/[id]/       # GET/PATCH/DELETE + sub-routes per action
│   │   ├── ean/                # EAN assign + GS1 sync
│   │   ├── notion/             # Notion sync
│   │   ├── shopify/            # Shopify helpers
│   │   └── workflow/bulk*/     # NL→DE→EN pipeline + bulk publish
│   ├── designs/[id]/page.tsx   # Design detail page (large client component)
│   ├── brand-voice/            # Brand voice UI
│   ├── upload/                 # Upload new design UI
│   └── page.tsx                # Dashboard
└── lib/
    ├── ai.ts                   # Claude Sonnet — content generation
    ├── constants.ts            # Collections, sizes, pricing, SKU prefixes
    ├── drive.ts                # Google Drive — upload, list, proxy
    ├── ean.ts                  # EAN-13 generation and validation
    ├── env.ts                  # Environment variable helpers
    ├── gs1.ts                  # GS1 NL OAuth2 + GTIN registration
    ├── mockup-config.ts        # 44 PSD templates mapped (IB/SP/MC)
    ├── mockup.ts               # Mockup generation + Drive upload
    ├── notion.ts               # Notion read/write
    ├── print-config.ts         # Print template config (IB/SP/MC)
    ├── print.ts                # PDF generation via pdf-lib
    ├── prisma.ts               # Prisma client singleton
    ├── shopify.ts              # Shopify Admin REST API
    ├── shopify-translations.ts # Shopify Translations GraphQL API
    ├── translation.ts          # NL→DE/EN via Claude or DeepL
    └── variants.ts             # SKU/EAN variant generation
```

---

## Code Style

### TypeScript
- **Strict mode** is on (`"strict": true` in tsconfig). No `any` types unless absolutely unavoidable.
- Use explicit return types on exported functions.
- Use union types for constrained string values: `'IB' | 'SP' | 'MC'`, `'nl' | 'de' | 'en' | 'fr'`.
- Use `interface` for object shapes, `type` for unions and aliases.
- Cast narrow types where needed: `productType as 'IB' | 'SP' | 'MC'`.
- `npx tsc --noEmit` must pass with 0 errors before any commit.

### Imports
- Use `@/lib/...` path alias for all imports from `src/lib/` (configured in tsconfig).
- API routes import from `@/lib/...`; lib files import from relative `./` paths.
- Import order: external packages first, then `@/lib/` aliases, then relative.
- No barrel `index.ts` files — import directly from the module file.

### Formatting
- No Prettier config in the repo. Follow the existing style: no semicolons, single quotes, 2-space indent.
- Line length: keep under ~120 chars; break long function signatures onto multiple lines.
- Trailing commas in multi-line objects/arrays.

### Naming
- **Files/directories**: `kebab-case` (e.g. `shopify-translations.ts`, `mockup-config.ts`).
- **Functions**: `camelCase` verbs (e.g. `buildShopifyProduct`, `generateSpVariants`).
- **Interfaces/types**: `PascalCase` (e.g. `GeneratedContent`, `MockupTemplate`).
- **Constants**: `SCREAMING_SNAKE_CASE` for module-level constants (e.g. `SP_MATERIALS`, `IB_PRINT_BASE`).
- **React components**: `PascalCase` functions defined inline in page files.
- **API route files**: always named `route.ts`, co-located in `app/api/...` directory.

### Error Handling
- **API routes**: wrap handler body in `try/catch`, return `NextResponse.json({ error: '...' }, { status: 5xx })`.
- **Non-fatal operations** (GS1 registration, translation push): wrap in inner `try/catch`, log with `console.error` or `console.warn`, and continue. Never let these fail the main operation.
- **External API calls**: check required env vars at the top of the function and throw a descriptive error if missing.
- **Shopify fetch**: uses `AbortSignal.timeout(8000)` — always apply a timeout to external fetches.
- Never swallow errors silently (no empty `catch {}`); always log or rethrow.

### API Routes (Next.js Route Handlers)
- File: `src/app/api/.../route.ts` — export named functions `GET`, `POST`, `PATCH`, `DELETE`.
- Signature: `async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> })`.
- Always `await params` before use (Next.js 15 async params pattern).
- Return `NextResponse.json(...)` — never use raw `Response`.
- Validate required body fields early; return `400` for missing/invalid input.

### Database (Prisma + SQLite)
- Import the shared client: `import { prisma } from '@/lib/prisma'` (singleton).
- Use `prisma.model.upsert` for idempotent operations (variant creation, content saves).
- `Content.altText` column still exists in the DB — **never remove it via migration**; simply don't read or write it.
- `DATABASE_URL` includes `?connection_limit=1&socket_timeout=10` — do not add concurrent transactions.

---

## Key Constraints & Gotchas

- **Never call `save()` on original PSDs** in Photoshop JSX scripts — only work with copies.
- **`pdf-lib`** is in `serverExternalPackages` in `next.config.js` — keep it there; if it crashes, check `node_modules/pdf-lib/cjs/core/embedders/` for missing files and reinstall.
- **Drive image URLs**: use `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` with a service account JWT — never use `thumbnail` or `usercontent` URLs (require auth or don't work in browser).
- **Shopify Translations API**: use GraphQL `translationsRegister`, not the deprecated REST `/translations` endpoint. All translation errors are non-fatal.
- **EAN generation**: GS1 prefix `8721476` — generation is purely local (DB max + 1); `registerGtin()` is fire-and-forget.
- **SP product type**: when checking `splashFriendly / circleFriendly / inductionFriendly`, check `splashFriendly` first to avoid assigning wrong AI product type.
- **Language**: all comments, variable names, and commit messages are in English. UI text and content generation is in Dutch (NL primary, DE/EN secondary).

---

## Environment Variables (never commit `.env`)

```
NOTION_TOKEN
NOTION_DATABASE_ID=cdfd18fb-5193-4666-a885-b9e8d1c538bf
ANTHROPIC_API_KEY
SHOPIFY_ACCESS_TOKEN
SHOPIFY_STORE_URL=kitchenart.myshopify.com
SHOPIFY_API_VERSION=2024-04
NEXT_PUBLIC_SHOPIFY_CONFIGURED=true
GOOGLE_SERVICE_ACCOUNT_KEY   # JSON string of service account credentials
GOOGLE_DRIVE_FOLDER_ID
GS1_CLIENT_ID / GS1_CLIENT_SECRET / GS1_ACCOUNT_NUMBER / GS1_CONTRACT_NUMBER
DATABASE_URL=file:./dev.db?connection_limit=1&socket_timeout=10
```
