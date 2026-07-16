import { useEffect, useState } from 'react'
import { Dropdown, Tooltip } from '@douyinfe/semi-ui'
import {
  IconCodeStroked,
  IconEyeOpenedStroked,
  IconExport,
  IconFile,
  IconFolderOpenStroked,
  IconImage,
  IconImageStroked,
  IconMoreStroked,
  IconPdf,
  IconPlusStroked,
  IconSaveStroked,
  IconSearchStroked,
  IconSettingStroked
} from '@douyinfe/semi-icons'
import type { ExportFormat } from '../../../shared/export'
import { Segment, type SegmentOption } from '../components/Segment'
import type { EditorMode } from '../modules/editor/model/types'
import { editorModeLabels } from '../modules/editor/model/types'

interface TitleBarProps {
  mode: EditorMode
  platform: string
  onModeChange: (mode: EditorMode) => void
  onNew: () => void
  onOpen: () => void
  onOpenWorkspace: () => void
  onSave: () => void
  onSearch: () => void
  onOpenSettings: () => void
  onExport: (format: ExportFormat) => void
}

const modeOptions: Array<SegmentOption<EditorMode>> = [
  { value: 'source', label: editorModeLabels.source, icon: <IconCodeStroked /> },
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
  mode,
  platform,
  onModeChange,
  onNew,
  onOpen,
  onOpenWorkspace,
  onSave,
  onSearch,
  onOpenSettings,
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
        <div className="titlebar-icon-group" aria-label="文件操作">
          <Tooltip content="打开 Markdown 文件" position="bottom">
            <button
              className="titlebar-tool-button"
              type="button"
              aria-label="打开 Markdown 文件"
              onClick={onOpen}
            >
              <IconFile />
            </button>
          </Tooltip>
          <Tooltip content="保存当前文档" position="bottom">
            <button
              className="titlebar-tool-button"
              type="button"
              aria-label="保存当前文档"
              onClick={onSave}
            >
              <IconSaveStroked />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="titlebar-actions">
        <Segment
          className="mode-segment"
          value={mode}
          options={modeOptions}
          ariaLabel="编辑模式切换"
          size="small"
          onChange={onModeChange}
        />
        <Dropdown
          position="bottomRight"
          render={
            <Dropdown.Menu>
              <Dropdown.Item icon={<IconPlusStroked />} onClick={onNew}>
                新建文档
              </Dropdown.Item>
              <Dropdown.Item icon={<IconFile />} onClick={onOpen}>
                打开文件
              </Dropdown.Item>
              <Dropdown.Item icon={<IconFolderOpenStroked />} onClick={onOpenWorkspace}>
                打开文件夹
              </Dropdown.Item>
              <Dropdown.Item icon={<IconSaveStroked />} onClick={onSave}>
                保存文档
              </Dropdown.Item>
              <Dropdown.Item icon={<IconSearchStroked />} onClick={onSearch}>
                文档内搜索
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item icon={<IconPdf />} onClick={() => onExport('pdf')}>
                导出 PDF
              </Dropdown.Item>
              <Dropdown.Item icon={<IconImageStroked />} onClick={() => onExport('png')}>
                导出 PNG
              </Dropdown.Item>
              <Dropdown.Item icon={<IconImage />} onClick={() => onExport('jpeg')}>
                导出 JPEG
              </Dropdown.Item>
              <Dropdown.Item icon={<IconExport />} onClick={() => onExport('docx')}>
                导出 Word
              </Dropdown.Item>
              <Dropdown.Item icon={<IconExport />} onClick={() => onExport('html')}>
                导出 HTML
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item icon={<IconSettingStroked />} onClick={onOpenSettings}>
                偏好设置
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <button
            className="titlebar-tool-button titlebar-more-button"
            type="button"
            aria-label="更多操作"
          >
            <IconMoreStroked />
          </button>
        </Dropdown>
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
