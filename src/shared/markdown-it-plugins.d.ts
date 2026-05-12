declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  const taskLists: MarkdownIt.PluginWithOptions<{
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }>

  export default taskLists
}

declare module 'markdown-it-multimd-table' {
  import type MarkdownIt from 'markdown-it'

  const multimdTable: MarkdownIt.PluginWithOptions<{
    multiline?: boolean
    rowspan?: boolean
    headerless?: boolean
    multibody?: boolean
    autolabel?: boolean
  }>

  export default multimdTable
}

declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'

  const texmath: MarkdownIt.PluginWithOptions<{
    engine: unknown
    delimiters?: string | string[]
    katexOptions?: Record<string, unknown>
  }>

  export default texmath
}
