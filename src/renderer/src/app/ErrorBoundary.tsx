import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * A render error in Electron means a permanently blank window: there is no
 * address bar and no way back. This boundary keeps the failure recoverable and
 * surfaces the message instead of leaving the user with a white rectangle.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state

    if (!error) {
      return this.props.children
    }

    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <h1>界面渲染出错</h1>
          <p>
            这是一个非预期错误，文档内容仍保存在磁盘上。可以先重新加载界面；如果持续出现，请附上下面的信息反馈。
          </p>
          <pre>{error.message}</pre>
          <div className="crash-actions">
            <button type="button" onClick={() => window.location.reload()}>
              重新加载界面
            </button>
          </div>
        </div>
      </div>
    )
  }
}
