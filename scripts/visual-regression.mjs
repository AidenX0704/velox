#!/usr/bin/env node
/**
 * Visual regression baseline.
 *
 * Launches the real packaged renderer (not a browser mock) with a fixed window
 * size, a fixed theme and a throw-away profile, asks the main process to capture
 * one frame, then compares it against `design/baselines/`.
 *
 *   node scripts/visual-regression.mjs            # compare
 *   node scripts/visual-regression.mjs --update   # (re)write baselines
 *
 * Requires `npm run build` first. No new dependencies: PNG decoding uses the
 * `pngjs` package the app already ships.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'
import { PNG } from 'pngjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_DIR = join(root, 'design', 'baselines')
const FIXTURE = join(root, 'design', 'fixtures', 'typography.md')
const WINDOW_SIZE = '1280x820'
const CAPTURE_DELAY = '1600'
const TIMEOUT_MS = 40_000
/** Per-channel difference above which a pixel counts as changed. */
const CHANNEL_THRESHOLD = 12
/** Allowed fraction of changed pixels. */
const MAX_DIFF_RATIO = 0.002

const scenarios = [
  { name: 'editor-light', appearance: 'light' },
  { name: 'editor-dark', appearance: 'dark' }
]

const update = process.argv.includes('--update')

async function capture(scenario) {
  const workdir = mkdtempSync(join(tmpdir(), `velox-visual-${scenario.name}-`))
  const target = join(workdir, 'capture.png')
  const env = { ...process.env }

  // Agents/CI often export this; it would make Electron run as plain Node.
  delete env.ELECTRON_RUN_AS_NODE

  const child = spawn(
    electronPath,
    [
      '.',
      FIXTURE,
      `--capture=${target}`,
      `--capture-delay=${CAPTURE_DELAY}`,
      `--appearance=${scenario.appearance}`,
      `--window-size=${WINDOW_SIZE}`,
      `--user-data-dir=${join(workdir, 'profile')}`,
      '--disable-gpu-compositing',
      // Pin the device pixel ratio so a HiDPI machine and CI produce the same PNG.
      '--force-device-scale-factor=1'
    ],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] }
  )

  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk)
  })

  const finished = new Promise((resolvePromise) => {
    child.once('exit', () => resolvePromise('exit'))
  })

  const timeout = new Promise((resolvePromise) => {
    setTimeout(() => resolvePromise('timeout'), TIMEOUT_MS)
  })

  const outcome = await Promise.race([finished, timeout])

  if (outcome === 'timeout') {
    child.kill()
  }

  const ok = existsSync(target)
  const png = ok ? PNG.sync.read(await readFile(target)) : null

  rmSync(workdir, { recursive: true, force: true })

  return { ok, png, stderr }
}

function compare(expected, actual) {
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      ratio: 1,
      reason: `尺寸不同：基线 ${expected.width}x${expected.height}，实际 ${actual.width}x${actual.height}`
    }
  }

  let changed = 0
  const total = expected.width * expected.height

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4

    if (
      Math.abs(expected.data[offset] - actual.data[offset]) > CHANNEL_THRESHOLD ||
      Math.abs(expected.data[offset + 1] - actual.data[offset + 1]) > CHANNEL_THRESHOLD ||
      Math.abs(expected.data[offset + 2] - actual.data[offset + 2]) > CHANNEL_THRESHOLD
    ) {
      changed += 1
    }
  }

  return { ratio: changed / total, changed, total }
}

mkdirSync(BASELINE_DIR, { recursive: true })

if (!existsSync(join(root, 'out', 'renderer', 'index.html'))) {
  console.error('✖ 未找到 out/renderer：请先运行 npm run build')
  process.exit(1)
}

const failures = []

for (const scenario of scenarios) {
  const baselinePath = join(BASELINE_DIR, `${scenario.name}.png`)
  const { ok, png, stderr } = await capture(scenario)

  if (!ok || !png) {
    failures.push(
      `${scenario.name}: 未生成截图${stderr ? `（stderr: ${stderr.trim().slice(0, 200)}）` : ''}`
    )
    continue
  }

  if (update || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, PNG.sync.write(png))
    console.log(`  ${scenario.name}: 基线已写入 (${png.width}x${png.height})`)
    continue
  }

  const baseline = PNG.sync.read(await readFile(baselinePath))
  const result = compare(baseline, png)

  if (result.reason) {
    failures.push(`${scenario.name}: ${result.reason}`)
    continue
  }

  const percent = (result.ratio * 100).toFixed(3)
  const verdict = result.ratio > MAX_DIFF_RATIO ? '✖' : '✓'
  console.log(
    `  ${verdict} ${scenario.name}: ${result.changed} / ${result.total} 像素不同 (${percent}%)`
  )

  if (result.ratio > MAX_DIFF_RATIO) {
    failures.push(
      `${scenario.name}: 差异 ${percent}% 超过阈值 ${(MAX_DIFF_RATIO * 100).toFixed(1)}%`
    )
  }
}

if (failures.length > 0) {
  console.error('\n✖ 可视回归失败：')
  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }
  console.error('\n如需更新基线：node scripts/visual-regression.mjs --update')
  process.exit(1)
}

console.log(update ? '\n✓ 基线已更新' : '\n✓ 可视回归通过')
