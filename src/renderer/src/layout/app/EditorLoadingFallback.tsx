/** Skeleton shown while the editor chunk (CodeMirror / ProseMirror / shiki) loads. */
export function EditorLoadingFallback(): React.JSX.Element {
  return (
    <div className="editor-loading" aria-label="正在加载编辑器">
      <div className="editor-loading-toolbar" />
      <div className="editor-loading-body">
        <div className="editor-loading-column">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="editor-loading-column editor-loading-column-preview">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
