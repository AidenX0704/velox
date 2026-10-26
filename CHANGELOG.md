# Changelog

## 1.1.0 - 2026-10-26

Design system v2, startup and file-sync overhaul.

### Added

- Added live reload for documents edited outside the app: clean buffers are replaced silently (caret preserved), dirty buffers raise an inline conflict banner instead of losing work, and window focus double-checks files on network shares where inotify is unreliable.
- Added a first-paint skeleton in `index.html` plus a themed window background, so the window shows UI immediately instead of a blank rectangle.
- Added an error boundary: a render failure now shows a recoverable screen rather than a permanently white window.
- Added an in-house UI primitive library (`src/renderer/src/ui`) with accessible Button, Input, TextArea, InputNumber, Select, Dropdown, Tooltip, Modal, Toast, Progress, Typography and StreamText.
- Added a `Startup timeline` log line (app-ready / window-created / services-ready / renderer-ready) so cold-start regressions are measurable.
- Added `npm run lint:design` (design-token guard) and `npm run check:bundle` (first-paint size budget).

### Changed

- Startup: the window is created before SQLite, services and IPC; export dependencies are loaded on demand; the document restore path issues its IPC calls in parallel and defers the workspace tree.
- App chrome is borderless: hierarchy now comes from 1–3% lightness steps, with a warm neutral palette (`#f5f5f3` … `#0b0b0a`) and no pure black.
- Dark mode lowers every font weight by 40 to stop white text from looking bolder.
- Focus is a double ring on fields and buttons instead of an outline.
- Markdown typography was rebuilt: 1.25 modular heading scale, 68ch reading measure, calm quote/table/code styling, `text-wrap` for orphans, CJK punctuation trimming and tabular figures.
- Syntax highlighting uses a single shiki instance with on-demand grammars; highlight.js and the oniguruma wasm bundle are gone.
- Removed `@douyinfe/semi-ui`; only `@douyinfe/semi-icons` remains.
- Tab drag-and-drop now settles with the overdamped spring curve, and the search replace row expands through a height-free grid transition.
- `MainLayout` was split from ~2,600 lines to ~1,480 (44% smaller, JSX down to ~310): pure helpers (`format`, `searchResults`, `paths`), components (`ResourceExplorer`, `RecentWorkbench`, `EditorLoadingFallback`) and hooks (`useUpdaterState`, `useExternalDocuments`, `useExplorerResize`, `useTitleBarSearch`), plus two small stores for the close-tab decision and the commands long-lived listeners call.
- Markdown parsing (remark/rehype/sanitize/KaTeX) now runs in a Web Worker; the main thread only turns the resulting tree into React elements, and heading anchors are assigned in that tree instead of through render-time counters that two previews could corrupt.
- Added `npm run test:visual` (Electron `capturePage` + pixel comparison against `design/baselines`, deterministic to 0 pixels) and `npm run test:markdown` (pipeline contract: anchors, GFM, KaTeX, frontmatter, sanitisation).
- The resource explorer toggle moved from the editor-mode group to the far left of the title bar, ahead of the 文件 menu, where it sits next to the panel it controls instead of leaning against the 源码 / 预览 switch.

### Fixed

- Opening a Markdown file from the shell now wins over the welcome screen on a first launch — previously the double-clicked document was silently replaced by "Welcome to Velox".
- Copy confirmation on code blocks retracts after 2.5s with a micro-bounce instead of leaving a stale checkmark and a duplicate toast.
- Deleting a workspace entry uses the dropdown's danger role again, and menus close after activation.

### Performance

- First-paint payload: 3.0 MB → 991 KB (−67%), gzip 150 KB. CSS alone dropped from 909 KB to 164 KB.
- Measured cold start: window visible at ~230–350 ms, first interactive frame at ~0.6–1.1 s.
- Renderer-side failures (process gone, failed load, preload error, unresponsive) are now logged instead of leaving a silent blank window.
- The first-paint skeleton is retired by the first of a frame callback or a 400 ms timer, so an occluded window can no longer leave it on screen.
- Largest lazy chunk: 2.93 MB → 915 KB; the 622 KB wasm and 1.14 MB Semi chunks are gone.

## 1.0.9 - 2026-08-17

### Added

- Added resource explorer visibility controls to the title bar and Window menu, with clear active, disabled, tooltip, and accessibility states.
- Added a compact explorer toolbar with file and folder creation, collapse-all, item count, and contextual workspace actions.

### Changed

- Kept the resource explorer hidden when no folder is open, showed it for new folder workspaces, and preserved each workspace's saved visibility preference.
- Refined the explorer hierarchy, workspace header, icons, selection states, empty states, spacing, and resize affordance for a cleaner document-focused layout.

### Fixed

- Restored reliable window dragging across unused title bar areas while keeping menus, search, editor modes, explorer controls, and window buttons interactive.
- Prevented failed workspace loads from leaving stale workspace state or an empty explorer visible.
- Published and verified the Windows and Linux auto-update metadata and release assets required by `electron-updater`.

## 1.0.8 - 2026-08-13

### Fixed

- Prevented unsaved tabs from closing when Save As is canceled, saving fails, or the save IPC call rejects.
- Changed the dirty-tab prompt to explicit save, discard, and cancel outcomes so Esc, backdrop clicks, and the dialog close button preserve the document.
- Preserved edits and path changes made while an asynchronous save is in progress instead of overwriting or closing the latest tab state.
- Added regression coverage for the save-before-close workflow and included it in the release pipeline.

## 1.0.7 - 2026-07-29

### Fixed

- Fixed macOS release publishing by validating and explicitly uploading Intel and Apple Silicon DMG, ZIP, and auto-update metadata assets after packaging.

## 1.0.6 - 2026-07-29

### Added

- Added in-document and workspace-wide search and replace with case-sensitive matching, result navigation, and replacement summaries.
- Added Mermaid diagram rendering, richer Markdown table editing, and per-tab reading position restoration.
- Added local Markdown image resolution for relative paths, absolute paths, and file URLs with workspace boundary and file-size safeguards.
- Added image resource tabs with zoom, original-size, and fit-to-window controls in the workspace explorer.
- Added operating-system file associations for Markdown and text documents.

### Changed

- Redesigned the workspace shell, title bar, resource explorer, settings surfaces, and editor styling for a denser document workflow.
- Switched the workspace tree to lazy directory loading with persisted expansion state and debounced filesystem refreshes for large workspaces.
- Refined code block and diagram presentation, simplified code block actions, and made code block line numbers an independent preference.
- Updated Windows packaging to use per-machine installation and reduced package compression time for release builds.

### Fixed

- Fixed local images not rendering consistently across preview, rich editing, and file URL sources.
- Protected rich-editor image nodes from accidental deletion by requiring a confirmed second delete action.
- Fixed workspace image resources being treated as unsupported documents and improved tab behavior for read-only previews.

## 1.0.5 - 2026-06-08

### Added

- Added a document history workbench with recent activity, rendered previews, current document diffs, timeline entries, and branch state.
- Added SQLite-backed document history storage for documents, blobs, branches, snapshots, and timeline events.
- Added history IPC APIs and preload bindings for listing timelines, listing branches, and reading document activity.
- Added an application updates section in settings with current version status and manual update checks.

### Changed

- Switched the default editor mode from split view to preview-edit mode, while normalizing legacy split-mode preferences and sessions.
- Refactored editor styling into focused CSS modules for code blocks, formatting toolbar, frontmatter, link previews, Markdown content, outline, preview layout, rich content, and source mode.
- Improved update dialogs and release note normalization for GitHub release metadata.
- Delayed automatic update checks during startup so the main window can become interactive first.

### Fixed

- Fixed rich editor code block insertion freezing by using ProseMirror block type commands and ignoring decorative code block node view DOM mutations.
- Fixed code block toolbar, line number, language picker, and syntax highlight DOM updates being interpreted as editable content changes.
- Fixed persisted legacy split-mode values resolving to an unsupported editor mode after preview-edit became the default.

## 1.0.3 - 2026-05-29

### Added

- Added a full document tab system with active tab state, close actions, close saved tabs, close other tabs, close all tabs, pinned tabs, middle-click close, context menu actions, and drag-to-reorder support.
- Added a closable welcome document tab so the built-in welcome content behaves like a normal editor tab instead of a fixed screen.
- Added drag-and-drop Markdown import from the desktop and file manager by exposing Electron `webUtils.getPathForFile` through the preload API.
- Added a resizable workspace explorer pane with pointer dragging, keyboard resizing, width clamping, and local persistence.
- Added the redesigned Velox logo source at `build/velox.png`.
- Added a complete generated icon pack, including multi-size PNG assets, Windows ICO, macOS ICNS, macOS iconset files, packaged app icon, and runtime renderer icon.
- Added Markdown frontmatter rendering for skill-style documents, including a dedicated metadata panel for `name`, `description`, and additional scalar or list fields.
- Added GitHub-style Markdown alerts for `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION`.
- Added richer preview support for `details`, `summary`, `kbd`, `mark`, task list checkboxes, and safer lazy-loaded images.

### Changed

- Reworked document state around tabs so each open document keeps its own content, dirty state, cursor position, editor mode, and path.
- Opening files from the explorer, recent files, drag-and-drop, and document links now preserves the current editor mode unless an explicit mode is requested.
- The title bar no longer duplicates document title state; open documents are represented by the tab bar.
- The standalone preview mode now uses the same `MarkdownPreview` and `renderMarkdownReact` pipeline as the split preview pane, keeping Markdown rendering consistent across view modes.
- Markdown preview spacing now follows GitHub-style soft line behavior more closely by avoiding unwanted whitespace preservation in normal paragraphs and inline spans.
- Blockquote styling was normalized across preview surfaces to avoid forced italics and heavy one-sided accent styling.
- Source editor syntax decorations now suppress CodeMirror-generated underlines in Markdown source mode.
- Icon generation now derives all app icons from `build/velox.png` instead of drawing the legacy SVG-based logo in script code.
- Project install, build, packaging, and documentation workflows now use npm consistently.

### Fixed

- Fixed tab switching failures caused by document state being tied to a single active document instead of per-tab state.
- Fixed view switching issues where selecting preview-related actions could force the editor into split mode instead of respecting the current rendering mode.
- Fixed Markdown drag-and-drop imports not resolving usable filesystem paths in the renderer process.
- Fixed the tab bar disappearing when only one tab was open, which made the welcome tab impossible to close.
- Fixed preview and split view rendering drift by removing the separate ProseMirror preview renderer from standalone preview mode.
- Fixed GitHub alert rendering leaving empty paragraphs after the alert marker was removed.
- Fixed preview layout inconsistencies caused by preserving raw whitespace in normal Markdown text.
- Fixed Windows packaging failures where electron-builder selected pnpm from project metadata and then failed under nvm-desktop with `command not found: "pnpm"`.
- Fixed npm packaging dependency collection after the package manager migration by adding `package-lock.json` and removing the pnpm lockfile.

### Removed

- Removed the old `build/logo.svg` source asset and pnpm-specific project metadata.
