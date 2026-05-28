---
name: Velox
description: A Typora-inspired desktop Markdown editor built with Electron, React and TypeScript
colors:
  primary: "#1260cf"
  primary-active: "#1677ff"
  primary-hover: "#156eea"
  primary-soft: "rgba(22, 119, 255, 0.12)"
  primary-softer: "rgba(22, 119, 255, 0.07)"
  app-bg-light: "#f5f7fb"
  app-bg-dark: "#0f1117"
  surface-base-light: "#ffffff"
  surface-base-dark: "#151821"
  surface-muted-light: "#f8fafc"
  surface-muted-dark: "#10131a"
  surface-raised-light: "#ffffff"
  surface-raised-dark: "#1b1f2a"
  surface-hover-light: "#f1f5f9"
  surface-hover-dark: "#242936"
  line-soft-light: "#e2e8f0"
  line-soft-dark: "rgba(226, 232, 240, 0.12)"
  line-strong-light: "#d5dde8"
  line-strong-dark: "rgba(226, 232, 240, 0.18)"
  text-primary-light: "#1e293b"
  text-primary-dark: "#e5e7eb"
  text-secondary-light: "#64748b"
  text-secondary-dark: "#aab3c2"
  text-tertiary-light: "#94a3b8"
  text-tertiary-dark: "#788396"
  text-on-brand: "#ffffff"
  danger: "#ef4444"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-on-brand}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary-light}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-hover-light}"
    textColor: "{colors.text-primary-light}"
  input:
    backgroundColor: "{colors.surface-base-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-focus:
    borderColor: "{colors.primary-active}"
  card:
    backgroundColor: "{colors.surface-raised-light}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  card-hover:
    backgroundColor: "{colors.surface-hover-light}"
---

# Design System: Velox

## 1. Overview

**Creative North Star: "The Efficient Workspace"**

Velox is a clean, professional Markdown editor designed for developers, writers, students, and general users who need to focus on content creation without distractions. The interface prioritizes efficiency and simplicity, providing a professional-grade editing experience while maintaining a clean, uncluttered appearance.

The system explicitly rejects overly simplistic notepad interfaces that lack professional features, as well as overly complex IDE interfaces that overwhelm users with too many options and visual noise.

**Key Characteristics:**
- Content-first design that prioritizes the editing experience
- Clean, professional interface with minimal visual distractions
- Efficient workflows with intuitive controls and shortcuts
- Flexible editing modes to accommodate different user preferences

## 2. Colors

The palette is built around a restrained, professional blue accent with neutral backgrounds that adapt to light and dark modes.

### Primary
- **Brand Blue** (#1260cf): The primary accent color used for interactive elements, selections, and active states. Provides professional visual hierarchy without overwhelming the interface.
- **Brand Blue Active** (#1677ff): Used for hover and active states of interactive elements.
- **Brand Blue Soft** (rgba(22, 119, 255, 0.12)): Subtle background tint for selected items and active states.

### Neutral
- **Surface Base** (#ffffff light / #151821 dark): Primary background for content areas and main interface surfaces.
- **Surface Muted** (#f8fafc light / #10131a dark): Secondary background for less prominent areas like sidebars and toolbars.
- **Surface Raised** (#ffffff light / #1b1f2a dark): Background for elevated elements like cards and modals.
- **Surface Hover** (#f1f5f9 light / #242936 dark): Background for hover states on interactive elements.
- **Line Soft** (#e2e8f0 light / rgba(226, 232, 240, 0.12) dark): Subtle borders and dividers.
- **Line Strong** (#d5dde8 light / rgba(226, 232, 240, 0.18) dark): More prominent borders for emphasis.
- **Text Primary** (#1e293b light / #e5e7eb dark): Main text color for primary content.
- **Text Secondary** (#64748b light / #aab3c2 dark): Secondary text for labels and less important information.
- **Text Tertiary** (#94a3b8 light / #788396 dark): Tertiary text for hints and placeholder content.

### Named Rules
**The Content-First Rule.** The primary accent is used sparingly (≤10% of any given screen) to maintain focus on content. Its rarity is intentional.

## 3. Typography

**Body Font:** Inter (with system-ui fallback)
**Label Font:** Inter (with system-ui fallback)

**Character:** Clean, modern, and highly readable. The typography system prioritizes clarity and efficiency, with clear hierarchy through size and weight contrast.

### Hierarchy
- **Title** (600, 13px, 1.35): Used for section headers and important labels.
- **Body** (400, 14px, 1.6): Main content text with optimal readability. Max line length: 65-75ch.
- **Label** (600, 12px, 1.35): Used for UI labels, buttons, and secondary information.

### Named Rules
**The Efficiency Rule.** Typography choices prioritize readability and quick scanning. No decorative fonts that sacrifice legibility.

## 4. Elevation

The system uses a flat-by-default approach with subtle elevation changes for interactive states. Depth is conveyed through surface color differentiation rather than shadows.

### Shadow Vocabulary
- **Subtle Lift** (`box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12)`): Used sparingly for floating elements like tooltips and dropdowns.
- **Modal Shadow** (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`): Used for modal dialogs and overlays.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus) and are kept minimal.

## 5. Components

### Buttons
- **Shape:** Gently curved edges (6px radius)
- **Primary:** Brand blue background with white text, 8px 16px padding
- **Hover / Focus:** Lighter blue background with smooth transition
- **Ghost:** Transparent background with secondary text, becomes visible on hover

### Inputs / Fields
- **Style:** Clean stroke with subtle background, 6px radius
- **Focus:** Blue border glow to indicate active state
- **Error / Disabled:** Red for errors, muted appearance for disabled states

### Cards / Containers
- **Corner Style:** Gently curved edges (8px radius)
- **Background:** Surface raised color with subtle border
- **Shadow Strategy:** Minimal shadows, primarily using surface color differentiation
- **Border:** Soft line border for definition
- **Internal Padding:** 16px standard padding

### Navigation
- **Style:** Clean, minimal navigation with clear hierarchy
- **Typography:** Title weight for active items, body weight for inactive
- **Default/Hover/Active States:** Subtle background changes with smooth transitions

## 6. Do's and Don'ts

### Do:
- **Do** use the primary accent color sparingly (≤10% of screen) to maintain focus on content
- **Do** maintain consistent 8px spacing grid for layout alignment
- **Do** use clear visual hierarchy through typography weight and size
- **Do** provide smooth transitions (140ms ease) for interactive state changes
- **Do** support both light and dark modes with appropriate color adaptation
- **Do** ensure WCAG AAA compliance for all text and interactive elements

### Don't:
- **Don't** use overly simplistic notepad interfaces that lack professional features (anti-reference from PRODUCT.md)
- **Don't** create overly complex IDE interfaces that overwhelm users with visual noise (anti-reference from PRODUCT.md)
- **Don't** use decorative fonts that sacrifice readability
- **Don't** use excessive shadows or gradients that distract from content
- **Don't** use color as the only means of conveying information
- **Don't** use animations that are bouncy, elastic, or distracting (use only exponential ease-out curves)