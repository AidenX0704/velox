import {
  themeColorPresets,
  type AppearanceMode,
  type EditorPreferences,
  type ThemeColorPresetId
} from '../../../../shared/preferences'

export type ResolvedAppearanceMode = 'light' | 'dark'

const fallbackAccentColor = '#4f46e5'
const hexColorPattern = /^#[0-9a-fA-F]{6}$/

export function getSystemAppearanceMode(): ResolvedAppearanceMode {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveAppearanceMode(mode: AppearanceMode): ResolvedAppearanceMode {
  return mode === 'system' ? getSystemAppearanceMode() : mode
}

export function resolveThemeAccent(settings: EditorPreferences): string {
  if (settings.themeColorPreset === 'custom') {
    return normalizeHexColor(settings.customThemeColor) ?? fallbackAccentColor
  }

  return getThemePresetColor(settings.themeColorPreset)
}

export function normalizeHexColor(color: string): string | null {
  const trimmed = color.trim()

  if (!hexColorPattern.test(trimmed)) {
    return null
  }

  return trimmed.toLowerCase()
}

export function applyThemeToDocument(options: {
  accentColor: string
  appearanceMode: AppearanceMode
  resolvedMode: ResolvedAppearanceMode
}): void {
  const accentColor = normalizeHexColor(options.accentColor) ?? fallbackAccentColor
  const accentRgb = hexToRgb(accentColor)
  const root = document.documentElement
  const body = document.body

  root.dataset.colorMode = options.resolvedMode
  root.dataset.appearanceMode = options.appearanceMode
  root.style.colorScheme = options.resolvedMode

  body.dataset.colorMode = options.resolvedMode
  body.dataset.appearanceMode = options.appearanceMode

  if (options.resolvedMode === 'dark') {
    body.setAttribute('theme-mode', 'dark')
  } else {
    body.removeAttribute('theme-mode')
  }

  for (const element of [root, body]) {
    element.style.setProperty('--theme-accent', accentColor)
    element.style.setProperty('--theme-accent-rgb', accentRgb)
    element.style.setProperty('--theme-accent-strong', mixHex(accentColor, '#000000', 0.18))
    element.style.setProperty('--theme-accent-hover', mixHex(accentColor, '#000000', 0.08))
    element.style.setProperty('--theme-accent-active', mixHex(accentColor, '#000000', 0.18))
    element.style.setProperty('--theme-accent-soft', `rgba(${accentRgb}, 0.12)`)
    element.style.setProperty('--theme-accent-softer', `rgba(${accentRgb}, 0.07)`)
    element.style.setProperty('--semi-color-primary', accentColor)
    element.style.setProperty('--semi-color-primary-hover', mixHex(accentColor, '#000000', 0.08))
    element.style.setProperty('--semi-color-primary-active', mixHex(accentColor, '#000000', 0.18))
    element.style.setProperty('--semi-color-primary-light-default', `rgba(${accentRgb}, 0.12)`)
    element.style.setProperty('--semi-color-primary-light-hover', `rgba(${accentRgb}, 0.18)`)
    element.style.setProperty('--semi-color-primary-light-active', `rgba(${accentRgb}, 0.24)`)
  }
}

export function subscribeToSystemAppearance(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', callback)

  return () => {
    mediaQuery.removeEventListener('change', callback)
  }
}

function getThemePresetColor(id: ThemeColorPresetId): string {
  return themeColorPresets.find((preset) => preset.id === id)?.color ?? fallbackAccentColor
}

function hexToRgb(color: string): string {
  const value = color.slice(1)
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)

  return `${red}, ${green}, ${blue}`
}

function mixHex(color: string, mixColor: string, amount: number): string {
  const source = parseHex(color)
  const target = parseHex(mixColor)
  const mixed = source.map((channel, index) =>
    Math.round(channel * (1 - amount) + target[index] * amount)
  )

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(color: string): [number, number, number] {
  const value = color.slice(1)

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ]
}
