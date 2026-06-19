import type { EventHandler } from '@create-figma-plugin/utilities'
import type { Color } from 'culori'

// Color model used for editing key-color channel inputs
export type InputColorModel = 'hsl' | 'hsv' | 'lch'
// Color model the shade gradient is blended/interpolated in. Also defines the
// lightness metric used to auto-position stops on the tone axis (ADR-022):
// rgb/hsl → HSL L, oklch → OKLab L, lch → CIE L*.
export type BlendingColorModel = 'rgb' | 'hsl' | 'oklch' | 'lch'
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
  // `true` (default) = `position` is auto-derived from the color's OKLch
  // lightness (`keyStopPosition`) and follows the color on every edit; `false` =
  // pinned by the user (drag). Toggled per stop in the gradient editor (ADR-022).
  autoPosition: boolean
  // Derived editing buffer for THIS stop: raw input strings in the CURRENT
  // inputColorModel. Runtime-only (not persisted) — re-derived on load / model
  // switch. Lets the color picker edit any stop, not just the key one.
  channels: ColorChannels
}

// A named color "ramp": a shade gradient whose `keyStopId` stop is the seed the
// user picks/names ("the key color"). Shades are sampled from `stops`. By default
// the gradient is black & white endpoints with the key color between them at its
// lightness; the gradient editor (ADR-022) lets the user move/add/recolor stops.
export interface PaletteColor {
  id: string
  // User-typed name (`''` when never set). Always stored, even while auto, so a
  // typed name survives toggling auto off→on→off (mirrors a stop's pinned
  // `position` surviving `autoPosition`). (ADR-020)
  customName: string
  // `true` (default) = name is auto-derived from the key stop's color (nearest
  // named color via color/naming.ts) and follows it on every edit; `false` =
  // the user's `customName` is used. Effective name = `resolveName(pc)`.
  autoName: boolean
  // Sorted by position; endpoints at 0 and 1. Each stop carries its own derived
  // `channels` buffer (see GradientStop).
  stops: GradientStop[]
  // Which stop is the key color (the named seed). Always references a `stops` id.
  keyStopId: string
}

// Palette-scoped settings: they change the generated colors / export, so they
// travel with the palette and stay under undo (ADR-027). `inputColorModel` used
// to live here but is now a user-global pref (see `UserPrefs`) — a pure display
// concern that must not be palette data or undo history.
export interface Settings {
  blendingColorModel: BlendingColorModel
  toneAxisDirection: ToneAxisDirection
  // Name of the Figma variable collection that "Create variables" writes into.
  collectionName: string
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
//   - pre-`customName` files carry a plain `name`,
//   - pre-`autoName` files: auto-named iff no custom/legacy name was set.
export interface PersistedGradientStop {
  id: string
  position: number
  color: Color
  // Omitted by pre-editor files; defaults to `true` (auto) on load.
  autoPosition?: boolean
}

export interface PersistedPaletteColor {
  id: string
  customName?: string | null
  // Omitted by pre-`autoName` files; derived from whether a name was set on load.
  autoName?: boolean
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

// --- Palette identity + library (ADR-026) ----------------------------------
// The editor always edits exactly one *active* palette, which is either the
// single document palette (sharedPluginData, shared with the file) or one user
// palette (clientStorage, private, available in every file).

export type PaletteKind = 'document' | 'user'

// A user-library palette: identity meta + a persisted body. The body mirrors
// `PersistedDocument` (so it can be fed to the store's `hydrate`); `channels`
// and auto names are re-derived on load exactly like the document palette.
export interface Palette {
  id: string
  name: string
  updatedAt: number
  keyColors: PersistedPaletteColor[]
  settings: Settings
  shades?: ShadeScale
}

// Pointer to whichever palette is active, remembered per file. For the document
// palette `id` is `figma.root.id` (also the `activeByDocument` key).
export interface ActivePaletteRef {
  kind: PaletteKind
  id: string
}

// User-scoped preferences: global (every file), not per palette, not undoable.
export interface UserPrefs {
  inputColorModel: InputColorModel
}

// The whole per-user library, persisted as one `clientStorage` entry.
export interface UserLibrary {
  // Schema version; hydration is gated on it for future migrations. Start at 1.
  version: number
  palettes: Palette[]
  prefs: UserPrefs
  // Active-palette pointer per file, keyed by `figma.root.id`.
  activeByDocument: Record<string, ActivePaletteRef>
}

// UI -> main: persist the document to the file's shared plugin data.
export interface SaveDocumentHandler extends EventHandler {
  name: 'SAVE_DOCUMENT'
  handler: (document: PersistedDocument) => void
}

// UI -> main: fetch the user library from clientStorage (sent once on UI mount;
// clientStorage is async so it can't ride the synchronous showUI props).
export interface RequestUserLibraryHandler extends EventHandler {
  name: 'REQUEST_USER_LIBRARY'
  handler: () => void
}

// main -> UI: the loaded (or freshly-initialized) user library.
export interface UserLibraryHandler extends EventHandler {
  name: 'USER_LIBRARY'
  handler: (data: { library: UserLibrary }) => void
}

// UI -> main: debounced upsert of one user palette into clientStorage.
export interface SaveUserPaletteHandler extends EventHandler {
  name: 'SAVE_USER_PALETTE'
  handler: (data: { palette: Palette }) => void
}

// main -> UI: result of persisting one user palette. `ok: false` (e.g. the
// library hit its size cap) lets the UI roll back a palette that was added
// optimistically but never actually reached clientStorage, instead of leaving a
// ghost that disappears on the next reload.
export interface SaveUserPaletteResultHandler extends EventHandler {
  name: 'SAVE_USER_PALETTE_RESULT'
  handler: (data: { id: string; ok: boolean }) => void
}

// UI -> main: remove one user palette from clientStorage.
export interface DeleteUserPaletteHandler extends EventHandler {
  name: 'DELETE_USER_PALETTE'
  handler: (data: { id: string }) => void
}

// UI -> main: persist the user-global prefs.
export interface SaveUserPrefsHandler extends EventHandler {
  name: 'SAVE_USER_PREFS'
  handler: (data: { prefs: UserPrefs }) => void
}

// UI -> main: persist the per-document active-palette pointer.
export interface SetActivePaletteHandler extends EventHandler {
  name: 'SET_ACTIVE_PALETTE'
  handler: (data: { documentId: string; ref: ActivePaletteRef }) => void
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

// --- Export ----------------------------------------------------------------
// The UI computes the resolved palette (names + per-step colors, via the same
// samplers the swatch grid uses) and hands it to the main thread, which is the
// only place `figma.*` (canvas nodes, variables, styles) exists.

// One resolved shade: its tone-axis step value (0..1000) and display hex.
export interface ExportShade {
  step: number
  hex: string
}

// One key color's resolved ramp: effective name + every shade.
export interface ExportColor {
  name: string
  shades: ExportShade[]
}

// The whole palette, ready to materialize on the Figma side.
export interface ExportPalette {
  // Target variable collection name (used by CREATE_VARIABLES; also names the
  // swatch container frame).
  collectionName: string
  colors: ExportColor[]
}

// UI -> main: drop the palette on the canvas as a grid of named rectangles.
export interface ExportSwatchesHandler extends EventHandler {
  name: 'EXPORT_SWATCHES'
  handler: (palette: ExportPalette) => void
}

// UI -> main: write the palette into the file's variables (collection from
// settings; variables named `{name}/{step}`).
export interface CreateVariablesHandler extends EventHandler {
  name: 'CREATE_VARIABLES'
  handler: (palette: ExportPalette) => void
}

// UI -> main: write the palette into the file's paint styles (named
// `{name}/{step}`, no collection).
export interface CreateStylesHandler extends EventHandler {
  name: 'CREATE_STYLES'
  handler: (palette: ExportPalette) => void
}
