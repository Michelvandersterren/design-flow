/**
 * Integration test setup: creates a fresh SQLite test database before each
 * test file and cleans up afterward.
 *
 * Uses a unique temp file per worker to allow parallel test execution.
 */
import { execSync } from 'child_process'
import { unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, afterEach } from 'vitest'

const PROJECT_ROOT = join(__dirname, '..', '..')
const DB_PATH = join(tmpdir(), `design-flow-test-${process.pid}.db`)
const DB_URL = `file:${DB_PATH}`

// Override DATABASE_URL before any Prisma client is instantiated
process.env.DATABASE_URL = DB_URL

// Create a dedicated test client (avoids the singleton caching the prod URL)
export const testPrisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
  log: ['error'],
})

/**
 * Override the singleton in src/lib/prisma.ts so that all library code
 * (ean.ts, variants.ts) that imports `prisma` from there uses our test DB.
 */
function patchGlobalPrisma() {
  const g = globalThis as unknown as { prisma: PrismaClient | undefined }
  g.prisma = testPrisma
}

beforeAll(async () => {
  // Use the local prisma binary (much faster than npx)
  const prismaBin = join(PROJECT_ROOT, 'node_modules', '.bin', 'prisma')
  execSync(`"${prismaBin}" db push --skip-generate --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: DB_URL },
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  })

  // Patch the global singleton so library code uses the test DB
  patchGlobalPrisma()

  await testPrisma.$connect()
}, 30_000) // 30s timeout for schema push

afterEach(async () => {
  // Clean all rows between tests for isolation
  await testPrisma.variant.deleteMany()
  await testPrisma.content.deleteMany()
  await testPrisma.workflowStep.deleteMany()
  await testPrisma.designMockup.deleteMany()
  await testPrisma.designPrintFile.deleteMany()
  await testPrisma.design.deleteMany()
})

afterAll(async () => {
  await testPrisma.$disconnect()
  // Remove temp DB files
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const f = DB_PATH + suffix
    if (existsSync(f)) unlinkSync(f)
  }
})
