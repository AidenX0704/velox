# Editor Module

`modules/editor` owns all Markdown editing surfaces. Application layout code should depend on `MarkdownEditor` and shared model types only; it should not import CodeMirror, ProseMirror, Markdown rendering, or editor CSS directly.

## Boundaries

- `MarkdownEditor.tsx` composes source, split, and preview-edit modes.
- `source/` adapts CodeMirror for Markdown source editing.
- `preview/` owns read-only preview behavior and code block actions.
- `rich/` adapts ProseMirror for preview editing.
- `markdown/` owns Markdown rendering, language normalization, sanitization, math, tables, task lists, and code highlighting.
- `services/` contains browser/Electron integration helpers shared across surfaces.
- `styles/` contains editor-only styles; global layout styles stay in `assets/main.css`.

## Extension Rules

- Add Markdown syntax support in `markdown/` first, then expose matching UI in `preview/` or `rich/`.
- Keep Markdown text as the canonical document value passed through `onChange`.
- Share cross-surface actions such as clipboard, code block state, and language aliases through module services/utilities.
- Do not add editor-specific selectors back to `assets/main.css` unless they are application shell layout concerns.
