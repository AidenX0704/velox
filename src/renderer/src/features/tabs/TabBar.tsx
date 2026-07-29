import { useCallback, useRef, useState } from 'react'
import { Dropdown, Tooltip } from '@douyinfe/semi-ui'
import { IconClose, IconPlus, IconLockStroked } from '@douyinfe/semi-icons'
import type { TabBarProps, TabState } from './types'

export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
  onCloseSaved,
  onPin,
  onUnpin,
  onReorder,
  onNewTab
}: TabBarProps): React.JSX.Element {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropIndex(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault()
      const fromIndex = dragIndex
      if (fromIndex !== null && fromIndex !== toIndex) {
        onReorder(fromIndex, toIndex)
      }
      setDragIndex(null)
      setDropIndex(null)
    },
    [dragIndex, onReorder]
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDropIndex(null)
  }, [])

  const handleTabMouseDown = useCallback(
    (tabId: string) => {
      onSelect(tabId)
    },
    [onSelect]
  )

  const handleCloseClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation()
      onClose(tabId)
    },
    [onClose]
  )

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault()
        onClose(tabId)
      }
    },
    [onClose]
  )

  const getTabContextMenu = useCallback(
    (tab: TabState) => (
      <Dropdown.Menu>
        <Dropdown.Item onClick={() => onClose(tab.id)}>关闭</Dropdown.Item>
        <Dropdown.Item onClick={() => onCloseOthers(tab.id)}>关闭其他</Dropdown.Item>
        <Dropdown.Item onClick={onCloseAll}>关闭所有</Dropdown.Item>
        <Dropdown.Item onClick={onCloseSaved}>关闭已保存</Dropdown.Item>
        <Dropdown.Divider />
        {tab.pinned ? (
          <Dropdown.Item onClick={() => onUnpin(tab.id)}>取消固定</Dropdown.Item>
        ) : (
          <Dropdown.Item onClick={() => onPin(tab.id)}>固定标签</Dropdown.Item>
        )}
      </Dropdown.Menu>
    ),
    [onClose, onCloseOthers, onCloseAll, onCloseSaved, onPin, onUnpin]
  )

  return (
    <div className="tabbar" ref={tabBarRef} role="tablist" aria-label="打开的资源">
      <div className="tabbar-tabs">
        {tabs.map((tab, index) => (
          <Dropdown
            key={tab.id}
            render={getTabContextMenu(tab)}
            trigger="contextMenu"
            position="bottomLeft"
          >
            <div
              className={`tabbar-tab${tab.id === activeTabId ? ' tabbar-tab--active' : ''}${tab.pinned ? ' tabbar-tab--pinned' : ''}${dragIndex === index ? ' tabbar-tab--dragging' : ''}${dropIndex === index ? ' tabbar-tab--drop-target' : ''}`}
              role="tab"
              aria-selected={tab.id === activeTabId}
              aria-label={`${tab.document.title}${tab.document.dirty ? ' (未保存)' : ''}`}
              tabIndex={tab.id === activeTabId ? 0 : -1}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onMouseDown={() => handleTabMouseDown(tab.id)}
              onMouseUp={(e) => handleMiddleClick(e, tab.id)}
            >
              {tab.pinned && (
                <span className="tabbar-tab-pin-icon" aria-label="已固定">
                  <IconLockStroked size="small" />
                </span>
              )}
              <span className="tabbar-tab-title" title={tab.document.title}>
                {tab.document.title}
              </span>
              {tab.document.dirty && <span className="tabbar-tab-dirty" aria-label="未保存" />}
              <Tooltip content="关闭" position="top">
                <button
                  className="tabbar-tab-close"
                  type="button"
                  aria-label={`关闭 ${tab.document.title}`}
                  onClick={(e) => handleCloseClick(e, tab.id)}
                >
                  <IconClose size="small" />
                </button>
              </Tooltip>
            </div>
          </Dropdown>
        ))}
      </div>
      <Tooltip content="新建标签页" position="bottom">
        <button className="tabbar-new-tab" type="button" aria-label="新建标签页" onClick={onNewTab}>
          <IconPlus size="small" />
        </button>
      </Tooltip>
    </div>
  )
}
