import { useEffect, useMemo, useState } from 'react'
import { getCodeLanguageMeta } from '../markdown/codeLanguage'
import { handleCodeBlockAction } from '../rendering/blockActions'
import { highlightCodeToHtml } from '../rendering/codeHighlight'

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps): React.JSX.Element {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const languageMeta = useMemo(() => getCodeLanguageMeta(language), [language])

  useEffect(() => {
    let cancelled = false

    highlightCodeToHtml(code, languageMeta.highlightLanguage).then((html) => {
      if (!cancelled) {
        setHighlightedHtml(html)
      }
    })

    return () => {
      cancelled = true
    }
  }, [code, languageMeta.highlightLanguage])

  return (
    <figure
      className="markdown-code-block"
      data-language={languageMeta.displayName}
      data-language-kind={languageMeta.kind}
    >
      <figcaption className="markdown-code-toolbar" contentEditable={false}>
        <span className="markdown-code-language">{languageMeta.displayName}</span>
        <span className="markdown-code-actions">
          <button
            className="markdown-code-action markdown-code-action-copy"
            type="button"
            title="复制代码"
            aria-label="复制代码"
            data-code-action="copy"
            onClick={(event) => handleCodeBlockAction(event.currentTarget)}
          >
            <span>复制</span>
          </button>
          <button
            className="markdown-code-action markdown-code-action-fold"
            type="button"
            title="折叠代码块"
            aria-label="折叠代码块"
            aria-pressed="false"
            data-code-action="fold"
            onClick={(event) => handleCodeBlockAction(event.currentTarget)}
          >
            <span>折叠</span>
          </button>
        </span>
      </figcaption>
      <div className="markdown-code-pre">
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre className="shiki markdown-code-fallback">
            <code data-raw-code={encodeURIComponent(code)}>{code}</code>
          </pre>
        )}
        <span className="markdown-code-raw" data-raw-code={encodeURIComponent(code)} />
      </div>
    </figure>
  )
}
