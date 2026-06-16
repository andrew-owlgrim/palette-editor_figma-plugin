import type { EventHandler } from '@create-figma-plugin/utilities'
import type { Color } from 'culori'

// Color model used for editing key-color channel inputs
export type InputColorModel = 'hsl' | 'hsv' | 'lch'
// Color model used later for blending/interpolation (stored only for now)
export type BlendingColorModel = 'rgb' | 'hsl' | 'oklch'

// Raw input-field values keyed by channel id, interpreted in the CURRENT
// inputColorModel. e.g. hsl -> { h: '210', s: '50', l: '50' }
export type ColorChannels = Record<string, string>

export interface KeyColor {
  id: string
  // User-set name, or `null` for auto-naming (nearest named color, derived from
  // `color` via color/naming.ts). Effective name = `resolveName(keyColor)`.
  customName: string | null
  // Source of truth: a canonical culori color in float `rgb` mode (unclamped, so
  // wide-gamut colors survive as extended sRGB). hex shown in the UI and the
  // `channels` below are both derived from this. Tints/conversions read `color`.
  color: Color
  // Derived editable buffer: raw input strings in the CURRENT inputColorModel.
  // Kept in state (not on disk) so inputs stay controlled and tolerate mid-edit.
  channels: ColorChannels
}

export interface Settings {
  inputColorModel: InputColorModel
  blendingColorModel: BlendingColorModel
}

// Runtime document held by the store. `channels` is a derived buffer.
export interface PaletteDocument {
  keyColors: KeyColor[]
  settings: Settings
}

// Persisted form (root.sharedPluginData). Only the canonical `color` is stored;
// `channels` are re-derived on load. Fields are loose to tolerate older files
// that predate `color` (they carry `channels` instead) — see hydrate migration.
export interface PersistedKeyColor {
  id: string
  customName?: string | null
  // Legacy: older files stored a plain `name`; migrated to `customName` on load.
  name?: string
  color?: Color
  channels?: ColorChannels
}

export interface PersistedDocument {
  keyColors: PersistedKeyColor[]
  settings: Settings
}

// UI -> main: persist the document to the file's shared plugin data.
export interface SaveDocumentHandler extends EventHandler {
  name: 'SAVE_DOCUMENT'
  handler: (document: PersistedDocument) => void
}
