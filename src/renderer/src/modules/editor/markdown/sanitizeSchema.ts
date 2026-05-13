import { defaultSchema } from 'rehype-sanitize'
import type { Options } from 'rehype-sanitize'

const safeTags = [
  'details',
  'summary',
  'kbd',
  'mark',
  'sub',
  'sup',
  'u',
  'del',
  'ins',
  'figure',
  'figcaption'
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
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-[\w-]+$/]],
    input: [...(defaultSchema.attributes?.input ?? []), 'checked', 'disabled', 'type'],
    ol: [...(defaultSchema.attributes?.ol ?? []), 'start'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align', 'colSpan', 'rowSpan'],
    th: [...(defaultSchema.attributes?.th ?? []), 'align', 'colSpan', 'rowSpan']
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data']
  }
}
