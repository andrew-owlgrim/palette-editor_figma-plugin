// Color model used for editing key-color channel inputs
export type InputColorModel = 'hsl' | 'hsv' | 'lch'
// Color model used later for blending/interpolation (stored only for now)
export type BlendingColorModel = 'rgb' | 'hsl' | 'oklch'

// Raw input-field values keyed by channel id, interpreted in the CURRENT
// inputColorModel. e.g. hsl -> { h: '210', s: '50', l: '50' }
export type ColorChannels = Record<string, string>

export interface KeyColor {
  id: string
  name: string
  channels: ColorChannels
}

export interface Settings {
  inputColorModel: InputColorModel
  blendingColorModel: BlendingColorModel
}

// Serializable document — the shape that will later be persisted to
// clientStorage (per-user) and root.sharedPluginData (per-file).
export interface PaletteDocument {
  keyColors: KeyColor[]
  settings: Settings
}
