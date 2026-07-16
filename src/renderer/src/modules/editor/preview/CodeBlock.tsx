import { useEffect, useMemo, useState } from 'react'
import { getCodeLanguageMeta } from '../markdown/codeLanguage'
import { handleCodeBlockAction } from '../rendering/blockActions'
import { highlightCodeToHtml } from '../rendering/codeHighlight'
import { getCodeLineCount, renderCodeLineNumbers } from '../rendering/codeBlockModel'
import { isMermaidLanguage } from '../services/mermaidRenderer'
import { MermaidDiagram } from './MermaidDiagram'

interface CodeBlockProps {
  code: string
  language?: string
}

/**
 * Static CodeBlock component used in Markdown Preview.
 * In this mode, the language is read-only as it's driven by the source markdown.
 */
export function CodeBlock({ code, language }: CodeBlockProps): React.JSX.Element {
  if (isMermaidLanguage(language)) {
    return <MermaidDiagram definition={code} />
  }

  return <HighlightedCodeBlock code={code} language={language} />
}

function HighlightedCodeBlock({ code, language }: CodeBlockProps): React.JSX.Element {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const languageMeta = useMemo(() => getCodeLanguageMeta(language), [language])
  const lineNumbers = useMemo(() => renderCodeLineNumbers(getCodeLineCount(code)), [code])

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
      data-wrap="false"
    >
      <figcaption className="markdown-code-toolbar" contentEditable={false}>
        <span className="markdown-code-title">
          <button
            className="markdown-code-title-fold"
            type="button"
            title="折叠代码块"
            aria-label="折叠代码块"
            aria-pressed="false"
            data-code-action="fold"
            onClick={(event) => handleCodeBlockAction(event.currentTarget)}
          />
          <span className="markdown-code-title-text">代码块</span>
        </span>
        <span className="markdown-code-actions">
          <button
            className="markdown-code-language markdown-code-language-trigger"
            type="button"
            disabled
            aria-label={`代码语言：${languageMeta.displayName}`}
          >
            <span>{languageMeta.displayName}</span>
          </button>
          <button
            className="markdown-code-action markdown-code-action-wrap"
            type="button"
            title="自动换行"
            aria-label="自动换行"
            aria-pressed="false"
            data-code-action="wrap"
            onClick={(event) => handleCodeBlockAction(event.currentTarget)}
          >
            <span>自动换行</span>
          </button>
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
        </span>
      </figcaption>
      <div className="markdown-code-pre">
        <span className="markdown-code-line-numbers" aria-hidden="true">
          {lineNumbers}
        </span>
        <span className="markdown-code-content">
          {highlightedHtml ? (
            <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          ) : (
            <pre className="shiki markdown-code-fallback">
              <code data-raw-code={encodeURIComponent(code)}>{code}</code>
            </pre>
          )}
        </span>
        <span className="markdown-code-raw" data-raw-code={encodeURIComponent(code)} />
      </div>
    </figure>
  )
}
