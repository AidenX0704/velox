import { Typography } from '@douyinfe/semi-ui'
import type { CursorPosition } from '../modules/editor/model/types'
import type { EditorMode } from '../modules/editor/model/types'
import { editorModeLabels } from '../modules/editor/model/types'

interface StatusBarProps {
  mode: EditorMode
  wordCount: number
  dirty: boolean
  cursorPosition: CursorPosition
  showLineNumbers: boolean
}

export function StatusBar({
  mode,
  wordCount,
  dirty,
  cursorPosition,
  showLineNumbers
}: StatusBarProps): React.JSX.Element {
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <Typography.Text type="tertiary">{editorModeLabels[mode]}</Typography.Text>
        <Typography.Text type="tertiary">行号{showLineNumbers ? '开启' : '关闭'}</Typography.Text>
      </div>
      <div className="statusbar-right">
        <Typography.Text type="tertiary">
          行 {cursorPosition.line}, 列 {cursorPosition.column}
        </Typography.Text>
        <Typography.Text type="tertiary">{wordCount} words</Typography.Text>
        <Typography.Text type={dirty ? 'warning' : 'tertiary'}>
          {dirty ? '未保存' : '已同步'}
        </Typography.Text>
      </div>
    </footer>
  )
}
