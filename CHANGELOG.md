# Changelog

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
