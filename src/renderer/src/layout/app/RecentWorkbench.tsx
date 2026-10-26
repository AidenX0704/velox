import { Suspense } from 'react'
import type { HistoryDocumentActivity, RecentFileRecord } from '../../../../shared/types'
import { Typography } from '../../ui'
import { MarkdownPreview } from './lazyEditors'
import { formatActivityTime } from './format'

interface RecentWorkbenchProps {
  activity: HistoryDocumentActivity | null
  recentFiles: RecentFileRecord[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  onOpenInEditor: (path: string) => void
  onBack: () => void
  customCss?: string
  showCodeBlockLineNumbers: boolean
}

/** "Recent activity": history list, diff summary and a rendered preview. */
export function RecentWorkbench({
  activity,
  recentFiles,
  selectedPath,
  onSelectFile,
  onOpenInEditor,
  onBack,
  customCss,
  showCodeBlockLineNumbers
}: RecentWorkbenchProps): React.JSX.Element {
  const selectedFile = recentFiles.find((file) => file.path === selectedPath)

  return (
    <section className="recent-workbench" aria-label="最近活动">
      <header className="recent-workbench-header">
        <div className="recent-workbench-title">
          <Typography.Title as="h5">最近活动</Typography.Title>
          <Typography.Text type="tertiary">
            查看打开记录、分支推进和当前文档相对最近快照的变化。
          </Typography.Text>
        </div>
        <div className="recent-workbench-actions">
          <button className="recent-workbench-open" type="button" onClick={onBack}>
            返回编辑
          </button>
          {activity ? (
            <button
              className="recent-workbench-open recent-workbench-open-primary"
              type="button"
              onClick={() => onOpenInEditor(activity.path)}
            >
              打开编辑
            </button>
          ) : null}
        </div>
      </header>
      <div className="recent-workbench-body">
        <aside className="recent-workbench-list" aria-label="最近文档">
          {recentFiles.map((file) => (
            <button
              key={file.path}
              className="recent-workbench-file"
              data-active={file.path === selectedPath}
              type="button"
              title={file.path}
              onClick={() => onSelectFile(file.path)}
            >
              <span className="recent-workbench-file-title">{file.title}</span>
              <span className="recent-workbench-file-path">{file.path}</span>
              <span className="recent-workbench-file-time">
                {formatActivityTime(file.lastOpenedAt)}
              </span>
            </button>
          ))}
          {recentFiles.length === 0 ? (
            <Typography.Text className="recent-workbench-empty" type="tertiary">
              拖入或打开 Markdown 文档后会出现在这里
            </Typography.Text>
          ) : null}
        </aside>
        {activity ? (
          <>
            <section className="recent-workbench-state" aria-label="文档状态">
              <div className="recent-state-card">
                <span className="recent-state-label">当前文档</span>
                <strong title={activity.path}>{activity.title}</strong>
                <span className="recent-state-path">{activity.path}</span>
              </div>
              <div className="recent-state-grid">
                <div className="recent-state-metric">
                  <span>新增</span>
                  <strong>+{activity.diff.addedLines}</strong>
                </div>
                <div className="recent-state-metric">
                  <span>删除</span>
                  <strong>-{activity.diff.removedLines}</strong>
                </div>
                <div className="recent-state-metric">
                  <span>分支</span>
                  <strong>{activity.headSnapshot?.branchName ?? 'main'}</strong>
                </div>
              </div>
              <div className="recent-state-card">
                <span className="recent-state-label">最近快照</span>
                <strong>
                  {activity.headSnapshot
                    ? `#${activity.headSnapshot.id}`
                    : selectedFile
                      ? '等待首次快照'
                      : '暂无'}
                </strong>
                <span className="recent-state-path">
                  {formatActivityTime(activity.headSnapshot?.createdAt)}
                </span>
              </div>
              <div className="recent-diff-panel">
                <header>
                  <span>变化对比</span>
                  <strong>{activity.diff.unchanged ? '无未保存变化' : '当前文件有变化'}</strong>
                </header>
                <div className="recent-diff-lines">
                  {activity.diff.lines.map((line, index) => (
                    <div
                      key={`${line.type}-${index}`}
                      className="recent-diff-line"
                      data-type={line.type}
                    >
                      <span>
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      <code>{line.text || ' '}</code>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="recent-rendered-preview" aria-label="渲染预览">
              <Suspense fallback={<div className="recent-preview-loading" />}>
                <MarkdownPreview
                  content={activity.currentContent}
                  currentPath={activity.path}
                  customCss={customCss}
                  showCodeBlockLineNumbers={showCodeBlockLineNumbers}
                />
              </Suspense>
            </section>
          </>
        ) : (
          <div className="recent-workbench-placeholder">
            <Typography.Text type="tertiary">
              选择一个最近文档查看渲染状态和变化对比
            </Typography.Text>
          </div>
        )}
      </div>
    </section>
  )
}
