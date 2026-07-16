import { useCallback, useEffect, useState } from 'react'
import { Button, Dropdown, Tooltip } from '@douyinfe/semi-ui'
import { toggleMark } from 'prosemirror-commands'
import type { MarkType } from 'prosemirror-model'
import { type Command } from 'prosemirror-state'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  mergeCells,
  selectedRect,
  splitCell
} from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'
import { RICH_EDITOR_STATE_EVENT } from './editorEvents'

interface TableToolbarProps {
  view: EditorView
}

type TableAlignment = 'left' | 'center' | 'right'

interface TableToolbarState {
  alignment: TableAlignment | 'mixed'
  marks: Set<string>
  canMerge: boolean
  canSplit: boolean
}

function preventFocusLoss(event: React.MouseEvent): void {
  event.preventDefault()
}

export function TableToolbar({ view }: TableToolbarProps): React.JSX.Element {
  const [toolbarState, setToolbarState] = useState<TableToolbarState>(() =>
    getTableToolbarState(view)
  )

  const updateToolbarState = useCallback(() => {
    setToolbarState(getTableToolbarState(view))
  }, [view])

  useEffect(() => {
    const update = (): void => updateToolbarState()

    update()
    view.dom.addEventListener('input', update)
    view.dom.addEventListener('click', update)
    view.dom.addEventListener('keyup', update)
    view.dom.addEventListener(RICH_EDITOR_STATE_EVENT, update)
    document.addEventListener('selectionchange', update)

    return () => {
      view.dom.removeEventListener('input', update)
      view.dom.removeEventListener('click', update)
      view.dom.removeEventListener('keyup', update)
      view.dom.removeEventListener(RICH_EDITOR_STATE_EVENT, update)
      document.removeEventListener('selectionchange', update)
    }
  }, [updateToolbarState, view])

  const execCommand = useCallback(
    (command: Command) => {
      if (command(view.state, view.dispatch)) {
        view.focus()
        updateToolbarState()
      }
    },
    [updateToolbarState, view]
  )

  const execMark = useCallback(
    (mark: MarkType | undefined) => {
      if (mark) {
        execCommand(toggleMark(mark))
      }
    },
    [execCommand]
  )

  const markActive = (name: string): boolean => toolbarState.marks.has(name)

  return (
    <div className="format-toolbar table-format-toolbar" onMouseDown={preventFocusLoss}>
      <span className="table-toolbar-label">表格</span>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group">
        <Tooltip content="加粗" position="bottom">
          <Button
            size="small"
            theme={markActive('strong') ? 'light' : 'borderless'}
            type={markActive('strong') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={() => execMark(view.state.schema.marks.strong)}
          >
            <strong>B</strong>
          </Button>
        </Tooltip>
        <Tooltip content="斜体" position="bottom">
          <Button
            size="small"
            theme={markActive('em') ? 'light' : 'borderless'}
            type={markActive('em') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={() => execMark(view.state.schema.marks.em)}
          >
            <em>I</em>
          </Button>
        </Tooltip>
        <Tooltip content="删除线" position="bottom">
          <Button
            size="small"
            theme={markActive('strikethrough') ? 'light' : 'borderless'}
            type={markActive('strikethrough') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={() => execMark(view.state.schema.marks.strikethrough)}
          >
            <span className="table-toolbar-strike">S</span>
          </Button>
        </Tooltip>
      </div>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group table-toolbar-alignment" aria-label="表格列对齐">
        {(['left', 'center', 'right'] as const).map((alignment) => (
          <Tooltip
            key={alignment}
            content={`${alignment === 'left' ? '左' : alignment === 'center' ? '居中' : '右'}对齐当前列`}
            position="bottom"
          >
            <Button
              size="small"
              theme={toolbarState.alignment === alignment ? 'light' : 'borderless'}
              type={toolbarState.alignment === alignment ? 'primary' : 'tertiary'}
              className="format-toolbar-btn table-toolbar-align-btn"
              onMouseDown={preventFocusLoss}
              onClick={() => execCommand(setSelectedCellsAlignment(alignment))}
              aria-label={`${alignment === 'left' ? '左' : alignment === 'center' ? '居中' : '右'}对齐当前列`}
            >
              <span className={`table-align-icon table-align-icon-${alignment}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </Button>
          </Tooltip>
        ))}
      </div>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group">
        <Tooltip content="合并选中的单元格" position="bottom">
          <Button
            size="small"
            theme="borderless"
            className="format-toolbar-btn table-toolbar-text-btn"
            disabled={!toolbarState.canMerge}
            onMouseDown={preventFocusLoss}
            onClick={() => execCommand(mergeCells)}
          >
            合并
          </Button>
        </Tooltip>
        <Tooltip content="拆分当前单元格" position="bottom">
          <Button
            size="small"
            theme="borderless"
            className="format-toolbar-btn table-toolbar-text-btn"
            disabled={!toolbarState.canSplit}
            onMouseDown={preventFocusLoss}
            onClick={() => execCommand(splitCell)}
          >
            拆分
          </Button>
        </Tooltip>
      </div>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group">
        <Dropdown
          render={
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => execCommand(addRowBefore)}>上方插入行</Dropdown.Item>
              <Dropdown.Item onClick={() => execCommand(addRowAfter)}>下方插入行</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => execCommand(addColumnBefore)}>左侧插入列</Dropdown.Item>
              <Dropdown.Item onClick={() => execCommand(addColumnAfter)}>右侧插入列</Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button
            size="small"
            theme="borderless"
            className="format-toolbar-btn table-toolbar-menu-btn"
          >
            插入 <span className="format-toolbar-chevron">▾</span>
          </Button>
        </Dropdown>
        <Dropdown
          render={
            <Dropdown.Menu>
              <Dropdown.Item type="danger" onClick={() => execCommand(deleteRow)}>
                删除所在行
              </Dropdown.Item>
              <Dropdown.Item type="danger" onClick={() => execCommand(deleteColumn)}>
                删除所在列
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item type="danger" onClick={() => execCommand(deleteTable)}>
                删除表格
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button
            size="small"
            theme="borderless"
            type="danger"
            className="format-toolbar-btn table-toolbar-menu-btn"
          >
            删除 <span className="format-toolbar-chevron">▾</span>
          </Button>
        </Dropdown>
      </div>
    </div>
  )
}

function getTableToolbarState(view: EditorView): TableToolbarState {
  const { state } = view
  const marks = new Set<string>()
  const { selection } = state

  if (selection.empty) {
    for (const mark of state.storedMarks ?? selection.$from.marks()) {
      marks.add(mark.type.name)
    }
  } else {
    state.doc.nodesBetween(selection.from, selection.to, (node) => {
      for (const mark of node.marks) {
        marks.add(mark.type.name)
      }
    })
  }

  return {
    alignment: getSelectedCellsAlignment(view),
    marks,
    canMerge: mergeCells(state),
    canSplit: splitCell(state)
  }
}

function getSelectedCellsAlignment(view: EditorView): TableAlignment | 'mixed' {
  const alignments = new Set<TableAlignment>()
  const { state } = view

  if (!isInTable(state)) {
    return 'left'
  }

  const rectangle = selectedRect(state)

  for (let column = rectangle.left; column < rectangle.right; column++) {
    const cell = rectangle.table.nodeAt(rectangle.map.map[column])

    if (cell) {
      alignments.add(normalizeAlignment(cell.attrs.align))
    }
  }

  return alignments.size === 1 ? [...alignments][0] : 'mixed'
}

function setSelectedCellsAlignment(alignment: TableAlignment): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) {
      return false
    }

    const rectangle = selectedRect(state)
    const cellPositions = rectangle.map.cellsInRect({
      left: rectangle.left,
      right: rectangle.right,
      top: 0,
      bottom: rectangle.map.height
    })
    const transaction = state.tr
    let changed = false

    for (const relativePosition of cellPositions) {
      const position = rectangle.tableStart + relativePosition
      const cell = state.doc.nodeAt(position)

      if (
        cell &&
        (normalizeAlignment(cell.attrs.align) !== alignment || cell.attrs.align === null)
      ) {
        transaction.setNodeMarkup(position, undefined, { ...cell.attrs, align: alignment })
        changed = true
      }
    }

    if (changed && dispatch) {
      dispatch(transaction)
    }

    return changed
  }
}

function normalizeAlignment(value: unknown): TableAlignment {
  return value === 'center' || value === 'right' ? value : 'left'
}
