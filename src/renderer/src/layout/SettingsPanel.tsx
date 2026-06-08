import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, InputNumber, Select, Switch, TextArea, Typography } from '@douyinfe/semi-ui'
import {
  IconArrowLeft,
  IconArticle,
  IconCodeStroked,
  IconColorPalette,
  IconDesktop,
  IconExport,
  IconMoonStroked,
  IconRefresh,
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
type PreferenceSection = 'interface' | 'source' | 'preview' | 'shortcuts' | 'export' | 'updates'

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
  { id: 'interface', label: '界面偏好', icon: <IconDesktop /> },
  { id: 'source', label: '源码编辑', icon: <IconCodeStroked /> },
  { id: 'preview', label: '预览渲染', icon: <IconArticle /> },
  { id: 'shortcuts', label: '快捷键', icon: <IconSettingStroked /> },
  { id: 'export', label: '导出默认项', icon: <IconExport /> },
  { id: 'updates', label: '应用更新', icon: <IconRefresh /> }
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

  return (
    <section className="settings-page">
      <header className="settings-page-header">
        <Button
          aria-label="返回编辑器"
          icon={<IconArrowLeft />}
          theme="borderless"
          type="tertiary"
          onClick={onBack}
        />
        <div className="settings-page-title">
          <Typography.Title heading={4}>偏好设置</Typography.Title>
          <Typography.Text type="tertiary">调整写作界面、源码编辑与预览渲染体验</Typography.Text>
        </div>
        <Button icon={<IconRefresh />} theme="borderless" onClick={onReset}>
          恢复默认
        </Button>
      </header>

      <div className="settings-page-content">
        <aside className="settings-page-nav" aria-label="偏好设置分类">
          <div className="settings-brand-header">
            <BrandLogo className="settings-brand-logo" size={36} />
            <div>
              <Typography.Text className="settings-nav-eyebrow">Velox</Typography.Text>
              <Typography.Title heading={5}>Preferences</Typography.Title>
            </div>
          </div>
          <div className="settings-nav-list">
            {preferenceSections.map((section) => (
              <button
                key={section.id}
                className="settings-nav-item"
                type="button"
                onClick={() => scrollToSection(section.id)}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </div>
          <section className="settings-version-card">
            <BrandLogo className="settings-about-logo" />
            <div>
              <Typography.Text strong>Velox Markdown Editor</Typography.Text>
              <Typography.Text type="tertiary">版本 {appInfo?.version ?? '-'}</Typography.Text>
            </div>
          </section>
        </aside>

        <div className="settings-page-main">
          <SettingsCard
            id="settings-interface"
            icon={<IconSettingStroked />}
            title="界面偏好"
            description="控制默认视图、工作区导航和启动后的界面状态。"
          >
            <SettingRow title="默认编辑模式" description="新会话打开时使用的编辑视图">
              <Select
                value={settings.defaultMode}
                style={{ width: 165 }}
                onChange={(value) => updateSettings({ defaultMode: value as EditorMode })}
              >
                {(Object.keys(editorModeLabels) as EditorMode[]).map((mode) => (
                  <Select.Option key={mode} value={mode}>
                    {editorModeLabels[mode]}
                  </Select.Option>
                ))}
              </Select>
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="启动时显示工作区" description="控制左侧文件导航是否默认展开">
              <Switch
                checked={settings.showSidebar}
                onChange={(showSidebar) => updateSettings({ showSidebar })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="外观模式" description="选择黑色、亮色，或跟随系统设置自动切换">
              <Select
                value={settings.appearanceMode}
                style={{ width: 165 }}
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
            </SettingRow>
            <SettingSeparator />
            <div className="setting-block">
              <div className="setting-row-text">
                <Typography.Text strong>主题色</Typography.Text>
                <Typography.Text type="tertiary">
                  使用集中预设主题色，或切换到自定义颜色
                </Typography.Text>
              </div>
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
                  >
                    <span className="theme-color-swatch-dot" />
                    <span>{preset.label}</span>
                  </button>
                ))}
                <button
                  className="theme-color-swatch theme-color-swatch-custom"
                  type="button"
                  role="radio"
                  aria-checked={settings.themeColorPreset === 'custom'}
                  style={{ '--swatch-color': settings.customThemeColor } as React.CSSProperties}
                  data-active={settings.themeColorPreset === 'custom'}
                  onClick={() => updateSettings({ themeColorPreset: 'custom' })}
                >
                  <IconColorPalette />
                  <span>自定义</span>
                </button>
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
          </SettingsCard>

          <SettingsCard
            id="settings-source"
            icon={<IconCodeStroked />}
            title="源码编辑"
            description="配置 CodeMirror 源码区的阅读密度和换行行为。"
          >
            <SettingRow title="显示行号" description="控制源码编辑区左侧行号显示">
              <Switch
                checked={settings.showLineNumbers}
                onChange={(showLineNumbers) => updateSettings({ showLineNumbers })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="自动换行" description="长行自动折行，适合写作场景">
              <Switch
                checked={settings.wordWrap}
                onChange={(wordWrap) => updateSettings({ wordWrap })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="编辑字号" description="源码编辑器字体大小">
              <InputNumber
                min={12}
                max={24}
                value={settings.editorFontSize}
                suffix="px"
                onChange={(value) => updateSettings({ editorFontSize: Number(value) })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="编辑行高" description="源码编辑器行间距">
              <InputNumber
                min={1.3}
                max={2.2}
                step={0.05}
                value={settings.editorLineHeight}
                onChange={(value) => updateSettings({ editorLineHeight: Number(value) })}
              />
            </SettingRow>
          </SettingsCard>

          <SettingsCard
            id="settings-preview"
            icon={<IconArticle />}
            title="预览渲染"
            description="控制实时预览编辑的版心、字号与渲染样式。"
          >
            <SettingRow title="预览居中" description="预览编辑内容使用居中版心">
              <Switch
                checked={settings.previewCentered}
                onChange={(previewCentered) => updateSettings({ previewCentered })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="预览最大宽度" description="控制预览编辑内容宽度">
              <InputNumber
                min={680}
                max={1800}
                step={20}
                value={settings.previewMaxWidth}
                suffix="px"
                onChange={(value) => updateSettings({ previewMaxWidth: Number(value) })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="预览字号" description="预览编辑字号">
              <InputNumber
                min={13}
                max={24}
                value={settings.previewFontSize}
                suffix="px"
                onChange={(value) => updateSettings({ previewFontSize: Number(value) })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="预览行高" description="预览编辑行高">
              <InputNumber
                min={1.4}
                max={2.4}
                step={0.05}
                value={settings.previewLineHeight}
                onChange={(value) => updateSettings({ previewLineHeight: Number(value) })}
              />
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="预览页宽" description="控制类 Typora 预览编辑版心">
              <Select
                style={{ width: 165 }}
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
            </SettingRow>
            <SettingSeparator />
            <div className="setting-block">
              <div className="setting-row-text">
                <Typography.Text strong>自定义 CSS</Typography.Text>
                <Typography.Text type="tertiary">注入到预览渲染区域的附加样式</Typography.Text>
              </div>
              <TextArea
                autosize={false}
                rows={5}
                placeholder="/* 在这里添加自定义预览样式 */"
                value={settings.customPreviewCss}
                onChange={(value) => updateSettings({ customPreviewCss: value })}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            id="settings-shortcuts"
            icon={<IconSettingStroked />}
            title="快捷键"
            description="查看和自定义编辑器快捷键，点击快捷键可重新绑定。"
          >
            <ShortcutSettings
              overrides={settings.shortcutOverrides}
              onChange={(overrides) => updateSettings({ shortcutOverrides: overrides })}
            />
          </SettingsCard>

          <SettingsCard
            id="settings-export"
            icon={<IconExport />}
            title="导出默认项"
            description="控制 PDF、图片、HTML 和 Word 导出时使用的默认行为。"
          >
            <SettingRow title="默认导出格式" description="用于后续快捷导出和菜单默认行为">
              <Select
                value={settings.export.defaultFormat}
                style={{ width: 165 }}
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
            </SettingRow>
            <SettingSeparator />
            <SettingRow
              title="包含自定义 CSS"
              description="导出 HTML、PDF 和图片时应用预览自定义 CSS"
            >
              <Switch
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
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="PDF 页面尺寸" description="控制 PDF 导出的分页纸张尺寸">
              <Select
                value={settings.export.pdfPageSize}
                style={{ width: 165 }}
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
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="图片格式" description="从菜单导出图片时使用的默认格式">
              <Select
                value={settings.export.imageFormat}
                style={{ width: 165 }}
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
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="图片倍率" description="提高导出图片的像素密度">
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
            </SettingRow>
          </SettingsCard>

          <SettingsCard
            id="settings-updates"
            icon={<IconRefresh />}
            title="应用更新"
            description="查看当前版本状态，并手动检查是否有可用更新。"
          >
            <SettingRow
              title="当前版本"
              description={appInfo?.isPackaged ? '正式安装版本' : '开发环境'}
            >
              <div className="settings-version-value">v{appInfo?.version ?? '-'}</div>
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="更新状态" description={updaterStatus?.message ?? '尚未检查更新'}>
              <span className="settings-update-state" data-state={updaterStatus?.state ?? 'idle'}>
                {getUpdaterStateLabel(updaterStatus)}
              </span>
            </SettingRow>
            <SettingSeparator />
            <SettingRow title="手动检查" description="立即连接更新源并获取最新版本信息">
              <Button
                icon={<IconRefresh />}
                loading={updaterStatus?.state === 'checking'}
                disabled={updaterStatus?.state === 'downloading'}
                onClick={onCheckForUpdates}
              >
                检查更新
              </Button>
            </SettingRow>
          </SettingsCard>

          <section className="settings-about-card">
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
          </section>
        </div>
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

function SettingsCard({
  id,
  icon,
  title,
  description,
  children
}: {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section id={id} className="settings-card">
      <header className="settings-card-header">
        <span className="settings-card-icon">{icon}</span>
        <div>
          <Typography.Title heading={6}>{title}</Typography.Title>
          <Typography.Text type="tertiary">{description}</Typography.Text>
        </div>
      </header>
      <div className="settings-card-body">{children}</div>
    </section>
  )
}

function SettingRow({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="setting-row">
      <div className="setting-row-text">
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="tertiary">{description}</Typography.Text>
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  )
}

function SettingSeparator(): React.JSX.Element {
  return <div className="setting-separator" />
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
