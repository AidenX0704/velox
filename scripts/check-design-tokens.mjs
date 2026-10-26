#!/usr/bin/env node
/**
 * Design guard — fails the build when a rule from the v2 design system is
 * broken. Deliberately narrow: it checks invariants that are cheap to verify
 * and expensive to notice by eye.
 *
 *   node scripts/check-design-tokens.mjs
 */
import { readFileSync } from 'node:fs'
import fg from 'fast-glob'

const errors = []
const warnings = []

const cssFiles = fg.sync('src/renderer/src/**/*.css')
const tsFiles = fg.sync('src/renderer/src/**/*.{ts,tsx}')

const read = (file) => readFileSync(file, 'utf8')

/* 1. no pure black in stylesheets (mask gradients are exempt: #000 there is an
      alpha channel, not a surface colour) */
for (const file of cssFiles) {
  const lines = read(file).split('\n')

  lines.forEach((line, index) => {
    if (/#000\b|#000000\b/i.test(line) && !/mask|clip-path/i.test(line)) {
      errors.push(`${file}:${index + 1} 纯黑被禁止（用 --surface-canvas / #0b0b0a）`)
    }
  })
}

/* 2. Semi UI must not come back (comments in docs/headers are ignored) */
for (const file of [...tsFiles, ...cssFiles]) {
  const text = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  if (text.includes('@douyinfe/semi-ui')) {
    errors.push(`${file} 仍在引用 @douyinfe/semi-ui`)
  }
}

/* 3. design-system invariants must exist somewhere in the stylesheet */
const allCss = cssFiles.map(read).join('\n')
const invariants = [
  ['text-wrap: pretty', '规则 8：正文缺少 text-wrap: pretty'],
  ['grid-template-rows: 0fr', '规则 7：缺少 Grid 折叠实现'],
  ['tabular-nums', '规则 6：缺少 tabular-nums'],
  ['vertical-align: -0.125em', '规则 5：缺少行内图标对齐'],
  ['--ease-drag', '规则 9：缺少弹簧缓动令牌'],
  ['cubic-bezier(0.215, 0.61, 0.355, 1)', '规则 4：缺少流式打字缓动']
]

for (const [needle, message] of invariants) {
  if (!allCss.includes(needle)) {
    errors.push(message)
  }
}

/* 4. focus rings must not be removed without a replacement */
if (/outline:\s*none/.test(allCss) && !/box-shadow:\s*\n?\s*inset 0 0 0 1\.5px/.test(allCss)) {
  errors.push('检测到 outline: none，但没有双环 box-shadow 焦点样式')
}

/* 5. every transition should use a shared easing token */
const rawTransitions = allCss
  .split('\n')
  .filter((line) => line.includes('transition:'))
  // `var(--ease-out-quart)` contains the substring "ease-out"; only bare
  // keywords are a problem.
  .filter((line) => !line.includes('var(--ease'))
  .filter((line) =>
    /transition:[^;]*\b(ease|ease-in|ease-out|ease-in-out|linear)\b[^;]*;/.test(line)
  )

if (rawTransitions.length > 0) {
  warnings.push(`有 ${rawTransitions.length} 处 transition 直接使用关键字缓动，建议改用 --ease-*`)
}

for (const warning of warnings) {
  console.warn(`warn  ${warning}`)
}

if (errors.length > 0) {
  console.error(`\n✖ design guard 失败，共 ${errors.length} 项：`)
  for (const error of errors) {
    console.error(`  - ${error}`)
  }
  process.exit(1)
}

console.log(`✓ design guard 通过（${cssFiles.length} 个样式表，${tsFiles.length} 个源文件）`)
