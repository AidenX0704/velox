# Velox Development Roadmap

## P0 Preview Editing Stability

The preview editor is the product core. Treat it as an editing engine project, not a visual polish task.

1. Keep Markdown parsing and serialization in `src/renderer/src/modules/editor/rich/markdownModel.ts`.
2. Add fixtures before changing syntax behavior. Every supported Markdown feature should round-trip through parse and serialize without drifting after the first normalization.
3. Stabilize base blocks first: paragraph, heading, list, quote, horizontal rule, code block.
4. Then add high-risk blocks: task list, table, math, image, HTML fallback.
5. Avoid structural input-rule transforms during IME composition.

## P1 Workspace Features

1. File tree context menu: new file, new folder, rename, delete, reveal in Explorer.
2. Workspace search across file names and Markdown contents.
3. Multi-document tabs with dirty state and close confirmation.
4. Recent workspaces and project restore.
5. External file change handling for modified, deleted, or renamed files.
6. Outline activity view based on Markdown headings.

## P2 Writing Features

1. Command palette for document, workspace, mode, export, and insert commands.
2. Templates for meeting notes, daily notes, technical docs, and reading notes.
3. Export to HTML and PDF.
4. Image asset management: paste image, save into workspace assets, insert relative link.
5. Local link completion for Markdown files and headings.
6. Backlinks and document references.
7. Writing stats: word target, reading time, document metrics.

## Current Preview Editor Baseline

- Markdown model extraction is complete.
- Rich Markdown fixtures run through `npm run test:rich-markdown`.
- Base input rules include headings, quotes, bullet lists, ordered lists, task-list prefix normalization, code fences, and horizontal rules.
