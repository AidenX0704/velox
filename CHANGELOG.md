# Changelog

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
