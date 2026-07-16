import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, InputNumber, Select, TextArea, Typography } from '@douyinfe/semi-ui'
import {
  IconArticle,
  IconClose,
  IconCodeStroked,
  IconColorPalette,
  IconCommand,
  IconCloudStroked,
  IconDesktop,
  IconEditStroked,
  IconFolderStroked,
  IconInfoCircle,
  IconMoonStroked,
  IconPuzzle,
  IconRefresh,
  IconSearch,
  IconSettingStroked,
  IconSunStroked
} from '@douyinfe/semi-icons'
import type { AppInfo } from '../../../shared/types'
import type { UpdaterStatus } from '../../../shared/types'
import {
  themeColorPresets,
  type AppearanceMode,
  type ThemeColorSelection
} from '../../../shared/preferences'
import type { ExportFormat, ExportImageFormat, ExportPdfPageSize } from '../../../shared/export'
import { BrandLogo } from '../components/BrandLogo'
import type { EditorMode, MarkdownEditorPreferences } from '../modules/editor/model/types'
import { editorModeLabels } from '../modules/editor/model/types'
import {
  shortcutDefinitions,
  shortcutCategories,
  getShortcutKey,
  formatKeyForDisplaySpans,
  detectKeyFromEvent
} from '../features/shortcuts/shortcutDefinitions'

interface SettingsPageProps {
  settings: MarkdownEditorPreferences
  updaterStatus: UpdaterStatus | null
  onBack: () => void
  onChange: (settings: MarkdownEditorPreferences) => void
  onReset: () => void
  onCheckForUpdates: () => void
}

type SettingsPatch = Partial<MarkdownEditorPreferences>
type PreferenceSection =
  | 'general'
  | 'editor'
  | 'markdown'
  | 'appearance'
  | 'files'
  | 'sync'
  | 'shortcuts'
  | 'plugins'
  | 'advanced'
  | 'about'

const appearanceModeOptions: Array<{
  value: AppearanceMode
  label: string
  icon: React.ReactNode
}> = [
  { value: 'system', label: '跟随系统', icon: <IconDesktop /> },
  { value: 'light', label: '亮色', icon: <IconSunStroked /> },
  { value: 'dark', label: '黑色', icon: <IconMoonStroked /> }
]

const preferenceSections: Array<{
  id: PreferenceSection
  label: string
  icon: React.ReactNode
}> = [
  { id: 'general', label: '常规', icon: <IconSettingStroked /> },
  { id: 'editor', label: '编辑器', icon: <IconEditStroked /> },
  { id: 'markdown', label: 'Markdown', icon: <IconArticle /> },
  { id: 'appearance', label: '外观', icon: <IconColorPalette /> },
  { id: 'files', label: '文件管理', icon: <IconFolderStroked /> },
  { id: 'sync', label: '同步与备份', icon: <IconCloudStroked /> },
  { id: 'shortcuts', label: '快捷键', icon: <IconCommand /> },
  { id: 'plugins', label: '插件扩展', icon: <IconPuzzle /> },
  { id: 'advanced', label: '高级设置', icon: <IconCodeStroked /> },
  { id: 'about', label: '关于', icon: <IconInfoCircle /> }
]

export function SettingsPage({
  settings,
  updaterStatus,
  onBack,
  onChange,
  onReset,
  onCheckForUpdates
}: SettingsPageProps): React.JSX.Element {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let cancelled = false

    window.api.app.getInfo().then((result) => {
      if (!cancelled && result.ok) {
        setAppInfo(result.data)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const updateSettings = (patch: SettingsPatch): void => {
    onChange({ ...settings, ...patch })
  }

  const scrollToSection = (section: PreferenceSection): void => {
    document.getElementById(`settings-${section}`)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth'
    })
  }

  const activeThemeColor =
    settings.themeColorPreset === 'custom'
      ? settings.customThemeColor
      : (themeColorPresets.find((preset) => preset.id === settings.themeColorPreset)?.color ??
        settings.customThemeColor)

  return (
    <section className="settings-page">
      <header className="settings-page-header">
        <div className="settings-page-title">设置</div>
        <Input
          className="settings-search"
          disabled
          prefix={<IconSearch />}
          suffix={<span className="settings-search-shortcut">⌘F</span>}
          placeholder="搜索设置项..."
        />
        <Button
          aria-label="关闭设置"
          className="settings-close-button"
          icon={<IconClose />}
          theme="borderless"
          type="tertiary"
          onClick={onBack}
        />
      </header>

      <div className="settings-page-content">
        <aside className="settings-page-nav" aria-label="偏好设置分类">
          <div className="settings-nav-list">
            {preferenceSections.map((section) => (
              <button
                key={section.id}
                className="settings-nav-item"
                data-active={section.id === 'general'}
                type="button"
                onClick={() => scrollToSection(section.id)}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="settings-page-main">
          <SettingsGroup id="settings-general" title="启动">
            <div className="settings-box settings-box-split">
              <div className="settings-checkbox-list">
                <CheckSetting title="启动时恢复上次会话" checked disabled />
                <CheckSetting
                  title="自动换行"
                  checked={settings.wordWrap}
                  onChange={(wordWrap) => updateSettings({ wordWrap })}
                />
                <CheckSetting
                  title="源码区显示行号"
                  checked={settings.showLineNumbers}
                  onChange={(showLineNumbers) => updateSettings({ showLineNumbers })}
                />
              </div>
              <div className="settings-field-stack">
                <Typography.Text strong>默认编辑模式</Typography.Text>
                <Typography.Text type="tertiary">新会话打开时使用的编辑视图</Typography.Text>
                <Select
                  value={settings.defaultMode}
                  style={{ width: '100%' }}
                  onChange={(value) => updateSettings({ defaultMode: value as EditorMode })}
                >
                  {(Object.keys(editorModeLabels) as EditorMode[]).map((mode) => (
                    <Select.Option key={mode} value={mode}>
                      {editorModeLabels[mode]}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-editor" title="编辑器">
            <div className="settings-box settings-box-grid">
              <SettingField title="编辑字号" description="源码编辑器字体大小">
                <InputNumber
                  min={12}
                  max={24}
                  value={settings.editorFontSize}
                  suffix="px"
                  onChange={(value) => updateSettings({ editorFontSize: Number(value) })}
                />
              </SettingField>
              <SettingField title="编辑行高" description="源码编辑器行间距">
                <InputNumber
                  min={1.3}
                  max={2.2}
                  step={0.05}
                  value={settings.editorLineHeight}
                  onChange={(value) => updateSettings({ editorLineHeight: Number(value) })}
                />
              </SettingField>
              <SettingField title="预览字号" description="预览编辑字号">
                <InputNumber
                  min={13}
                  max={24}
                  value={settings.previewFontSize}
                  suffix="px"
                  onChange={(value) => updateSettings({ previewFontSize: Number(value) })}
                />
              </SettingField>
              <SettingField title="预览行高" description="预览编辑行高">
                <InputNumber
                  min={1.4}
                  max={2.4}
                  step={0.05}
                  value={settings.previewLineHeight}
                  onChange={(value) => updateSettings({ previewLineHeight: Number(value) })}
                />
              </SettingField>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-markdown" title="Markdown">
            <div className="settings-box settings-box-grid">
              <SettingField title="预览最大宽度" description="控制预览编辑内容宽度">
                <InputNumber
                  min={680}
                  max={1800}
                  step={20}
                  value={settings.previewMaxWidth}
                  suffix="px"
                  onChange={(value) => updateSettings({ previewMaxWidth: Number(value) })}
                />
              </SettingField>
              <SettingField title="预览页宽" description="控制类 Typora 预览编辑版心">
                <Select
                  style={{ width: '100%' }}
                  value={settings.previewEditWidthMode}
                  onChange={(value) =>
                    updateSettings({
                      previewEditWidthMode: value as typeof settings.previewEditWidthMode
                    })
                  }
                >
                  <Select.Option value="wide">宽幅</Select.Option>
                  <Select.Option value="standard">标准</Select.Option>
                  <Select.Option value="narrow">窄幅</Select.Option>
                </Select>
              </SettingField>
              <div className="settings-checkbox-list settings-grid-span-2">
                <CheckSetting
                  title="预览内容居中"
                  checked={settings.previewCentered}
                  onChange={(previewCentered) => updateSettings({ previewCentered })}
                />
                <CheckSetting
                  title="导出时包含自定义 CSS"
                  checked={settings.export.includeCustomCss}
                  onChange={(includeCustomCss) =>
                    updateSettings({
                      export: {
                        ...settings.export,
                        includeCustomCss
                      }
                    })
                  }
                />
              </div>
              <SettingField
                className="settings-grid-span-2"
                title="自定义 CSS"
                description="注入到预览渲染区域的附加样式"
              >
                <TextArea
                  autosize={false}
                  rows={5}
                  placeholder="/* 在这里添加自定义预览样式 */"
                  value={settings.customPreviewCss}
                  onChange={(value) => updateSettings({ customPreviewCss: value })}
                />
              </SettingField>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-appearance" title="外观">
            <div className="settings-box settings-box-grid">
              <SettingField title="主题模式" description="选择黑色、亮色，或跟随系统设置自动切换">
                <Select
                  value={settings.appearanceMode}
                  style={{ width: '100%' }}
                  onChange={(value) => updateSettings({ appearanceMode: value as AppearanceMode })}
                >
                  {appearanceModeOptions.map((option) => (
                    <Select.Option key={option.value} value={option.value}>
                      <span className="settings-select-option">
                        {option.icon}
                        <span>{option.label}</span>
                      </span>
                    </Select.Option>
                  ))}
                </Select>
              </SettingField>
              <div className="settings-theme-field">
                <Typography.Text strong>主题色</Typography.Text>
                <div className="theme-color-grid" role="radiogroup" aria-label="主题色">
                  {themeColorPresets.map((preset) => (
                    <button
                      key={preset.id}
                      className="theme-color-swatch"
                      type="button"
                      role="radio"
                      aria-checked={settings.themeColorPreset === preset.id}
                      title={preset.label}
                      style={{ '--swatch-color': preset.color } as React.CSSProperties}
                      data-active={settings.themeColorPreset === preset.id}
                      onClick={() =>
                        updateSettings({ themeColorPreset: preset.id as ThemeColorSelection })
                      }
                    />
                  ))}
                  <button
                    className="theme-color-swatch theme-color-swatch-custom"
                    type="button"
                    role="radio"
                    aria-checked={settings.themeColorPreset === 'custom'}
                    style={{ '--swatch-color': settings.customThemeColor } as React.CSSProperties}
                    data-active={settings.themeColorPreset === 'custom'}
                    title="自定义"
                    onClick={() => updateSettings({ themeColorPreset: 'custom' })}
                  />
                </div>
                {settings.themeColorPreset === 'custom' ? (
                  <label className="custom-theme-color-control">
                    <input
                      type="color"
                      value={settings.customThemeColor}
                      onChange={(event) => updateSettings({ customThemeColor: event.target.value })}
                    />
                    <span>{settings.customThemeColor.toUpperCase()}</span>
                  </label>
                ) : null}
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-files" title="文件与链接">
            <div className="settings-box settings-box-grid">
              <SettingField title="默认导出格式" description="用于后续快捷导出和菜单默认行为">
                <Select
                  value={settings.export.defaultFormat}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    updateSettings({
                      export: {
                        ...settings.export,
                        defaultFormat: value as ExportFormat
                      }
                    })
                  }
                >
                  <Select.Option value="pdf">PDF</Select.Option>
                  <Select.Option value="png">PNG 图片</Select.Option>
                  <Select.Option value="jpeg">JPEG 图片</Select.Option>
                  <Select.Option value="docx">Word</Select.Option>
                  <Select.Option value="html">HTML</Select.Option>
                </Select>
              </SettingField>
              <SettingField title="PDF 页面尺寸" description="控制 PDF 导出的分页纸张尺寸">
                <Select
                  value={settings.export.pdfPageSize}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    updateSettings({
                      export: {
                        ...settings.export,
                        pdfPageSize: value as ExportPdfPageSize
                      }
                    })
                  }
                >
                  <Select.Option value="A4">A4</Select.Option>
                  <Select.Option value="Letter">Letter</Select.Option>
                </Select>
              </SettingField>
              <SettingField title="图片格式" description="从菜单导出图片时使用的默认格式">
                <Select
                  value={settings.export.imageFormat}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    updateSettings({
                      export: {
                        ...settings.export,
                        imageFormat: value as ExportImageFormat
                      }
                    })
                  }
                >
                  <Select.Option value="png">PNG</Select.Option>
                  <Select.Option value="jpeg">JPEG</Select.Option>
                </Select>
              </SettingField>
              <SettingField title="图片倍率" description="提高导出图片的像素密度">
                <InputNumber
                  min={1}
                  max={3}
                  step={0.25}
                  value={settings.export.imageScale}
                  suffix="x"
                  onChange={(value) =>
                    updateSettings({
                      export: {
                        ...settings.export,
                        imageScale: Number(value)
                      }
                    })
                  }
                />
              </SettingField>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-sync" title="同步与备份">
            <div className="settings-box settings-box-grid">
              <SettingField
                title="当前版本"
                description={appInfo?.isPackaged ? '正式安装版本' : '开发环境'}
              >
                <div className="settings-version-value">v{appInfo?.version ?? '-'}</div>
              </SettingField>
              <SettingField title="更新状态" description={updaterStatus?.message ?? '尚未检查更新'}>
                <span className="settings-update-state" data-state={updaterStatus?.state ?? 'idle'}>
                  {getUpdaterStateLabel(updaterStatus)}
                </span>
              </SettingField>
              <div className="settings-grid-span-2 settings-action-row">
                <Button
                  icon={<IconRefresh />}
                  loading={updaterStatus?.state === 'checking'}
                  disabled={updaterStatus?.state === 'downloading'}
                  onClick={onCheckForUpdates}
                >
                  检查更新
                </Button>
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-shortcuts" title="快捷键">
            <div className="settings-box">
              <ShortcutSettings
                overrides={settings.shortcutOverrides}
                onChange={(overrides) => updateSettings({ shortcutOverrides: overrides })}
              />
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-plugins" title="插件扩展">
            <div className="settings-box settings-placeholder-box">
              <Typography.Text strong>扩展能力</Typography.Text>
              <Typography.Text type="tertiary">当前版本暂未提供插件管理入口。</Typography.Text>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-advanced" title="高级设置">
            <div className="settings-box settings-action-row">
              <Button icon={<IconRefresh />} theme="light" onClick={onReset}>
                恢复默认设置
              </Button>
            </div>
          </SettingsGroup>

          <SettingsGroup id="settings-about" title="关于">
            <div className="settings-box settings-about-card">
              <BrandLogo className="settings-about-logo" />
              <div className="settings-about-content">
                <Typography.Title heading={6}>Velox Markdown Editor</Typography.Title>
                <Typography.Paragraph type="tertiary" spacing="extended">
                  面向桌面写作场景的 Markdown 编辑器，提供源码和实时预览编辑体验。
                </Typography.Paragraph>
                <div className="settings-about-meta">
                  <span>版本 {appInfo?.version ?? '-'}</span>
                  <span>{appInfo?.isPackaged ? '生产环境' : '开发环境'}</span>
                  <span>Electron · React · ProseMirror</span>
                </div>
              </div>
            </div>
          </SettingsGroup>

          <div className="settings-footer-actions">
            <Button icon={<IconRefresh />} theme="light" onClick={onReset}>
              恢复默认设置
            </Button>
            <Button theme="solid" type="primary" onClick={onBack}>
              保存设置
            </Button>
          </div>
        </main>

        <aside className="settings-preview-panel" aria-label="外观预览">
          <section className="settings-preview-section">
            <Typography.Title heading={6}>外观预览</Typography.Title>
            <Typography.Text strong>主题模式</Typography.Text>
            <div className="appearance-mode-grid">
              {appearanceModeOptions.map((option) => (
                <button
                  key={option.value}
                  className="appearance-mode-card"
                  data-active={settings.appearanceMode === option.value}
                  type="button"
                  onClick={() => updateSettings({ appearanceMode: option.value })}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-preview-section">
            <Typography.Text strong>主题色</Typography.Text>
            <div className="settings-preview-colors" role="radiogroup" aria-label="主题色预览">
              {themeColorPresets.map((preset) => (
                <button
                  key={preset.id}
                  className="settings-preview-color"
                  type="button"
                  role="radio"
                  aria-checked={settings.themeColorPreset === preset.id}
                  data-active={settings.themeColorPreset === preset.id}
                  title={preset.label}
                  style={{ '--swatch-color': preset.color } as React.CSSProperties}
                  onClick={() =>
                    updateSettings({ themeColorPreset: preset.id as ThemeColorSelection })
                  }
                />
              ))}
            </div>
          </section>

          <section className="settings-preview-section">
            <Typography.Text strong>界面密度</Typography.Text>
            <div className="density-card-grid">
              <DensityCard label="紧凑" active={settings.previewEditWidthMode === 'narrow'} />
              <DensityCard label="默认" active={settings.previewEditWidthMode === 'standard'} />
              <DensityCard label="舒适" active={settings.previewEditWidthMode === 'wide'} />
            </div>
          </section>

          <div className="settings-preview-checks">
            <CheckSetting
              title="预览内容居中"
              checked={settings.previewCentered}
              onChange={(previewCentered) => updateSettings({ previewCentered })}
            />
          </div>

          <section className="settings-preview-section">
            <Typography.Text strong>预览效果</Typography.Text>
            <div
              className="settings-preview-window"
              style={{ '--preview-accent': activeThemeColor } as React.CSSProperties}
              data-mode={settings.appearanceMode}
            >
              <div className="settings-preview-sidebar">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="settings-preview-doc">
                <div className="settings-preview-window-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <h3># 标题示例</h3>
                <p>这是一个预览示例，用于预览当前主题和排版效果。</p>
                <pre>{`function hello() {
  console.log('Hello Velox!')
}`}</pre>
                <table>
                  <tbody>
                    <tr>
                      <th>功能</th>
                      <th>状态</th>
                    </tr>
                    <tr>
                      <td>实时预览</td>
                      <td>●</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

function getUpdaterStateLabel(status: UpdaterStatus | null): string {
  if (!status) {
    return '未检查'
  }

  switch (status.state) {
    case 'idle':
      return '待检查'
    case 'checking':
      return '检查中'
    case 'available':
      return status.version ? `发现 v${status.version}` : '发现新版本'
    case 'not-available':
      return '已是最新'
    case 'downloading':
      return `下载中 ${Math.round(status.percent ?? 0)}%`
    case 'downloaded':
      return '等待安装'
    case 'error':
      return '检查失败'
  }
}

function SettingsGroup({
  id,
  title,
  children
}: {
  id: string
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section id={id} className="settings-group">
      <Typography.Title heading={6}>{title}</Typography.Title>
      {children}
    </section>
  )
}

function SettingField({
  className,
  title,
  description,
  children
}: {
  className?: string
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={`settings-field ${className ?? ''}`}>
      <div className="settings-field-label">
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="tertiary">{description}</Typography.Text>
      </div>
      {children}
    </div>
  )
}

function CheckSetting({
  title,
  checked,
  disabled = false,
  onChange
}: {
  title: string
  checked: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="settings-check" data-disabled={disabled}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span>{title}</span>
    </label>
  )
}

function DensityCard({ label, active }: { label: string; active: boolean }): React.JSX.Element {
  return (
    <div className="density-card" data-active={active}>
      <span />
      <span />
      <span />
      <strong>{label}</strong>
    </div>
  )
}

function ShortcutSettings({
  overrides,
  onChange
}: {
  overrides: Record<string, string>
  onChange: (overrides: Record<string, string>) => void
}): React.JSX.Element {
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const recordingRef = useRef<string | null>(null)

  const handleStartRecord = useCallback((id: string) => {
    recordingRef.current = id
    setRecordingId(id)
  }, [])

  const handleStopRecord = useCallback(() => {
    recordingRef.current = null
    setRecordingId(null)
  }, [])

  const handleReset = useCallback(
    (id: string) => {
      const next = { ...overrides }
      delete next[id]
      onChange(next)
    },
    [overrides, onChange]
  )

  const handleResetAll = useCallback(() => {
    onChange({})
  }, [onChange])

  useEffect(() => {
    if (!recordingId) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        handleStopRecord()
        return
      }

      const detected = detectKeyFromEvent(e)
      if (!detected) return

      const next = { ...overrides, [recordingId]: detected }
      onChange(next)
      handleStopRecord()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingId, overrides, onChange, handleStopRecord])

  const hasOverrides = Object.keys(overrides).length > 0

  return (
    <div className="shortcut-settings">
      {hasOverrides ? (
        <div className="shortcut-reset-bar">
          <Typography.Text type="tertiary">
            已自定义 {Object.keys(overrides).length} 个快捷键
          </Typography.Text>
          <Button size="small" theme="borderless" type="tertiary" onClick={handleResetAll}>
            全部恢复默认
          </Button>
        </div>
      ) : null}

      {shortcutCategories.map((cat) => {
        const defs = shortcutDefinitions.filter((d) => d.category === cat.id)
        if (defs.length === 0) return null

        return (
          <div key={cat.id} className="shortcut-category">
            <div className="shortcut-category-header">
              <Typography.Text strong>{cat.label}</Typography.Text>
            </div>
            {defs.map((def) => {
              const currentKey = getShortcutKey(def, overrides)
              const isCustom = overrides[def.id] !== undefined
              const isRecording = recordingId === def.id

              return (
                <div key={def.id} className="shortcut-row">
                  <div className="shortcut-row-info">
                    <Typography.Text>{def.label}</Typography.Text>
                    <Typography.Text type="tertiary" size="small">
                      {def.description}
                    </Typography.Text>
                  </div>
                  <div className="shortcut-row-key">
                    {isRecording ? (
                      <button
                        className="shortcut-key-btn shortcut-key-recording"
                        type="button"
                        onClick={handleStopRecord}
                      >
                        <span className="shortcut-recording-dot" />
                        请按下快捷键…
                      </button>
                    ) : (
                      <button
                        className={`shortcut-key-btn ${isCustom ? 'shortcut-key-custom' : ''}`}
                        type="button"
                        onClick={() => handleStartRecord(def.id)}
                        title="点击修改快捷键"
                      >
                        {formatKeyForDisplaySpans(currentKey).map((part, i) => (
                          <kbd key={i}>{part}</kbd>
                        ))}
                      </button>
                    )}
                    {isCustom && !isRecording ? (
                      <button
                        className="shortcut-reset-btn"
                        type="button"
                        title="恢复默认"
                        onClick={() => handleReset(def.id)}
                      >
                        ↺
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
