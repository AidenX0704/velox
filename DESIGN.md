---
name: Velox
description: A Typora-inspired desktop Markdown editor built with Electron, React and TypeScript
version: 2
colors:
  surface-sunken: "#eeedea"
  surface-canvas: "#f5f5f3"
  surface-base: "#fcfcfb"
  surface-raised: "#ffffff"
  surface-canvas-dark: "#0b0b0a"
  surface-base-dark: "#131312"
  surface-raised-dark: "#1a1a19"
  surface-overlay-dark: "#20201e"
  text-primary-light: "#1c1b19"
  text-secondary-light: "#56534b"
  text-tertiary-light: "#6f6b62"
  text-primary-dark: "#e8e6e1"
  text-secondary-dark: "#a8a49b"
  text-tertiary-dark: "#8d8981"
  accent-fill-light: "#2563eb"
  accent-fill-dark: "#4f8cff"
  accent-text-light: "#1d4ed8"
  accent-text-dark: "#6ea3ff"
  label-on-accent-light: "#ffffff"
  label-on-accent-dark: "#0b0b0a"
typography:
  body:
    fontFamily: "system-ui stack: -apple-system, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif"
    size: "14px UI / 16px content"
    weight: "400 (dark 360)"
    lineHeight: "1.6 UI / 1.68 content"
  heading:
    scale: "1.25 modular: 32 / 26 / 22 / 18 / 16 / 14"
    weight: "620 (dark 580)"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
motion:
  ease-out-quart: "cubic-bezier(.215,.61,.355,1)"
  ease-drag: "linear(...) · spring k=1200 c=80 · 366ms · 0% overshoot"
  ease-spring: "linear(...) · spring k=380 c=18 · 775ms · 19.5% overshoot"
  durations: "140 / 180 / 320 / 366 / 420 / 2500 ms"
---

# Design System: Velox v2

> v1 used borders and a blue-slate palette. v2 replaces both: **hierarchy comes
> from 1–3% lightness steps**, and the brand colour is a calm, warm neutral
> canvas with a single saturated accent.

## 1. Overview

**Creative North Star: "The Quiet Desk"**

Velox is a Markdown editor for people who write for hours. The interface should
disappear into the paper: no boxes, no outlines around everything, no chrome
competing with the text. Depth is implied by light, not by strokes.

**Non-negotiables**

1. **Borders are banned for hierarchy.** Surfaces separate by 1–3% L\* steps.
   A line may exist only as a 1px inset hairline inside a single component
   (`box-shadow: inset 0 0 0 1px var(--hairline)`).
2. **Pure black is banned.** The darkest surface is `#0b0b0a` (L\* 3.0).
3. **Focus is a double ring, never an outline.** Inner 1.5px accent ring + 3px
   halo at 15% — it must read as the field "biting" into the page.
4. **Dark mode drops every weight by 40** (400→360, 620→580, 700→660). White
   text on black visually thickens; the compensation keeps density constant.

## 2. Colour

### Surface ladder (measured L\*)

| Mode | Token | Value | L\* | Δ |
|---|---|---|---|---|
| light | `--surface-sunken` | `#eeedea` | 93.75 | — |
| light | `--surface-canvas` | `#f5f5f3` | 96.49 | +2.74 |
| light | `--surface-base` | `#fcfcfb` | 98.94 | +2.45 |
| light | `--surface-raised` | `#ffffff` | 100.00 | +1.06 |
| dark | `--surface-canvas` | `#0b0b0a` | 3.00 | — |
| dark | `--surface-base` | `#131312` | 5.85 | +2.85 |
| dark | `--surface-raised` | `#1a1a19` | 9.23 | +3.38 |
| dark | `--surface-overlay` | `#20201e` | 12.18 | +2.95 |

Interaction states are **derived**, never hand-picked:

```css
--surface-hover:  color-mix(in oklab, var(--local-surface, var(--surface-base)), #1c1b19 3.2%);
--surface-active: color-mix(in oklab, var(--local-surface, var(--surface-base)), #1c1b19 6%);
```

### Text contrast (WCAG)

| Token | Light | on canvas | Dark | on base |
|---|---|---|---|---|
| primary | `#1c1b19` | **15.77** AAA | `#e8e6e1` | **14.64** AAA |
| secondary | `#56534b` | **7.03** AAA | `#a8a49b` | **7.35** AAA |
| tertiary | `#6f6b62` | 4.86 AA | `#8d8981` | 5.24 AA |

`#5a574f` (6.61 on canvas) and `#8b877d` (3.49) fail the AAA target — do not use
them for body text.

### Accent

Fill and text are **separate tokens**, because one colour cannot be both a
button background and a legible link:

- Light: fill `#2563eb` + `#ffffff` label (5.15:1) · text `#1d4ed8` (6.53:1)
- Dark: fill `#4f8cff` + `#0b0b0a` label (6.12:1) · text `#6ea3ff` (6.92:1)

Accent covers ≤ 10% of any screen. **The Content-First Rule** still holds.

## 3. Typography

**UI font:** system stack (`-apple-system / Segoe UI / PingFang SC / Noto Sans SC`).
**Code font:** `ui-monospace, SF Mono, Cascadia Mono, Menlo, Consolas`.

### Scale (fixed, not viewport-interpolated)

| Level | Size | Line-height | Weight (light/dark) |
|---|---|---|---|
| h1 | 32px | 1.16 | 620 / 580 |
| h2 | 26px | 1.20 | 620 / 580 |
| h3 | 22px | 1.26 | 600 / 560 |
| h4 | 18px | 1.35 | 600 / 560 |
| h5 | 16px | 1.40 | 600 / 560 |
| h6 | 14px | 1.40 | 560 / 520 |
| body | 16px (content) / 14px (UI) | 1.68 / 1.60 | 400 / 360 |

**Reading measure:** `68ch` (~720px at 16px). Never exceed 75ch.

**Named rules**

- **The Weight Compensation Rule.** Dark mode subtracts 40 from every weight;
  the tokens (`--w-body`, `--w-heading`, …) are the only place weights live.
  Never hard-code `font-weight: 700`.
- **The Orphan Rule.** Body copy uses `text-wrap: pretty`; headings use
  `text-wrap: balance`; CJK punctuation squeezing via `text-spacing-trim`.
- **The Tabular Rule.** Any number that can change in place (counters, line
  numbers, tables, timers) uses `font-variant-numeric: tabular-nums`.

## 4. Elevation

No drop shadows at rest. Elevation = surface step + (for floating layers) one
soft, large-radius shadow that reads as ambient occlusion, plus a hairline:

```css
.surface--float {
  background: var(--surface-overlay);
  box-shadow: inset 0 0 0 1px var(--hairline),
              0 14px 34px -14px rgba(15, 14, 12, 0.32);
}
```

## 5. Components

### Buttons
`theme`: solid · light · borderless · outline. `type`: primary · danger · warning.
30px tall (24 small / 34 large), 6px radius, label weight 600 (dark 560).

### Inputs / fields
Borderless tray: `background: color-mix(canvas, #1c1b19 3%)` with a 1px inner
shadow at rest. **Focus adds the double ring** — never `outline`.

### Menus / selects / tooltips
Floating surface (`--surface-overlay`), 8px radius, 4px inner padding, items are
6px-radius rows that highlight with `currentColor` at 8%. Menus close on item
activation, outside pointer-down, Esc, resize and window blur.

### Code blocks
`--code-bg` (canvas −3.5%), 10px radius, 1px inset hairline, headers hold the
language label and a copy action. Syntax colours come from a single shiki
instance (dual light/dark themes resolved through CSS variables).

### Feedback
- Copy → check morphs with an under-damped pop (**420ms, ≈6% overshoot**) and
  fades itself out after **2.5s**; no toast on top of it.
- Toasts enter with the spring curve and retract after 3.2s.
- Every feedback channel has exactly one signal.

## 6. Motion

| Token | Curve | Duration | Use |
|---|---|---|---|
| `--ease-out-quart` | `cubic-bezier(.215,.61,.355,1)` | 140–180ms | hover, focus, colour |
| `--ease-drag` | overdamped spring (k=1200, c=80) | 366ms | panel resize release, tab settle, collapse |
| `--ease-spring` | underdamped spring (k=380, c=18) | 775ms | toast/entrance |
| glyph reveal | `--ease-out-quart` | 90ms per glyph, 30ms stagger | streaming text |

Principles:

- Drags follow the pointer 1:1 while moving; the spring applies only to the
  settle. Never ease a value the cursor is directly controlling.
- `prefers-reduced-motion: reduce` removes all of the above.
- Nothing bounces except confirmations, and nothing overshoots more than ~6%.

## 7. Do's and Don'ts

**Do**
- Separate regions with a lightness step; verify by converting a screenshot to
  greyscale — the hierarchy must survive.
- Keep one accent, used sparingly, always with a contrast-checked label.
- Let the caret and the text be the brightest thing on screen.

**Don't**
- Don't add a border to "fix" a spacing problem.
- Don't write `#000`, `#fff` for dark text, or `outline: none` without a ring.
- Don't hand-pick hover colours; derive them with `color-mix`.
- Don't animate anything the user is dragging.
- Don't stack two confirmations for one action (toast + checkmark + colour).
