import assert from 'node:assert/strict'
import type { InputRule } from 'prosemirror-inputrules'
import type { Transaction } from 'prosemirror-state'
import { EditorState } from 'prosemirror-state'
import { CellSelection, mergeCells } from 'prosemirror-tables'
import {
  createMarkdownInputRules,
  normalizeRichMarkdown,
  parseRichMarkdown,
  richMarkdownSchema,
  serializeRichMarkdown
} from './markdownModel'
import { renderMultimdTableBlocks } from '../markdown/multimdTable'

interface MarkdownFixture {
  name: string
  input: string
  includes?: string[]
}

interface TestableInputRule extends InputRule {
  match: RegExp
  handler: (
    state: EditorState,
    match: RegExpMatchArray,
    start: number,
    end: number
  ) => Transaction | null
}

const fixtures: MarkdownFixture[] = [
  {
    name: 'headings and inline marks',
    input: [
      '# 标题',
      '',
      '包含 **加粗**、*斜体*、~~删除线~~、`code` 和 [链接](https://example.com)。'
    ].join('\n'),
    includes: ['# 标题', '**加粗**', '*斜体*', '~~删除线~~', '`code`']
  },
  {
    name: 'nested lists and quote',
    input: ['> 引用', '', '- 一级', '  - 二级', '', '1. 有序', '2. 列表'].join('\n'),
    includes: ['> 引用', '* 一级', '1. 有序']
  },
  {
    name: 'task list items',
    input: ['- [ ] 待办', '- [x] 完成'].join('\n'),
    includes: ['- [ ] 待办', '- [x] 完成']
  },
  {
    name: 'horizontal rule',
    input: ['上文', '', '---', '', '下文'].join('\n'),
    includes: ['上文', '---', '下文']
  },
  {
    name: 'code block',
    input: ['```ts', 'const message = "hello"', '```'].join('\n'),
    includes: ['```ts', 'const message = "hello"', '```']
  },
  {
    name: 'table with marked text',
    input: ['| 名称 | 值 |', '| --- | --- |', '| **A** | `1` |'].join('\n'),
    includes: ['| 名称 | 值 |', '| **A** | `1` |']
  },
  {
    name: 'table alignment',
    input: ['| 左 | 中 | 右 |', '| :--- | :---: | ---: |', '| A | B | 100 |'].join('\n'),
    includes: ['| :--- | :---: | ---: |', '| A | B | 100 |']
  },
  {
    name: 'merged table cells',
    input: [
      '| 阶段 | 进度 | 说明 |',
      '| :--- | :---: | --- |',
      '| 设计 || 已完成 |',
      '| ^^ | 开发 | 进行中 |'
    ].join('\n'),
    includes: ['| 设计 || 已完成 |', '| ^^ | 开发 | 进行中 |']
  },
  {
    name: 'math block and inline math',
    input: ['行内公式 $a+b$', '', '$$', 'E=mc^2', '$$'].join('\n'),
    includes: ['$a+b$', '$$', 'E=mc^2']
  }
]

for (const fixture of fixtures) {
  const once = normalizeRichMarkdown(fixture.input)
  const twice = normalizeRichMarkdown(once)

  assert.equal(twice, once, `${fixture.name}: rich markdown normalization must be idempotent`)

  for (const snippet of fixture.includes ?? []) {
    assert.ok(
      once.includes(snippet),
      `${fixture.name}: expected normalized markdown to include ${snippet}`
    )
  }
}

const renderedMergedTable = renderMultimdTableBlocks(
  ['| A | B | C |', '| --- | :---: | ---: |', '| 合并 || 3 |', '| ^^ | 2 | 4 |'].join('\n')
)

assert.match(renderedMergedTable, /colspan="2"/)
assert.match(renderedMergedTable, /rowspan="2"/)
assert.match(renderedMergedTable, /align="center"/)

assertMergedCellSerialization({
  name: 'horizontal merge command',
  markdown: ['| H1 | H2 | H3 |', '| --- | --- | --- |', '| A | B | C |'].join('\n'),
  anchorCellIndex: 3,
  headCellIndex: 4,
  expected: '|| C |'
})

assertMergedCellSerialization({
  name: 'vertical merge command',
  markdown: ['| H1 | H2 |', '| --- | --- |', '| A | B |', '| C | D |'].join('\n'),
  anchorCellIndex: 2,
  headCellIndex: 4,
  expected: '| ^^ | D |'
})

assertInputRule({
  name: 'horizontal rule input',
  initialMarkdown: '',
  text: '---',
  expectedMarkdown: '---'
})

assertInputRule({
  name: 'unchecked task item input',
  initialMarkdown: '',
  text: '- [ ] ',
  expectedMarkdown: '- [ ] '
})

assertInputRule({
  name: 'checked task item input',
  initialMarkdown: '',
  text: '- [x] ',
  expectedMarkdown: '- [x] '
})

console.log(`rich markdown fixtures passed: ${fixtures.length}`)

function assertMergedCellSerialization({
  name,
  markdown,
  anchorCellIndex,
  headCellIndex,
  expected
}: {
  name: string
  markdown: string
  anchorCellIndex: number
  headCellIndex: number
  expected: string
}): void {
  const doc = parseRichMarkdown(markdown)
  const cellPositions: number[] = []

  doc.descendants((node, position) => {
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      cellPositions.push(position)
    }
  })

  const state = EditorState.create({
    doc,
    schema: richMarkdownSchema,
    selection: CellSelection.create(
      doc,
      cellPositions[anchorCellIndex],
      cellPositions[headCellIndex]
    )
  })
  let nextState = state

  assert.equal(
    mergeCells(state, (transaction) => {
      nextState = state.apply(transaction)
    }),
    true,
    `${name}: expected merge command to be available`
  )
  assert.ok(
    serializeRichMarkdown(nextState.doc).includes(expected),
    `${name}: expected serialized markdown to include ${expected}`
  )
}

function assertInputRule({
  name,
  initialMarkdown,
  text,
  expectedMarkdown
}: {
  name: string
  initialMarkdown: string
  text: string
  expectedMarkdown: string
}): void {
  const state = EditorState.create({
    doc: parseRichMarkdown(initialMarkdown),
    schema: richMarkdownSchema
  })
  const rule = createMarkdownInputRules().find((candidate) =>
    (candidate as TestableInputRule).match.test(text)
  ) as TestableInputRule | undefined

  assert.ok(rule, `${name}: expected matching input rule`)

  const match = rule.match.exec(text)
  assert.ok(match, `${name}: expected regexp match`)

  const transaction = rule.handler(state, match, state.selection.from, state.selection.to)
  assert.ok(transaction, `${name}: expected transaction`)

  assert.equal(
    serializeRichMarkdown(state.apply(transaction).doc),
    expectedMarkdown,
    `${name}: input rule result mismatch`
  )
}
