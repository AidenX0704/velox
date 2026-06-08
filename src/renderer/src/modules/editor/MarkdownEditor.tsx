import { useMemo, useRef, useState } from 'react'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'
import 'markdown-it-texmath/css/texmath.css'
import 'prosemirror-view/style/prosemirror.css'
import './styles/editor.css'
import type { CursorPosition, EditorMode, MarkdownEditorPreferences } from './model/types'
import { FormatToolbar } from './rich/FormatToolbar'
import { RichMarkdownEditor } from './rich/RichMarkdownEditor'
import { DocumentOutline } from './outline/DocumentOutline'
import { collectHeadingAnchors, type HeadingAnchor } from './rendering/headingAnchors'
import {
  SourceMarkdownEditor,
  type SourceMarkdownEditorHandle
} from './source/SourceMarkdownEditor'

interface MarkdownEditorProps {
  mode: EditorMode
  dirty: boolean
  content: string
  settings: MarkdownEditorPreferences
  currentPath?: string
  workspaceRoot?: string | null
  anchorTarget?: string | null
  onChange: (content: string) => void
  onCursorChange: (position: CursorPosition) => void
  onOpenDocumentLink?: (path: string, anchor?: string) => boolean | void | Promise<boolean | void>
  onLinkError?: (message: string) => void
}

export function MarkdownEditor({
  mode,
  dirty,
  content,
  settings,
  currentPath,
  workspaceRoot,
  anchorTarget,
  onChange,
  onCursorChange,
  onOpenDocumentLink,
  onLinkError
}: MarkdownEditorProps): React.JSX.Element {
  const sourceEditorRef = useRef<SourceMarkdownEditorHandle | null>(null)
  const [sourceVisibleLine, setSourceVisibleLine] = useState(1)
  const headingAnchors = useMemo(() => collectHeadingAnchors(content), [content])
  const sourceActiveHeadingIndex = findHeadingIndexAtOrBeforeLine(headingAnchors, sourceVisibleLine)

  if (mode === 'source') {
    return (
      <div className="editor-mode-shell" data-editor-view="source">
        <FormatToolbar
          onMarkdownFormat={(action) => sourceEditorRef.current?.applyFormat(action)}
        />
        <div className="editor-with-outline">
          <DocumentOutline
            headings={headingAnchors}
            dirty={dirty}
            activeHeadingIndex={sourceActiveHeadingIndex}
            onHeadingSelect={(heading) => sourceEditorRef.current?.scrollToLine(heading.line)}
          />
          <SourceMarkdownEditor
            ref={sourceEditorRef}
            value={content}
            wordWrap={settings.wordWrap}
            showLineNumbers={settings.showLineNumbers}
            fontSize={settings.editorFontSize}
            lineHeight={settings.editorLineHeight}
            onChange={onChange}
            onCursorChange={onCursorChange}
            onScrollRatioChange={() => {
              setSourceVisibleLine(sourceEditorRef.current?.getVisibleLine() ?? 1)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <RichMarkdownEditor
      dirty={dirty}
      content={content}
      settings={settings}
      currentPath={currentPath}
      workspaceRoot={workspaceRoot}
      anchorTarget={anchorTarget}
      onChange={onChange}
      onCursorChange={onCursorChange}
      onOpenDocumentLink={onOpenDocumentLink}
      onLinkError={onLinkError}
    />
  )
}

function findHeadingIndexAtOrBeforeLine(anchors: HeadingAnchor[], line: number): number {
  let currentIndex = -1

  for (let index = 0; index < anchors.length; index += 1) {
    if (anchors[index].line > line) {
      break
    }

    currentIndex = index
  }

  return currentIndex
}
