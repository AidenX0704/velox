import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Tooltip } from '@douyinfe/semi-ui'
import { IconMoreStroked } from '@douyinfe/semi-icons'
import type { EditorView } from 'prosemirror-view'
import type { MarkType, NodeType } from 'prosemirror-model'
import type { Command } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { wrapInList, liftListItem } from 'prosemirror-schema-list'
import type { SourceMarkdownFormatAction } from '../source/SourceMarkdownEditor'

interface FormatToolbarProps {
  view?: EditorView | null
  fontSize?: number
  onFontSizeChange?: (size: number) => void
  onMarkdownFormat?: (action: SourceMarkdownFormatAction) => void
}

const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24]

function preventFocusLoss(e: React.MouseEvent): void {
  e.preventDefault()
}

function toggleMarkCommand(markType: MarkType): Command {
  return (state, dispatch) => {
    const { empty, from, to } = state.selection
    if (empty) {
      const marks = state.storedMarks ?? state.selection.$from.marks()
      const hasMark = marks.some((m) => m.type === markType)
      if (dispatch) {
        const tr = state.tr
        if (hasMark) {
          tr.removeStoredMark(markType)
        } else {
          tr.addStoredMark(markType.create())
        }
        dispatch(tr)
      }
      return true
    }
    const hasMark = state.doc.rangeHasMark(from, to, markType)
    if (dispatch) {
      const tr = hasMark
        ? state.tr.removeMark(from, to, markType)
        : state.tr.addMark(from, to, markType.create())
      dispatch(tr)
    }
    return true
  }
}

function setBlockTypeCommand(nodeType: NodeType, attrs?: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const parent = $from.node()
    if (parent.type === nodeType) {
      if (dispatch) {
        const tr = state.tr.setBlockType(
          $from.before(),
          $from.after(),
          state.schema.nodes.paragraph
        )
        dispatch(tr)
      }
      return true
    }
    if (dispatch) {
      const tr = state.tr.setBlockType($from.before(), $from.after(), nodeType, attrs)
      dispatch(tr)
    }
    return true
  }
}

function wrapInCommand(nodeType: NodeType): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const parent = $from.node()
    if (parent.type === nodeType) {
      if (dispatch) {
        const tr = state.tr.setBlockType(
          $from.before(),
          $from.after(),
          state.schema.nodes.paragraph
        )
        dispatch(tr)
      }
      return true
    }
    if (dispatch) {
      const tr = state.tr.wrap($from.blockRange()!, [{ type: nodeType }])
      dispatch(tr)
    }
    return true
  }
}

function liftCommand(): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    const parent = $from.node()
    if (parent.type.name !== 'paragraph') {
      if (dispatch) {
        const tr = state.tr.setBlockType(
          $from.before(),
          $from.after(),
          state.schema.nodes.paragraph
        )
        dispatch(tr)
      }
      return true
    }
    return false
  }
}

function insertHorizontalRuleCommand(): Command {
  return (state, dispatch) => {
    const horizontalRule = state.schema.nodes.horizontal_rule

    if (!horizontalRule) {
      return false
    }

    if (dispatch) {
      let tr = state.tr.replaceSelectionWith(horizontalRule.create()).scrollIntoView()
      const position = tr.selection.to

      if (state.schema.nodes.paragraph) {
        tr = tr.insert(position, state.schema.nodes.paragraph.create())
        tr = tr.setSelection(
          TextSelection.create(tr.doc, Math.min(position + 1, tr.doc.content.size))
        )
      }

      dispatch(tr)
    }

    return true
  }
}

function insertTaskListCommand(): Command {
  return (state, dispatch) => {
    const bulletList = state.schema.nodes.bullet_list
    const listItem = state.schema.nodes.list_item
    const paragraph = state.schema.nodes.paragraph

    if (!bulletList || !listItem || !paragraph) {
      return false
    }

    if (dispatch) {
      const taskList = bulletList.create(
        null,
        listItem.create({ checked: false }, paragraph.create())
      )
      dispatch(state.tr.replaceSelectionWith(taskList).scrollIntoView())
    }

    return true
  }
}

export function FormatToolbar({
  view,
  fontSize,
  onFontSizeChange,
  onMarkdownFormat
}: FormatToolbarProps): React.JSX.Element | null {
  const [cursorMarks, setCursorMarks] = useState<Set<string>>(new Set())
  const [currentBlockType, setCurrentBlockType] = useState<string>('paragraph')
  const [blockLevel, setBlockLevel] = useState<number>(0)

  useEffect(() => {
    if (!view) return

    const update = (): void => {
      const { selection } = view.state
      const marks = new Set<string>()

      if (selection instanceof NodeSelection) {
        setCurrentBlockType(selection.node.type.name)
        setBlockLevel(0)
      } else {
        const $from = selection.$from
        const node = $from.node()
        setCurrentBlockType(node.type.name)
        setBlockLevel(node.attrs.level ?? 0)

        view.state.doc.nodesBetween(selection.from, selection.to, (nd) => {
          if (nd.marks) {
            for (const mark of nd.marks) {
              marks.add(mark.type.name)
            }
          }
        })
      }

      setCursorMarks(marks)
    }

    update()
    view.dom.addEventListener('input', update)
    view.dom.addEventListener('click', update)
    view.dom.addEventListener('keyup', update)

    return () => {
      view.dom.removeEventListener('input', update)
      view.dom.removeEventListener('click', update)
      view.dom.removeEventListener('keyup', update)
    }
  }, [view])

  const execCommand = useCallback(
    (command: Command) => {
      if (!view) return
      const v = view
      command(v.state, v.dispatch)
      v.focus()
    },
    [view]
  )
  const execMarkdownFormat = useCallback(
    (action: SourceMarkdownFormatAction) => {
      onMarkdownFormat?.(action)
    },
    [onMarkdownFormat]
  )

  const isMarkActive = useCallback((markName: string) => cursorMarks.has(markName), [cursorMarks])

  const isBlockActive = useCallback(
    (typeName: string, level?: number) => {
      if (currentBlockType !== typeName) return false
      if (level !== undefined && blockLevel !== level) return false
      return true
    },
    [currentBlockType, blockLevel]
  )

  const handleBold = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('bold')
      return
    }
    execCommand(toggleMarkCommand(v.state.schema.marks.strong))
  }, [execCommand, execMarkdownFormat, view])

  const handleItalic = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('italic')
      return
    }
    execCommand(toggleMarkCommand(v.state.schema.marks.em))
  }, [execCommand, execMarkdownFormat, view])

  const handleStrikethrough = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('strikethrough')
      return
    }
    const mark = v.state.schema.marks.strikethrough ?? v.state.schema.marks.s
    if (mark) execCommand(toggleMarkCommand(mark))
  }, [execCommand, execMarkdownFormat, view])

  const handleInlineCode = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('inline-code')
      return
    }
    execCommand(toggleMarkCommand(v.state.schema.marks.code))
  }, [execCommand, execMarkdownFormat, view])

  const handleHeading = useCallback(
    (level: number) => {
      const v = view
      if (!v) {
        execMarkdownFormat(`heading-${level}` as SourceMarkdownFormatAction)
        return
      }
      if (isBlockActive('heading', level)) {
        execCommand(setBlockTypeCommand(v.state.schema.nodes.paragraph))
      } else {
        execCommand(setBlockTypeCommand(v.state.schema.nodes.heading, { level }))
      }
    },
    [isBlockActive, execCommand, execMarkdownFormat, view]
  )

  const handleBulletList = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('bullet-list')
      return
    }
    const { state, dispatch } = v
    if (isBlockActive('bullet_list')) {
      liftListItem(state.schema.nodes.list_item)(state, dispatch)
    } else {
      wrapInList(state.schema.nodes.bullet_list)(state, dispatch)
    }
    v.focus()
  }, [execMarkdownFormat, isBlockActive, view])

  const handleOrderedList = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('ordered-list')
      return
    }
    const { state, dispatch } = v
    if (isBlockActive('ordered_list')) {
      liftListItem(state.schema.nodes.list_item)(state, dispatch)
    } else {
      wrapInList(state.schema.nodes.ordered_list)(state, dispatch)
    }
    v.focus()
  }, [execMarkdownFormat, isBlockActive, view])

  const handleBlockquote = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('blockquote')
      return
    }
    if (isBlockActive('blockquote')) {
      execCommand(liftCommand())
    } else {
      execCommand(wrapInCommand(v.state.schema.nodes.blockquote))
    }
  }, [isBlockActive, execCommand, execMarkdownFormat, view])

  const handleCodeBlock = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('code-block')
      return
    }
    if (isBlockActive('code_block')) {
      execCommand(setBlockTypeCommand(v.state.schema.nodes.paragraph))
    } else {
      execCommand(setBlockTypeCommand(v.state.schema.nodes.code_block))
    }
  }, [isBlockActive, execCommand, execMarkdownFormat, view])

  const handleInsertLink = useCallback(() => {
    const v = view
    if (!v) {
      execMarkdownFormat('link')
      return
    }
    const { state, dispatch } = v
    const { selection } = state
    const mark = state.schema.marks.link

    const existingLink = state.doc.rangeHasMark(selection.from, selection.to, mark)
    if (existingLink) {
      const tr = state.tr.removeMark(selection.from, selection.to, mark)
      dispatch(tr)
    } else {
      const url = window.prompt('请输入链接地址:', 'https://')
      if (!url) return
      const text = selection.empty ? window.prompt('请输入链接文本:', '') : null
      if (selection.empty && !text) return

      if (selection.empty && text) {
        const linkMark = mark.create({ href: url })
        const tr = state.tr.insertText(text, selection.from, selection.to)
        tr.addMark(selection.from, selection.from + text.length, linkMark)
        dispatch(tr)
      } else {
        const tr = state.tr.addMark(selection.from, selection.to, mark.create({ href: url }))
        dispatch(tr)
      }
    }
    v.focus()
  }, [execMarkdownFormat, view])

  const handleHorizontalRule = useCallback(() => {
    const v = view

    if (!v) {
      execMarkdownFormat('horizontal-rule')
      return
    }

    execCommand(insertHorizontalRuleCommand())
  }, [execCommand, execMarkdownFormat, view])

  const handleTaskList = useCallback(() => {
    const v = view

    if (!v) {
      execMarkdownFormat('task-list')
      return
    }

    execCommand(insertTaskListCommand())
  }, [execCommand, execMarkdownFormat, view])

  const headingMenu = useMemo(
    () => [
      { nodeType: 'paragraph', label: '正文', level: 0 },
      { nodeType: 'heading', label: '标题 1', level: 1 },
      { nodeType: 'heading', label: '标题 2', level: 2 },
      { nodeType: 'heading', label: '标题 3', level: 3 },
      { nodeType: 'heading', label: '标题 4', level: 4 }
    ],
    []
  )

  const currentHeadingLabel = useMemo(() => {
    if (currentBlockType === 'heading' && blockLevel > 0) return `H${blockLevel}`
    return '正文'
  }, [currentBlockType, blockLevel])

  const canFormat = Boolean(view || onMarkdownFormat)

  if (!canFormat) return null

  return (
    <div className="format-toolbar" onMouseDown={preventFocusLoss}>
      <div className="format-toolbar-group">
        <Dropdown
          render={
            <Dropdown.Menu>
              {headingMenu.map((item) => (
                <Dropdown.Item
                  key={`${item.nodeType}-${item.level}`}
                  active={isBlockActive(item.nodeType, item.level || undefined)}
                  onClick={() => {
                    if (item.level === 0) {
                      if (view) {
                        execCommand(setBlockTypeCommand(view.state.schema.nodes.paragraph))
                      } else {
                        execMarkdownFormat('paragraph')
                      }
                    } else {
                      handleHeading(item.level)
                    }
                  }}
                >
                  <span
                    className={`format-heading-option ${item.level > 0 ? `h${item.level}` : ''}`}
                  >
                    {item.label}
                  </span>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          }
        >
          <Button
            size="small"
            theme="borderless"
            className="format-toolbar-btn format-heading-select"
          >
            {currentHeadingLabel}
            <span className="format-toolbar-chevron">▾</span>
          </Button>
        </Dropdown>
      </div>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group">
        <Tooltip content="加粗 (Ctrl+B)" position="bottom">
          <Button
            size="small"
            theme={isMarkActive('strong') ? 'light' : 'borderless'}
            type={isMarkActive('strong') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleBold}
          >
            <strong>B</strong>
          </Button>
        </Tooltip>
        <Tooltip content="斜体 (Ctrl+I)" position="bottom">
          <Button
            size="small"
            theme={isMarkActive('em') ? 'light' : 'borderless'}
            type={isMarkActive('em') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleItalic}
          >
            <em>I</em>
          </Button>
        </Tooltip>
        <Tooltip content="删除线" position="bottom">
          <Button
            size="small"
            theme={isMarkActive('strikethrough') || isMarkActive('s') ? 'light' : 'borderless'}
            type={isMarkActive('strikethrough') || isMarkActive('s') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleStrikethrough}
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </Button>
        </Tooltip>
        <Tooltip content="行内代码" position="bottom">
          <Button
            size="small"
            theme={isMarkActive('code') ? 'light' : 'borderless'}
            type={isMarkActive('code') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn format-toolbar-code"
            onMouseDown={preventFocusLoss}
            onClick={handleInlineCode}
          >
            {'</>'}
          </Button>
        </Tooltip>
      </div>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group">
        <Tooltip content="无序列表" position="bottom">
          <Button
            size="small"
            theme={isBlockActive('bullet_list') ? 'light' : 'borderless'}
            type={isBlockActive('bullet_list') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleBulletList}
          >
            •≡
          </Button>
        </Tooltip>
        <Tooltip content="有序列表" position="bottom">
          <Button
            size="small"
            theme={isBlockActive('ordered_list') ? 'light' : 'borderless'}
            type={isBlockActive('ordered_list') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleOrderedList}
          >
            1.
          </Button>
        </Tooltip>
        <Tooltip content="引用块" position="bottom">
          <Button
            size="small"
            theme={isBlockActive('blockquote') ? 'light' : 'borderless'}
            type={isBlockActive('blockquote') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleBlockquote}
          >
            ❝
          </Button>
        </Tooltip>
        <Tooltip content="代码块" position="bottom">
          <Button
            size="small"
            theme={isBlockActive('code_block') ? 'light' : 'borderless'}
            type={isBlockActive('code_block') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleCodeBlock}
          >
            {'{ }'}
          </Button>
        </Tooltip>
      </div>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group">
        <Tooltip content="插入/移除链接" position="bottom">
          <Button
            size="small"
            theme={isMarkActive('link') ? 'light' : 'borderless'}
            type={isMarkActive('link') ? 'primary' : 'tertiary'}
            className="format-toolbar-btn"
            onMouseDown={preventFocusLoss}
            onClick={handleInsertLink}
          >
            🔗
          </Button>
        </Tooltip>
      </div>

      <div className="format-toolbar-divider" />

      <div className="format-toolbar-group">
        <Dropdown
          render={
            <Dropdown.Menu>
              <Dropdown.Item onClick={handleTaskList}>任务列表</Dropdown.Item>
              <Dropdown.Item onClick={handleHorizontalRule}>分隔线</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => handleHeading(5)}>标题 5</Dropdown.Item>
              <Dropdown.Item onClick={() => handleHeading(6)}>标题 6</Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button
            size="small"
            theme="borderless"
            className="format-toolbar-btn"
            aria-label="更多格式"
          >
            <IconMoreStroked />
          </Button>
        </Dropdown>
      </div>

      {onFontSizeChange && typeof fontSize === 'number' ? (
        <>
          <div className="format-toolbar-divider" />

          <div className="format-toolbar-group">
            <Dropdown
              render={
                <Dropdown.Menu>
                  {FONT_SIZES.map((size) => (
                    <Dropdown.Item
                      key={size}
                      active={fontSize === size}
                      onClick={() => onFontSizeChange(size)}
                    >
                      {size}px
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              }
            >
              <Button
                size="small"
                theme="borderless"
                className="format-toolbar-btn format-font-size-select"
              >
                {fontSize}px
                <span className="format-toolbar-chevron">▾</span>
              </Button>
            </Dropdown>
          </div>
        </>
      ) : null}
    </div>
  )
}
