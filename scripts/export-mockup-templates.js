#!/usr/bin/env node
/**
 * export-mockup-templates.js
 *
 * Runner for the Photoshop JSX export script.
 * Usage:  node scripts/export-mockup-templates.js
 *    or:  npm run export-mockups
 *
 * What it does:
 *   1. Copies the JSX to /tmp/ (so the path has no spaces issues)
 *   2. Launches the JSX in Photoshop 2026 via osascript (non-blocking)
 *   3. Tails /tmp/export-mockup-log.txt while the job runs
 *   4. Exits when Photoshop writes "=== Done" to the log
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const JSX_SRC = path.join(__dirname, 'export-mockup-templates.jsx');
const JSX_TMP = '/tmp/export-mockup-templates.jsx';
const LOG_FILE = '/tmp/export-mockup-log.txt';
const PS_APP   = 'Adobe Photoshop 2026';

// ── 1. Copy JSX to /tmp ───────────────────────────────────────────────────────
fs.copyFileSync(JSX_SRC, JSX_TMP);
console.log('JSX copied to', JSX_TMP);

// ── 2. Clear old log ──────────────────────────────────────────────────────────
if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

// ── 3. Launch Photoshop JSX via osascript (background) ───────────────────────
const osascript = `tell application "${PS_APP}" to do javascript file "${JSX_TMP}"`;
console.log('Launching Photoshop export script (this will take a while)...');
console.log('');

const ps = spawn('osascript', ['-e', osascript], {
  detached: true,
  stdio: 'ignore',
});
ps.unref();

// ── 4. Tail the log file ──────────────────────────────────────────────────────
console.log('Waiting for log file...');

// Wait for log file to appear (up to 60s)
let waited = 0;
while (!fs.existsSync(LOG_FILE) && waited < 60) {
  execSync('sleep 2');
  waited += 2;
  process.stdout.write('.');
}
console.log('');

if (!fs.existsSync(LOG_FILE)) {
  console.error('ERROR: Log file never appeared. Is Photoshop running?');
  process.exit(1);
}

// Stream log lines until we see "=== Done"
let lastSize = 0;
let done = false;
let idleSeconds = 0;
const MAX_IDLE = 300; // 5 min without new output → give up

console.log('─── Photoshop log ───────────────────────────────');

while (!done && idleSeconds < MAX_IDLE) {
  execSync('sleep 3');

  const stat = fs.statSync(LOG_FILE);
  if (stat.size > lastSize) {
    const buf = fs.readFileSync(LOG_FILE, 'utf8');
    const newText = buf.slice(lastSize);
    process.stdout.write(newText);
    lastSize = stat.size;
    idleSeconds = 0;

    if (buf.includes('=== Done')) {
      done = true;
    }
  } else {
    idleSeconds += 3;
  }
}

console.log('─────────────────────────────────────────────────');

if (!done) {
  console.error('Timed out waiting for Photoshop to finish.');
  process.exit(1);
}

// ── 5. Summary ────────────────────────────────────────────────────────────────
const log = fs.readFileSync(LOG_FILE, 'utf8');
const errors = (log.match(/ERROR:/g) || []).length;
const warnings = (log.match(/WARNING:/g) || []).length;

console.log('');
if (errors > 0) {
  console.log(`Completed with ${errors} error(s), ${warnings} warning(s).`);
  console.log('Check the log above or /tmp/export-mockup-log.txt for details.');
  process.exit(1);
} else {
  console.log(`All done. ${warnings} warning(s).`);
  console.log('PNG templates written to: design-flow/public/mockup-templates/');
}
