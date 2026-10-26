import { useMemo, useRef, type CSSProperties } from 'react'

export interface StreamTextProps {
  /** The full text so far (grows monotonically while streaming). */
  text: string
  className?: string
}

/**
 * Rule 4 — streaming reveal.
 *
 * Each new glyph runs `blur(6px) → sharp` over 90 ms with
 * cubic-bezier(.215,.61,.355,1); adjacent glyphs are staggered 30 ms, so about
 * three characters are in flight at once and the line "blooms" forward instead
 * of popping in.
 *
 * Only the newly arrived characters are wrapped, so a long stream never
 * accumulates thousands of animations. Past 200 new characters in one frame the
 * reveal degrades to a single fade for the batch.
 */
export function StreamText({ text, className }: StreamTextProps): React.JSX.Element {
  const previousRef = useRef('')
  const previous = previousRef.current

  const { stable, fresh, replaced } = useMemo(() => {
    previousRef.current = text

    if (!text.startsWith(previous)) {
      return { stable: '', fresh: text, replaced: true }
    }

    return { stable: previous, fresh: text.slice(previous.length), replaced: false }
  }, [previous, text])

  const bulk = fresh.length > 200

  return (
    <span
      className={['stream-text', className].filter(Boolean).join(' ')}
      data-replaced={replaced || undefined}
    >
      {stable}
      {bulk ? (
        <span className="stream-text-bulk">{fresh}</span>
      ) : (
        [...fresh].map((glyph, index) => (
          <span
            key={`${index}-${glyph}`}
            className="stream-glyph"
            style={{ '--glyph-index': index } as CSSProperties}
          >
            {glyph}
          </span>
        ))
      )}
    </span>
  )
}
