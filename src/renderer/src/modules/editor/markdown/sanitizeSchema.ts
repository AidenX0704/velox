import { defaultSchema } from 'rehype-sanitize'
import type { Options } from 'rehype-sanitize'

const safeTags = [
  'abbr',
  'del',
  'details',
  'dd',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'ins',
  'kbd',
  'mark',
  'summary',
  'sub',
  'sup',
  'time',
  'u'
]

const globalAttributes = [
  ...(defaultSchema.attributes?.['*'] ?? []),
  'className',
  'id',
  'title',
  'align',
  'ariaLabel',
  'ariaHidden',
  'ariaPressed',
  'dataLanguage',
  'dataLanguageKind',
  'dataCodeAction',
  'dataCollapsed',
  'dataCopyState'
]

export const markdownSanitizeSchema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...safeTags],
  attributes: {
    ...defaultSchema.attributes,
    '*': globalAttributes,
    abbr: [...(defaultSchema.attributes?.abbr ?? []), 'title'],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), 'cite'],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-[\w-]+$/]],
    del: [...(defaultSchema.attributes?.del ?? []), 'cite', 'dateTime'],
    details: [...(defaultSchema.attributes?.details ?? []), 'open'],
    ins: [...(defaultSchema.attributes?.ins ?? []), 'cite', 'dateTime'],
    input: [...(defaultSchema.attributes?.input ?? []), 'checked', 'disabled', 'type'],
    ol: [...(defaultSchema.attributes?.ol ?? []), 'start'],
    time: [...(defaultSchema.attributes?.time ?? []), 'dateTime'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align', 'colSpan', 'rowSpan'],
    th: [...(defaultSchema.attributes?.th ?? []), 'align', 'colSpan', 'rowSpan']
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data']
  }
}
