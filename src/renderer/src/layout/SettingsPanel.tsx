import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, InputNumber, Select, TextArea, Toast, Typography } from '@douyinfe/semi-ui'
import {
  IconArrowLeft,
  IconArticle,
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
import type {
  AppInfo,
  BackupFileStatus,
  BackupRunResult,
  UpdaterStatus
} from '../../../shared/types'
import {
  themeColorPresets,
  type AppearanceMode,
  type BackupProvider,
  type BackupTarget,
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

export type PreferenceSection =
  | 'general'
  | 'editor'
  | 'markdown'
  | 'appearance'
  | 'files'
  | 'sync'
  | 'shortcuts'
  | 'plugins'
  | 'about'

interface SettingsPageProps {
  settings: MarkdownEditorPreferences
  updaterStatus: UpdaterStatus | null
  workspaceRoot: string | null
  initialSection?: PreferenceSection
  onBack: () => void
  onChange: (settings: MarkdownEditorPreferences) => void
  onReset: () => void
  onCheckForUpdates: () => void
}

type SettingsPatch = Partial<MarkdownEditorPreferences>

const appearanceModeOptions: Array<{
  value: AppearanceMode
  label: string
  icon: React.ReactNode
}> = [
  { value: 'system', label: '跟随系统', icon: <IconDesktop /> },
  { value: 'light', label: '亮色', icon: <IconSunStroked /> },
  { value: 'dark', label: '黑色', icon: <IconMoonStroked /> }
]

const backupProviderOptions: Array<{ value: BackupProvider; label: string }> = [
  { value: 'local', label: '本地目录' },
  { value: 'webdav', label: 'WebDAV / Nextcloud / 坚果云' },
  { value: 's3', label: 'S3 兼容存储' },
  { value: 'onedrive', label: 'Microsoft OneDrive' },
  { value: 'google-drive', label: 'Google Drive' },
  { value: 'dropbox', label: 'Dropbox' }
]

const preferenceSections: Array<{
  id: PreferenceSection
  label: string
  icon: React.ReactNode
  description: string
  keywords: string
}> = [
  {
    id: 'general',
    label: '常规',
    icon: <IconSettingStroked />,
    description: '配置启动行为与默认编辑方式。',
    keywords: '启动 会话 自动换行 行号 默认模式'
  },
  {
    id: 'editor',
    label: '编辑器',
    icon: <IconEditStroked />,
    description: '调整源码与预览编辑器的字号和行高。',
    keywords: '字体 字号 行高 源码 预览'
  },
  {
    id: 'markdown',
    label: 'Markdown',
    icon: <IconArticle />,
    description: '控制 Markdown 排版、代码块和自定义样式。',
    keywords: '预览 宽度 居中 代码块 行号 CSS 样式'
  },
  {
    id: 'appearance',
    label: '外观',
    icon: <IconColorPalette />,
    description: '选择界面主题、颜色并实时预览效果。',
    keywords: '主题 深色 浅色 系统 颜色 外观'
  },
  {
    id: 'files',
    label: '文件管理',
    icon: <IconFolderStroked />,
    description: '设置 PDF、图片和文档的默认导出选项。',
    keywords: '文件 导出 PDF PNG JPEG Word HTML 倍率'
  },
  {
    id: 'sync',
    label: '同步与备份',
    icon: <IconCloudStroked />,
    description: '查看版本状态并检查应用更新。',
    keywords: '同步 备份 版本 更新 下载'
  },
  {
    id: 'shortcuts',
    label: '快捷键',
    icon: <IconCommand />,
    description: '查看、修改和恢复键盘快捷键。',
    keywords: '键盘 按键 命令 快捷键 冲突'
  },
  {
    id: 'plugins',
    label: '插件扩展',
    icon: <IconPuzzle />,
    description: '管理应用的扩展能力。',
    keywords: '插件 扩展'
  },
  {
    id: 'about',
    label: '关于',
    icon: <IconInfoCircle />,
    description: '查看 Velox 版本与技术信息。',
    keywords: '关于 版本 Electron React ProseMirror'
  }
]

export function SettingsPage({
  settings,
  updaterStatus,
  workspaceRoot,
  initialSection = 'general',
  onBack,
  onChange,
  onReset,
  onCheckForUpdates
}: SettingsPageProps): React.JSX.Element {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [activeSection, setActiveSection] = useState<PreferenceSection>(initialSection)
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('')
  const [backupRun, setBackupRun] = useState<BackupRunResult | null>(null)
  const [backupRunning, setBackupRunning] = useState(false)

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

  useEffect(() => {
    void window.api.backup.getLastRun().then((result) => {
      if (result.ok) setBackupRun(result.data)
    })

    return window.api.backup.onProgress((status) => {
      setBackupRun((current) => {
        if (!current) return current
        const existingIndex = current.files.findIndex(
          (file) => file.targetId === status.targetId && file.relativePath === status.relativePath
        )
        const files = [...current.files]
        if (existingIndex >= 0) files[existingIndex] = status
        else files.push(status)
        return { ...current, files }
      })
    })
  }, [])

  const updateSettings = (patch: SettingsPatch): void => {
    onChange({ ...settings, ...patch })
  }

  const updateBackup = (patch: Partial<typeof settings.backup>): void => {
    updateSettings({ backup: { ...settings.backup, ...patch } })
  }

  const addBackupTarget = (): void => {
    const target: BackupTarget = {
      id: crypto.randomUUID(),
      name: `备份目标 ${settings.backup.targets.length + 1}`,
      provider: 'local',
      enabled: true,
      remotePath: '',
      endpoint: '',
      bucket: '',
      region: '',
      clientId: '',
      tenantId: 'common'
    }
    updateBackup({ targets: [...settings.backup.targets, target] })
  }

  const updateBackupTarget = (id: string, patch: Partial<BackupTarget>): void => {
    updateBackup({
      targets: settings.backup.targets.map((target) =>
        target.id === id ? { ...target, ...patch } : target
      )
    })
  }

  const removeBackupTarget = (id: string): void => {
    updateBackup({ targets: settings.backup.targets.filter((target) => target.id !== id) })
  }

  const runBackup = async (): Promise<void> => {
    if (!workspaceRoot) {
      Toast.warning('请先打开一个工作区')
      return
    }

    setBackupRunning(true)
    setBackupRun({
      id: 'running',
      state: 'running',
      startedAt: new Date().toISOString(),
      totalFiles: 0,
      syncedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      files: []
    })
    const result = await window.api.backup.run(workspaceRoot)
    setBackupRunning(false)
    if (result.ok) {
      setBackupRun(result.data)
      Toast.success(`备份完成：${result.data.syncedFiles} 个文件`)
    } else {
      Toast.error(result.error.message)
    }
  }

  const selectSection = (section: PreferenceSection): void => {
    setActiveSection(section)
  }

  const normalizedSettingsSearchQuery = settingsSearchQuery.trim().toLowerCase()
  const visiblePreferenceSections = normalizedSettingsSearchQuery
    ? preferenceSections.filter((section) =>
        `${section.label} ${section.id} ${section.description} ${section.keywords}`
          .toLowerCase()
          .includes(normalizedSettingsSearchQuery)
      )
    : preferenceSections
  const activePreferenceSection =
    preferenceSections.find((section) => section.id === activeSection) ?? preferenceSections[0]

  const activeThemeColor =
    settings.themeColorPreset === 'custom'
      ? settings.customThemeColor
      : (themeColorPresets.find((preset) => preset.id === settings.themeColorPreset)?.color ??
        settings.customThemeColor)

  return (
    <section className="settings-page">
      <div className="settings-page-content">
        <aside className="settings-page-nav" aria-label="偏好设置分类">
          <div className="settings-page-nav-header">
            <div className="settings-page-title-row">
              <div className="settings-page-title">设置</div>
              <Button
                icon={<IconArrowLeft />}
                size="small"
                theme="light"
                type="tertiary"
                onClick={onBack}
              >
                返回编辑
              </Button>
            </div>
            <Input
              className="settings-search"
              prefix={<IconSearch />}
              value={settingsSearchQuery}
              placeholder="搜索设置项"
              onChange={setSettingsSearchQuery}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && visiblePreferenceSections[0]) {
                  event.preventDefault()
                  selectSection(visiblePreferenceSections[0].id)
                }
              }}
            />
          </div>
          <div className="settings-nav-list">
            {visiblePreferenceSections.map((section) => (
              <button
                key={section.id}
                className="settings-nav-item"
                data-active={section.id === activeSection}
                type="button"
                onClick={() => selectSection(section.id)}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
            {visiblePreferenceSections.length === 0 ? (
              <Typography.Text className="settings-nav-empty" type="tertiary">
                未找到设置项
              </Typography.Text>
            ) : null}
          </div>
        </aside>

        <main className="settings-page-main" data-active-section={activeSection}>
          <header className="settings-page-hero">
            <div>
              <Typography.Text className="settings-page-eyebrow" type="tertiary">
                偏好设置
              </Typography.Text>
              <Typography.Title heading={4}>{activePreferenceSection.label}</Typography.Title>
              <Typography.Text type="tertiary">
                {activePreferenceSection.description}
              </Typography.Text>
            </div>
            <div className="settings-page-hero-actions">
              <Button icon={<IconRefresh />} theme="light" onClick={onReset}>
                恢复默认
              </Button>
              <Button theme="solid" type="primary" onClick={onBack}>
                完成
              </Button>
            </div>
          </header>
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
                  title="代码块显示行号"
                  checked={settings.showCodeBlockLineNumbers}
                  onChange={(showCodeBlockLineNumbers) =>
                    updateSettings({ showCodeBlockLineNumbers })
                  }
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
            <div className="settings-box settings-box-grid backup-policy-box">
              <div className="settings-checkbox-list settings-grid-span-2">
                <CheckSetting
                  title="启用工作区备份"
                  checked={settings.backup.enabled}
                  onChange={(enabled) => updateBackup({ enabled })}
                />
                <CheckSetting
                  title="包含工作区内的图片和附件"
                  checked={settings.backup.includeAttachments}
                  onChange={(includeAttachments) => updateBackup({ includeAttachments })}
                />
              </div>
              <SettingField title="备份时机" description="手动、保存文档时或按固定周期运行">
                <Select
                  value={settings.backup.trigger}
                  onChange={(value) =>
                    updateBackup({ trigger: value as typeof settings.backup.trigger })
                  }
                >
                  <Select.Option value="manual">仅手动</Select.Option>
                  <Select.Option value="on-save">保存文档时</Select.Option>
                  <Select.Option value="interval">固定周期</Select.Option>
                </Select>
              </SettingField>
              <SettingField title="备份周期" description="周期备份的时间间隔，最少 5 分钟">
                <InputNumber
                  min={5}
                  max={10080}
                  suffix="分钟"
                  disabled={settings.backup.trigger !== 'interval'}
                  value={settings.backup.intervalMinutes}
                  onChange={(value) => updateBackup({ intervalMinutes: Number(value) })}
                />
              </SettingField>
              <SettingField title="版本保留" description="每个目标最多保留的历史备份数量">
                <InputNumber
                  min={1}
                  max={500}
                  suffix="份"
                  value={settings.backup.retentionCount}
                  onChange={(value) => updateBackup({ retentionCount: Number(value) })}
                />
              </SettingField>
              <SettingField title="冲突处理" description="本地与云端内容同时变化时采用的策略">
                <Select
                  value={settings.backup.conflictStrategy}
                  onChange={(value) =>
                    updateBackup({
                      conflictStrategy: value as typeof settings.backup.conflictStrategy
                    })
                  }
                >
                  <Select.Option value="keep-both">保留两个版本</Select.Option>
                  <Select.Option value="local-wins">以本地为准</Select.Option>
                  <Select.Option value="remote-wins">以云端为准</Select.Option>
                </Select>
              </SettingField>
              <SettingField
                className="settings-grid-span-2"
                title="排除规则"
                description="每行一个相对于工作区的目录、文件名或 Glob 规则"
              >
                <TextArea
                  rows={4}
                  value={settings.backup.excludePatterns}
                  onChange={(excludePatterns) => updateBackup({ excludePatterns })}
                />
              </SettingField>
            </div>
            <div className="backup-targets-header">
              <div>
                <Typography.Text strong>备份目标</Typography.Text>
                <Typography.Text type="tertiary">可配置多个平台并独立启用。</Typography.Text>
              </div>
              <Button theme="solid" type="primary" onClick={addBackupTarget}>
                添加目标
              </Button>
            </div>
            {settings.backup.targets.length === 0 ? (
              <div className="settings-box settings-placeholder-box">
                <Typography.Text strong>尚未配置备份目标</Typography.Text>
                <Typography.Text type="tertiary">
                  添加本地目录、WebDAV、S3 或常见云盘作为备份位置。
                </Typography.Text>
              </div>
            ) : (
              <div className="backup-target-list">
                {settings.backup.targets.map((target) => (
                  <BackupTargetEditor
                    key={target.id}
                    target={target}
                    onChange={(patch) => updateBackupTarget(target.id, patch)}
                    onRemove={() => removeBackupTarget(target.id)}
                  />
                ))}
              </div>
            )}
            <div className="settings-box backup-run-panel">
              <div className="backup-run-header">
                <div>
                  <Typography.Text strong>同步状态</Typography.Text>
                  <Typography.Text type="tertiary">
                    {backupRun
                      ? `${backupRun.syncedFiles} 已同步 · ${backupRun.skippedFiles} 已跳过 · ${backupRun.failedFiles} 失败`
                      : '尚未执行备份'}
                  </Typography.Text>
                </div>
                <Button
                  theme="solid"
                  type="primary"
                  loading={backupRunning}
                  disabled={!workspaceRoot || settings.backup.targets.length === 0}
                  onClick={() => void runBackup()}
                >
                  立即同步
                </Button>
              </div>
              {backupRun?.files.length ? (
                <div className="backup-file-status-list" aria-label="同步文件状态">
                  {backupRun.files.map((file) => (
                    <BackupFileStatusRow
                      key={`${file.targetId}:${file.relativePath}`}
                      status={file}
                    />
                  ))}
                </div>
              ) : null}
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
            <div className="settings-box settings-box-grid">
              <SettingField title="更新状态" description={updaterStatus?.message ?? '尚未检查更新'}>
                <span className="settings-update-state" data-state={updaterStatus?.state ?? 'idle'}>
                  {getUpdaterStateLabel(updaterStatus)}
                </span>
              </SettingField>
              <div className="settings-action-row">
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
          {activeSection === 'appearance' ? (
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
                <div className="density-card-grid" role="radiogroup" aria-label="界面密度">
                  <DensityCard
                    label="紧凑"
                    active={settings.uiDensity === 'compact'}
                    onClick={() => updateSettings({ uiDensity: 'compact' })}
                  />
                  <DensityCard
                    label="默认"
                    active={settings.uiDensity === 'default'}
                    onClick={() => updateSettings({ uiDensity: 'default' })}
                  />
                  <DensityCard
                    label="舒适"
                    active={settings.uiDensity === 'comfortable'}
                    onClick={() => updateSettings({ uiDensity: 'comfortable' })}
                  />
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
          ) : null}
        </main>
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

function BackupTargetEditor({
  target,
  onChange,
  onRemove
}: {
  target: BackupTarget
  onChange: (patch: Partial<BackupTarget>) => void
  onRemove: () => void
}): React.JSX.Element {
  const isOAuthProvider = ['onedrive', 'google-drive', 'dropbox'].includes(target.provider)

  return (
    <section className="settings-box backup-target-card">
      <div className="backup-target-card-header">
        <Input
          value={target.name}
          aria-label="备份目标名称"
          onChange={(name) => onChange({ name })}
        />
        <CheckSetting
          title="启用"
          checked={target.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
        <Button theme="borderless" type="danger" onClick={onRemove}>
          移除
        </Button>
      </div>
      <div className="settings-box-grid backup-target-fields">
        <SettingField title="存储平台" description="该目标使用的云存储协议或服务">
          <Select
            value={target.provider}
            onChange={(provider) => onChange({ provider: provider as BackupProvider })}
          >
            {backupProviderOptions.map((option) => (
              <Select.Option key={option.value} value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select>
        </SettingField>
        <SettingField
          title={target.provider === 'local' ? '备份目录' : '远端目录'}
          description="备份文件在目标平台中的保存位置"
        >
          <Input
            value={target.remotePath}
            placeholder={target.provider === 'local' ? '/Users/name/Backups' : '/Velox'}
            onChange={(remotePath) => onChange({ remotePath })}
          />
        </SettingField>
        {target.provider === 'webdav' || target.provider === 's3' ? (
          <SettingField title="服务地址" description="自托管或兼容服务的 HTTPS Endpoint">
            <Input
              value={target.endpoint}
              placeholder="https://storage.example.com"
              onChange={(endpoint) => onChange({ endpoint })}
            />
          </SettingField>
        ) : null}
        {target.provider === 's3' ? (
          <>
            <SettingField title="Bucket" description="S3 存储桶名称">
              <Input value={target.bucket} onChange={(bucket) => onChange({ bucket })} />
            </SettingField>
            <SettingField title="Region" description="例如 us-east-1 或 cn-north-1">
              <Input value={target.region} onChange={(region) => onChange({ region })} />
            </SettingField>
          </>
        ) : null}
        {isOAuthProvider ? (
          <>
            <SettingField title="Client ID" description="由用户在对应平台开发者控制台创建">
              <Input value={target.clientId} onChange={(clientId) => onChange({ clientId })} />
            </SettingField>
            {target.provider === 'onedrive' ? (
              <SettingField title="Tenant ID" description="个人账户可填写 common">
                <Input value={target.tenantId} onChange={(tenantId) => onChange({ tenantId })} />
              </SettingField>
            ) : null}
          </>
        ) : null}
      </div>
      {target.provider !== 'local' ? (
        <div className="backup-auth-notice">
          凭据和 OAuth 令牌将在连接授权时写入系统安全存储，不会保存在普通偏好设置中。
        </div>
      ) : null}
    </section>
  )
}

const backupFileStateLabels: Record<BackupFileStatus['state'], string> = {
  pending: '等待中',
  syncing: '同步中',
  synced: '已同步',
  skipped: '已跳过',
  conflict: '有冲突',
  failed: '失败'
}

function BackupFileStatusRow({ status }: { status: BackupFileStatus }): React.JSX.Element {
  return (
    <div className="backup-file-status-row" data-state={status.state}>
      <span className="backup-file-state-dot" />
      <span className="backup-file-path" title={status.relativePath}>
        {status.relativePath}
      </span>
      {status.message ? <span className="backup-file-message">{status.message}</span> : null}
      {status.bytes !== undefined ? (
        <span className="backup-file-size">{formatFileSize(status.bytes)}</span>
      ) : null}
      <span className="backup-file-state">{backupFileStateLabels[status.state]}</span>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

function DensityCard({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      className="density-card"
      type="button"
      role="radio"
      aria-checked={active}
      data-active={active}
      onClick={onClick}
    >
      <span />
      <span />
      <span />
      <strong>{label}</strong>
    </button>
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
  const customShortcutCount = Object.keys(overrides).length
  const shortcutKeyCounts = shortcutDefinitions.reduce<Map<string, number>>((counts, def) => {
    const key = getShortcutKey(def, overrides)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    return counts
  }, new Map())
  const conflictGroupCount = Array.from(shortcutKeyCounts.values()).filter(
    (count) => count > 1
  ).length

  return (
    <div className="shortcut-settings">
      <div className="shortcut-overview">
        <div className="shortcut-overview-copy">
          <Typography.Text strong>快捷键管理</Typography.Text>
          <Typography.Text type="tertiary">
            共 {shortcutDefinitions.length} 个命令
            {customShortcutCount > 0 ? `，已自定义 ${customShortcutCount} 个` : '，全部使用默认值'}
            {conflictGroupCount > 0 ? `，${conflictGroupCount} 组冲突` : ''}
          </Typography.Text>
        </div>
        <Button
          icon={<IconRefresh />}
          size="small"
          theme="light"
          type="tertiary"
          disabled={!hasOverrides}
          onClick={handleResetAll}
        >
          全部恢复默认
        </Button>
      </div>

      {shortcutCategories.map((cat) => {
        const defs = shortcutDefinitions.filter((d) => d.category === cat.id)
        if (defs.length === 0) return null
        const categoryCustomCount = defs.filter((def) => overrides[def.id] !== undefined).length
        const categoryConflictCount = defs.filter(
          (def) => (shortcutKeyCounts.get(getShortcutKey(def, overrides)) ?? 0) > 1
        ).length

        return (
          <div key={cat.id} className="shortcut-category">
            <div className="shortcut-category-header">
              <div className="shortcut-category-title">
                <Typography.Text strong>{cat.label}</Typography.Text>
                <span>{defs.length} 项</span>
              </div>
              <div className="shortcut-category-meta">
                {categoryCustomCount > 0 ? <span>{categoryCustomCount} 个自定义</span> : null}
                {categoryConflictCount > 0 ? (
                  <span data-state="warning">{categoryConflictCount} 个冲突</span>
                ) : null}
              </div>
            </div>
            {defs.map((def) => {
              const currentKey = getShortcutKey(def, overrides)
              const isCustom = overrides[def.id] !== undefined
              const isRecording = recordingId === def.id
              const hasConflict = (shortcutKeyCounts.get(currentKey) ?? 0) > 1

              return (
                <div
                  key={def.id}
                  className="shortcut-row"
                  data-custom={isCustom}
                  data-conflict={hasConflict}
                  data-recording={isRecording}
                >
                  <div className="shortcut-row-info">
                    <div className="shortcut-command-title">
                      <Typography.Text>{def.label}</Typography.Text>
                      <div className="shortcut-command-badges">
                        {isCustom ? <span>自定义</span> : null}
                        {hasConflict ? <span data-state="warning">冲突</span> : null}
                      </div>
                    </div>
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
                        按下新的快捷键
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
                    <button
                      className="shortcut-reset-btn"
                      type="button"
                      title="恢复默认"
                      disabled={!isCustom || isRecording}
                      aria-hidden={!isCustom || isRecording}
                      data-visible={isCustom && !isRecording}
                      onClick={() => handleReset(def.id)}
                    >
                      <IconRefresh />
                    </button>
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
