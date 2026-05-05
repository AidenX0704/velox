import { useEffect, useState } from 'react'
import { Tooltip, Typography } from '@douyinfe/semi-ui'
import {
  IconCode,
  IconColumnsStroked,
  IconEyeOpened,
  IconFolderOpen,
  IconSave,
  IconSidebar
} from '@douyinfe/semi-icons'
import { Segment, type SegmentOption } from '../components/Segment'
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

const modeOptions: Array<SegmentOption<EditorMode>> = [
  { value: 'source', label: editorModeLabels.source, icon: <IconCode /> },
  { value: 'split', label: editorModeLabels.split, icon: <IconColumnsStroked /> },
  { value: 'preview-edit', label: editorModeLabels['preview-edit'], icon: <IconEyeOpened /> }
]

function WindowsCaptionIcon({
  type
}: {
  type: 'minimize' | 'maximize' | 'restore' | 'close'
}): React.JSX.Element {
  return <span className="windows-caption-icon" data-icon={type} aria-hidden="true" />
}

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
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (platform !== 'win32') {
      return
    }

    let disposed = false

    window.api.window.getIsMaximized().then((result) => {
      if (!disposed && result.ok) {
        setIsMaximized(result.data)
      }
    })

    const unsubscribe = window.api.window.onMaximizedChange(setIsMaximized)

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [platform])

  const handleToggleMaximize = async (): Promise<void> => {
    const result = await window.api.window.toggleMaximize()

    if (result.ok) {
      const state = await window.api.window.getIsMaximized()

      if (state.ok) {
        setIsMaximized(state.data)
      }
    }
  }

  return (
    <header className="titlebar" data-platform={platform}>
      <div className="titlebar-left">
        <Tooltip content={showSidebar ? '隐藏左侧面板' : '显示左侧面板'} position="bottom">
          <button
            className="titlebar-tool-button"
            data-active={showSidebar}
            type="button"
            aria-label={showSidebar ? '隐藏左侧面板' : '显示左侧面板'}
            onClick={onToggleSidebar}
          >
            <IconSidebar />
          </button>
        </Tooltip>
        {!showSidebar ? (
          <div className="titlebar-icon-group" aria-label="文档操作">
            <Tooltip content="打开 Markdown 文件" position="bottom">
              <button
                className="titlebar-tool-button"
                type="button"
                aria-label="打开 Markdown 文件"
                onClick={onOpen}
              >
                <IconFolderOpen />
              </button>
            </Tooltip>
            <Tooltip content="保存当前文档" position="bottom">
              <button
                className="titlebar-tool-button"
                type="button"
                aria-label="保存当前文档"
                onClick={onSave}
              >
                <IconSave />
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>
      <Typography.Text className="titlebar-name" ellipsis={{ showTooltip: true }}>
        {title}
        {dirty ? ' ●' : ''}
      </Typography.Text>
      <div className="titlebar-actions">
        <Segment
          className="mode-segment"
          value={mode}
          options={modeOptions}
          ariaLabel="编辑模式切换"
          size="small"
          onChange={onModeChange}
        />
        <div className="window-controls" aria-label="窗口控制">
          <button
            type="button"
            aria-label="最小化"
            onClick={() => void window.api.window.minimize()}
          >
            <WindowsCaptionIcon type="minimize" />
          </button>
          <button
            type="button"
            aria-label={isMaximized ? '还原窗口' : '最大化'}
            onClick={() => void handleToggleMaximize()}
          >
            <WindowsCaptionIcon type={isMaximized ? 'restore' : 'maximize'} />
          </button>
          <button
            className="window-control-close"
            type="button"
            aria-label="关闭"
            onClick={() => void window.api.window.close()}
          >
            <WindowsCaptionIcon type="close" />
          </button>
        </div>
      </div>
    </header>
  )
}
