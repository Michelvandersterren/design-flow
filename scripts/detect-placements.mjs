/**
 * detect-placements.mjs
 *
 * For each PNG template in public/mockup-templates/, reads the alpha channel
 * and finds the bounding box of the transparent region (alpha < 128).
 * That bounding box = where the design should be composited.
 *
 * Outputs a JSON result to /tmp/placements.json and prints a ready-to-paste
 * TypeScript placement block.
 *
 * Usage: node scripts/detect-placements.mjs
 */

import sharp from 'sharp'
import { readdir } from 'fs/promises'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = path.join(__dirname, '../public/mockup-templates')
const OUT_JSON = '/tmp/placements.json'

async function detectTransparentBounds(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info

  let minX = width, maxX = 0, minY = height, maxY = 0
  let foundTransparent = false

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      const alpha = data[idx + 3]
      if (alpha < 128) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        foundTransparent = true
      }
    }
  }

  if (!foundTransparent) {
    return null // no transparent area — entire image is opaque
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    canvasW: width,
    canvasH: height,
  }
}

async function main() {
  const subDirs = ['IB', 'SP', 'MC']
  const results = {}

  for (const sub of subDirs) {
    const dir = path.join(TEMPLATES_DIR, sub)
    if (!existsSync(dir)) continue

    const files = (await readdir(dir)).filter(f => f.endsWith('.png')).sort()
    for (const file of files) {
      const key = `${sub}/${file}`
      const fullPath = path.join(dir, file)
      process.stdout.write(`Scanning ${key} ... `)
      try {
        const bounds = await detectTransparentBounds(fullPath)
        if (bounds) {
          console.log(`transparent area: left=${bounds.left} top=${bounds.top} w=${bounds.width} h=${bounds.height}`)
          results[key] = bounds
        } else {
          console.log(`NO transparent area found — image is fully opaque`)
          results[key] = { note: 'fully opaque — no transparent cutout', canvasW: bounds?.canvasW, canvasH: bounds?.canvasH }
        }
      } catch (e) {
        console.log(`ERROR: ${e.message}`)
        results[key] = { error: e.message }
      }
    }
  }

  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2))
  console.log(`\nFull results written to ${OUT_JSON}`)

  // Print ready-to-use summary
  console.log('\n=== Placement summary ===')
  for (const [key, v] of Object.entries(results)) {
    if (v.left !== undefined) {
      console.log(`${key}: { left: ${v.left}, top: ${v.top}, width: ${v.width}, height: ${v.height} }`)
    } else {
      console.log(`${key}: ${JSON.stringify(v)}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
