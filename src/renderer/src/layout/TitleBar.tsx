import { useEffect, useState } from 'react'
import { Button, Dropdown, Tooltip, Typography } from '@douyinfe/semi-ui'
import {
  IconCodeStroked,
  IconColumnsStroked,
  IconEyeOpenedStroked,
  IconExport,
  IconFile,
  IconImage,
  IconImageStroked,
  IconPdf,
  IconSaveStroked,
  IconSidebar
} from '@douyinfe/semi-icons'
import type { ExportFormat } from '../../../shared/export'
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
  onExport: (format: ExportFormat) => void
}

const modeOptions: Array<SegmentOption<EditorMode>> = [
  { value: 'source', label: editorModeLabels.source, icon: <IconCodeStroked /> },
  { value: 'split', label: editorModeLabels.split, icon: <IconColumnsStroked /> },
  {
    value: 'preview-edit',
    label: editorModeLabels['preview-edit'],
    icon: <IconEyeOpenedStroked />
  }
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
  onSave,
  onExport
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
        <div className="titlebar-icon-group" aria-label="文件操作">
          <Tooltip content="打开 Markdown 文件" position="bottom">
            <Button
              icon={<IconFile />}
              size="small"
              theme="borderless"
              aria-label="打开 Markdown 文件"
              onClick={onOpen}
            />
          </Tooltip>
          <Tooltip content="保存当前文档" position="bottom">
            <Button
              icon={<IconSaveStroked />}
              size="small"
              theme="borderless"
              aria-label="保存当前文档"
              onClick={onSave}
            />
          </Tooltip>
          <Dropdown
            position="bottomLeft"
            render={
              <Dropdown.Menu>
                <Dropdown.Item icon={<IconPdf />} onClick={() => onExport('pdf')}>
                  导出 PDF
                </Dropdown.Item>
                <Dropdown.Item icon={<IconImageStroked />} onClick={() => onExport('png')}>
                  导出 PNG
                </Dropdown.Item>
                <Dropdown.Item icon={<IconImage />} onClick={() => onExport('jpeg')}>
                  导出 JPEG
                </Dropdown.Item>
                <Dropdown.Item icon={<IconFile />} onClick={() => onExport('docx')}>
                  导出 Word
                </Dropdown.Item>
                <Dropdown.Item icon={<IconFile />} onClick={() => onExport('html')}>
                  导出 HTML
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <Button icon={<IconExport />} size="small" theme="borderless" aria-label="导出文档" />
          </Dropdown>
        </div>
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
