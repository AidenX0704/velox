import { Button, Tooltip, Typography } from '@douyinfe/semi-ui'
import {
  IconCode,
  IconColumnsStroked,
  IconClose,
  IconEyeOpened,
  IconFolderOpen,
  IconMaximize,
  IconMinimize,
  IconSave,
  IconSidebar
} from '@douyinfe/semi-icons'
import type { EditorMode } from '../modules/editor/model/types'
import { editorModeLabels } from '../modules/editor/model/types'

interface TitleBarProps {
  title: string
  dirty: boolean
  mode: EditorMode
  platform: string
  showSidebar: boolean
  onModeChange: (mode: EditorMode) => void
  onToggleSidebar: () => void
  onOpen: () => void
  onSave: () => void
}

const modeOptions: Array<{
  mode: EditorMode
  icon: React.ReactNode
}> = [
  { mode: 'source', icon: <IconCode /> },
  { mode: 'split', icon: <IconColumnsStroked /> },
  { mode: 'preview-edit', icon: <IconEyeOpened /> }
]

export function TitleBar({
  title,
  dirty,
  mode,
  platform,
  showSidebar,
  onModeChange,
  onToggleSidebar,
  onOpen,
  onSave
}: TitleBarProps): React.JSX.Element {
  return (
    <header className="titlebar" data-platform={platform}>
      <div className="titlebar-left">
        <Tooltip content={showSidebar ? '隐藏左侧面板' : '显示左侧面板'} position="bottom">
          <Button
            icon={<IconSidebar />}
            size="small"
            theme={showSidebar ? 'solid' : 'borderless'}
            type={showSidebar ? 'primary' : 'tertiary'}
            onClick={onToggleSidebar}
          />
        </Tooltip>
        <div className="titlebar-icon-group" aria-label="文件操作">
          <Tooltip content="打开 Markdown 文件" position="bottom">
            <Button icon={<IconFolderOpen />} size="small" theme="borderless" onClick={onOpen} />
          </Tooltip>
          <Tooltip content="保存当前文档" position="bottom">
            <Button icon={<IconSave />} size="small" theme="borderless" onClick={onSave} />
          </Tooltip>
        </div>
      </div>
      <Typography.Text className="titlebar-name" ellipsis={{ showTooltip: true }}>
        {title}
        {dirty ? ' ●' : ''}
      </Typography.Text>
      <div className="titlebar-actions">
        <div className="mode-segment" role="tablist" aria-label="编辑模式切换">
          {modeOptions.map((option) => (
            <button
              key={option.mode}
              className="mode-segment-item"
              data-active={mode === option.mode}
              type="button"
              role="tab"
              aria-selected={mode === option.mode}
              onClick={() => onModeChange(option.mode)}
            >
              {option.icon}
              <span>{editorModeLabels[option.mode]}</span>
            </button>
          ))}
        </div>
        <div className="window-controls" aria-label="窗口控制">
          <button
            type="button"
            aria-label="最小化"
            onClick={() => void window.api.window.minimize()}
          >
            <IconMinimize />
          </button>
          <button
            type="button"
            aria-label="最大化或还原"
            onClick={() => void window.api.window.toggleMaximize()}
          >
            <IconMaximize />
          </button>
          <button
            className="window-control-close"
            type="button"
            aria-label="关闭"
            onClick={() => void window.api.window.close()}
          >
            <IconClose />
          </button>
        </div>
      </div>
    </header>
  )
}
