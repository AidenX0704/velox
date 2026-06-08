export interface ShortcutDefinition {
  id: string
  label: string
  description: string
  defaultKey: string
  category: 'global' | 'format' | 'block' | 'navigation'
}

export const shortcutCategories: Array<{
  id: ShortcutDefinition['category']
  label: string
}> = [
  { id: 'global', label: '全局' },
  { id: 'format', label: '文本格式' },
  { id: 'block', label: '块级操作' },
  { id: 'navigation', label: '导航切换' }
]

export const shortcutDefinitions: ShortcutDefinition[] = [
  {
    id: 'save',
    label: '保存文档',
    description: '保存当前编辑的文件',
    defaultKey: 'Mod+S',
    category: 'global'
  },
  {
    id: 'open',
    label: '打开文档',
    description: '打开一个 Markdown 文件',
    defaultKey: 'Mod+O',
    category: 'global'
  },
  {
    id: 'newDoc',
    label: '新建文档',
    description: '创建新的空白文档',
    defaultKey: 'Mod+N',
    category: 'global'
  },
  {
    id: 'toggleSidebar',
    label: '切换侧边栏',
    description: '显示或隐藏左侧导航面板',
    defaultKey: 'Mod+\\',
    category: 'global'
  },

  {
    id: 'bold',
    label: '加粗',
    description: '切换选中文本的加粗状态',
    defaultKey: 'Mod+B',
    category: 'format'
  },
  {
    id: 'italic',
    label: '斜体',
    description: '切换选中文本的斜体状态',
    defaultKey: 'Mod+I',
    category: 'format'
  },
  {
    id: 'strikethrough',
    label: '删除线',
    description: '切换选中文本的删除线',
    defaultKey: 'Mod+D',
    category: 'format'
  },
  {
    id: 'inlineCode',
    label: '行内代码',
    description: '将选中文本标记为行内代码',
    defaultKey: 'Mod+`',
    category: 'format'
  },
  {
    id: 'link',
    label: '插入链接',
    description: '为选中文本添加超链接',
    defaultKey: 'Mod+K',
    category: 'format'
  },

  {
    id: 'heading1',
    label: '标题 1',
    description: '将当前行设为一级标题',
    defaultKey: 'Mod+Shift+1',
    category: 'block'
  },
  {
    id: 'heading2',
    label: '标题 2',
    description: '将当前行设为二级标题',
    defaultKey: 'Mod+Shift+2',
    category: 'block'
  },
  {
    id: 'heading3',
    label: '标题 3',
    description: '将当前行设为三级标题',
    defaultKey: 'Mod+Shift+3',
    category: 'block'
  },
  {
    id: 'heading4',
    label: '标题 4',
    description: '将当前行设为四级标题',
    defaultKey: 'Mod+Shift+4',
    category: 'block'
  },
  {
    id: 'heading5',
    label: '标题 5',
    description: '将当前行设为五级标题',
    defaultKey: 'Mod+Shift+5',
    category: 'block'
  },
  {
    id: 'bulletList',
    label: '无序列表',
    description: '插入无序列表项',
    defaultKey: 'Mod+Shift+8',
    category: 'block'
  },
  {
    id: 'orderedList',
    label: '有序列表',
    description: '插入有序列表项',
    defaultKey: 'Mod+Shift+7',
    category: 'block'
  },
  {
    id: 'blockquote',
    label: '引用块',
    description: '将当前行设为引用',
    defaultKey: 'Mod+Shift+9',
    category: 'block'
  },

  {
    id: 'modeSource',
    label: '源码模式',
    description: '切换到源码编辑视图',
    defaultKey: 'Mod+Shift+1',
    category: 'navigation'
  },
  {
    id: 'modePreview',
    label: '预览编辑模式',
    description: '切换到所见即所得视图',
    defaultKey: 'Mod+Shift+2',
    category: 'navigation'
  }
]

export function getShortcutKey(def: ShortcutDefinition, overrides: Record<string, string>): string {
  return overrides[def.id] ?? def.defaultKey
}

export function formatKeyForDisplay(key: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return key
    .replace(/Mod/g, isMac ? '⌘' : 'Ctrl')
    .replace(/Shift/g, isMac ? '⇧' : 'Shift')
    .replace(/Alt/g, isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+')
}

export function formatKeyForDisplaySpans(key: string): string[] {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const parts = key.split('+')
  return parts.map((part) => {
    if (part === 'Mod') return isMac ? '⌘' : 'Ctrl'
    if (part === 'Shift') return isMac ? '⇧' : 'Shift'
    if (part === 'Alt') return isMac ? '⌥' : 'Alt'
    if (part === '`') return '`'
    if (part === '\\') return '\\'
    return part
  })
}

export function detectKeyFromEvent(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('Mod')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  let key = e.key
  if (key === 'Meta' || key === 'Control' || key === 'Shift' || key === 'Alt') return null
  if (key === ' ') key = 'Space'
  if (key === 'Escape') return 'Escape'
  if (key === 'Backspace') return 'Backspace'
  if (key === 'Delete') return 'Delete'
  if (key === 'ArrowUp') key = 'Up'
  if (key === 'ArrowDown') key = 'Down'
  if (key === 'ArrowLeft') key = 'Left'
  if (key === 'ArrowRight') key = 'Right'
  if (key === 'Enter') key = 'Enter'
  if (key === 'Tab') key = 'Tab'

  if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join('+')
}
