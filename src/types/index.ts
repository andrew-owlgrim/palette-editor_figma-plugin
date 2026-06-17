import type { EventHandler } from '@create-figma-plugin/utilities'
import type { Color } from 'culori'

// Color model used for editing key-color channel inputs
export type InputColorModel = 'hsl' | 'hsv' | 'lch'
// Color model the shade gradient is blended/interpolated in
export type BlendingColorModel = 'rgb' | 'hsl' | 'oklch'
// Which end of the shade scale (step 0) is light vs dark. 'light-dark' = step 0
// is light, the scale darkens as the step value grows (the tailwind convention).
export type ToneAxisDirection = 'light-dark' | 'dark-light'

// Raw input-field values keyed by channel id, interpreted in the CURRENT
// inputColorModel. e.g. hsl -> { h: '210', s: '50', l: '50' }
export type ColorChannels = Record<string, string>

// One key point of a palette color's shade gradient.
export interface GradientStop {
  id: string
  // Position along the tone axis, 0..1 (0 and 1 are the scale ends).
  position: number
  // Canonical culori color in float `rgb` mode, left UNCLAMPED so wide-gamut
  // colors survive as extended sRGB (ADR-013).
  color: Color
}

// A named color "ramp": a shade gradient whose `keyStopId` stop is the seed the
// user picks/names ("the key color"). Shades are sampled from `stops`. By default
// the gradient is black & white endpoints with the key color between them at its
// lightness; a future editor will let the user move/add/recolor stops.
export interface PaletteColor {
  id: string
  // User-set name, or `null` for auto-naming from the key stop's color (nearest
  // named color via color/naming.ts). Effective name = `resolveName(pc)`.
  customName: string | null
  // Sorted by position; endpoints at 0 and 1.
  stops: GradientStop[]
  // Which stop is the key color (the named seed). Always references a `stops` id.
  keyStopId: string
  // Derived editing buffer for the KEY stop: raw input strings in the CURRENT
  // inputColorModel. Runtime-only (not persisted) — re-derived on load.
  channels: ColorChannels
}

export interface Settings {
  inputColorModel: InputColorModel
  blendingColorModel: BlendingColorModel
  toneAxisDirection: ToneAxisDirection
}

// The shade scale: one entry per shade step, a target value on the 0..1000 tone
// axis (tailwind 1/1000 format) or `null` = auto (evenly distributed between the
// set anchors / the 0 & 1000 edges). The step count is `steps.length`.
export interface ShadeScale {
  steps: Array<number | null>
}

// Runtime document held by the store. `channels` is a derived buffer.
export interface PaletteDocument {
  keyColors: PaletteColor[]
  settings: Settings
  shades: ShadeScale
}

// Persisted form (root.sharedPluginData). The gradient `stops` + `keyStopId` are
// the source of truth; `channels` and auto names are re-derived on load. Fields
// are loose to tolerate older files — see the hydrate migration:
//   - pre-gradient files carry a single `color` (or even older `channels`),
//   - pre-`customName` files carry a plain `name`.
export interface PersistedGradientStop {
  id: string
  position: number
  color: Color
}

export interface PersistedPaletteColor {
  id: string
  customName?: string | null
  name?: string
  keyStopId?: string
  stops?: PersistedGradientStop[]
  // Legacy single-color form (migrated to a default gradient on load):
  color?: Color
  channels?: ColorChannels
}

export interface PersistedDocument {
  keyColors: PersistedPaletteColor[]
  settings: Settings
  shades?: ShadeScale
}

// UI -> main: persist the document to the file's shared plugin data.
export interface SaveDocumentHandler extends EventHandler {
  name: 'SAVE_DOCUMENT'
  handler: (document: PersistedDocument) => void
}

// main -> UI: deduped solid fills (hex) of the directly-selected nodes.
export interface SelectionFillsHandler extends EventHandler {
  name: 'SELECTION_FILLS'
  handler: (data: { fills: string[] }) => void
}

// UI -> main: ask for the current selection fills (sent once on UI mount, since
// the first push could otherwise race the UI's listener registration).
export interface RequestSelectionFillsHandler extends EventHandler {
  name: 'REQUEST_SELECTION_FILLS'
  handler: () => void
}
