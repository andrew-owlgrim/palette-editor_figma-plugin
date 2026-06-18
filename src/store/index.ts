import { create, useStore } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import { arrayMove } from '@dnd-kit/sortable'
import type { Color } from 'culori'
import type {
  BlendingColorModel,
  ColorChannels,
  InputColorModel,
  PaletteColor,
  PaletteDocument,
  PersistedDocument,
  PersistedPaletteColor,
  Settings,
  ToneAxisDirection,
} from '@/types'
import { channelsToColor, colorToChannels, hexToColor } from '@/color/models'
import { autoName } from '@/color/naming'
import { harmoniousColor } from '@/color/harmony'
import {
  addStop as addStopToGradient,
  buildDefaultStops,
  canDeleteStop,
  keyColorOf,
  mirrorStops,
  rederiveChannels,
  removeStop as removeStopFromGradient,
  repositionAutoStops,
  setStopAutoPosition as setStopAutoPositionInGradient,
  setStopColor,
  setStopPosition as setStopPositionInGradient,
  sortStops,
} from '@/color/gradient'
import {
  clampStepValue,
  DEFAULT_SHADE_COUNT,
  MAX_SHADE_COUNT,
  MIN_SHADE_COUNT,
} from '@/color/shades'

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `kc_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

const DEFAULT_SETTINGS: Settings = {
  inputColorModel: 'hsl',
  blendingColorModel: 'oklch',
  toneAxisDirection: 'light-dark',
}

function defaultSteps(): Array<number | null> {
  return new Array<number | null>(DEFAULT_SHADE_COUNT).fill(null)
}

// Build a fresh palette color (key color + its default gradient) from a color.
function makePaletteColor(
  color: Color,
  model: InputColorModel,
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
): PaletteColor {
  const { stops, keyStopId } = buildDefaultStops(color, direction, blending, model)
  return { id: newId(), customName: '', autoName: true, stops, keyStopId }
}

// Build a runtime palette color from a persisted one. The gradient `stops` +
// `keyStopId` are the source of truth; `channels` are re-derived from the key
// stop's color. Older files are migrated: pre-gradient files carry a single
// `color` (or even-older `channels`) -> build a default gradient; pre-`customName`
// files carry a plain `name`.
function normalizePaletteColor(
  k: PersistedPaletteColor,
  model: InputColorModel,
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
): PaletteColor {
  // Custom name: prefer `customName`, fall back to the legacy `name`; coerce a
  // legacy `null` to ''. Auto iff explicitly flagged, else iff no name was set.
  const rawName = k.customName !== undefined ? k.customName : (k.name ?? null)
  const customName = typeof rawName === 'string' ? rawName : ''
  const autoName = k.autoName ?? customName.trim() === ''

  if (k.stops !== undefined && k.stops.length > 0 && k.keyStopId !== undefined) {
    // Derive each stop's channel buffer; default missing `autoPosition` to true
    // (pre-editor files only carried auto-following endpoints + key stop).
    const stops = rederiveChannels(
      sortStops(
        k.stops.map((s) => ({
          id: s.id,
          position: s.position,
          color: s.color,
          autoPosition: s.autoPosition ?? true,
          channels: {},
        })),
      ),
      model,
    )
    const keyStopId = stops.some((s) => s.id === k.keyStopId) ? k.keyStopId : stops[0].id
    return { id: k.id, customName, autoName, stops, keyStopId }
  }

  const color = k.color ?? channelsToColor(k.channels ?? {}, model)
  const { stops, keyStopId } = buildDefaultStops(color, direction, blending, model)
  return { id: k.id, customName, autoName, stops, keyStopId }
}

interface PaletteActions {
  hydrate: (document: PersistedDocument) => void
  addKeyColor: () => void
  addKeyColors: (hexes: string[]) => void
  // Replace one key color with a fresh random-but-harmonious one (auto-named).
  rerollKeyColor: (id: string) => void
  removeKeyColor: (id: string) => void
  // Reorder: move the key color `fromId` to the slot currently held by `toId`
  // (the DnD over-target). One update = one undo step / one save.
  moveKeyColor: (fromId: string, toId: string) => void
  // Pin a custom name (switches to manual); an empty string reverts to auto.
  setKeyColorName: (id: string, name: string) => void
  // Toggle auto-naming (the "A" button). On→off seeds the custom name from the
  // current auto name if none was typed, so the field starts populated.
  setKeyColorNameAuto: (id: string, auto: boolean) => void
  // Color edits target a specific stop (the key stop or any gradient stop).
  setStopChannel: (pcId: string, stopId: string, channelId: string, value: string) => void
  setStopChannels: (pcId: string, stopId: string, channels: ColorChannels) => void
  setStopFromHex: (pcId: string, stopId: string, hex: string) => void
  // Gradient-stop structure edits (gradient editor). `addStop` returns the new
  // stop's id (or null if the palette color wasn't found) so the caller can keep
  // dragging it.
  addStop: (pcId: string, position: number) => string | null
  removeStop: (pcId: string, stopId: string) => void
  setStopPosition: (pcId: string, stopId: string, position: number) => void
  setStopAutoPosition: (pcId: string, stopId: string, auto: boolean) => void
  setInputColorModel: (model: InputColorModel) => void
  setBlendingColorModel: (model: BlendingColorModel) => void
  // Flip which end of the scale is light; mirrors every gradient's stops.
  setToneAxisDirection: (direction: ToneAxisDirection) => void
  // Resize the shade scale (clamped to [MIN, MAX]); grows/trims from the end.
  setShadeCount: (count: number) => void
  // Pin a step's value (clamped between set neighbors), or null = auto.
  setShadeStep: (index: number, value: number | null) => void
}

type PaletteStore = PaletteDocument & PaletteActions

const initialDocument: PaletteDocument = {
  keyColors: [],
  settings: DEFAULT_SETTINGS,
  shades: { steps: defaultSteps() },
}

export const usePaletteStore = create<PaletteStore>()(
  temporal(
    (set) => ({
      ...initialDocument,

      hydrate: (document) => {
        // Tolerate older files missing newer settings (e.g. toneAxisDirection).
        const settings = { ...DEFAULT_SETTINGS, ...document.settings }
        set({
          keyColors: document.keyColors.map((k) =>
            normalizePaletteColor(
              k,
              settings.inputColorModel,
              settings.toneAxisDirection,
              settings.blendingColorModel,
            ),
          ),
          settings,
          shades: document.shades ?? { steps: defaultSteps() },
        })
      },

      addKeyColor: () =>
        set((state) => {
          // Pick a color that fits the existing row (random for an empty one).
          const color = harmoniousColor(state.keyColors.map((k) => keyColorOf(k)))
          return {
            keyColors: [
              ...state.keyColors,
              makePaletteColor(
                color,
                state.settings.inputColorModel,
                state.settings.toneAxisDirection,
                state.settings.blendingColorModel,
              ),
            ],
          }
        }),

      // Append one key color per hex in a single update (one undo step / one
      // save) — used by "add matching" from the canvas selection.
      addKeyColors: (hexes) =>
        set((state) => ({
          keyColors: [
            ...state.keyColors,
            ...hexes.map((hex) =>
              makePaletteColor(
                hexToColor(hex),
                state.settings.inputColorModel,
                state.settings.toneAxisDirection,
                state.settings.blendingColorModel,
              ),
            ),
          ],
        })),

      // Reroll: a fresh color harmonious with the *other* key colors (self
      // excluded so it can move into a gap). Rebuilds the default gradient and
      // reverts to auto-naming so the name follows the new color.
      rerollKeyColor: (id) =>
        set((state) => {
          const others = state.keyColors.filter((k) => k.id !== id).map((k) => keyColorOf(k))
          const color = harmoniousColor(others)
          const { stops, keyStopId } = buildDefaultStops(
            color,
            state.settings.toneAxisDirection,
            state.settings.blendingColorModel,
            state.settings.inputColorModel,
          )
          return {
            keyColors: state.keyColors.map((k) =>
              k.id === id ? { ...k, stops, keyStopId, customName: '', autoName: true } : k,
            ),
          }
        }),

      removeKeyColor: (id) =>
        set((state) => ({ keyColors: state.keyColors.filter((k) => k.id !== id) })),

      moveKeyColor: (fromId, toId) =>
        set((state) => {
          const from = state.keyColors.findIndex((k) => k.id === fromId)
          const to = state.keyColors.findIndex((k) => k.id === toId)
          if (from === -1 || to === -1 || from === to) return {}
          return { keyColors: arrayMove(state.keyColors, from, to) }
        }),

      // A manual edit pins the typed name; clearing it (empty) reverts to auto.
      setKeyColorName: (id, name) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) =>
            k.id === id ? { ...k, customName: name, autoName: name.trim() === '' } : k,
          ),
        })),

      setKeyColorNameAuto: (id, auto) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => {
            if (k.id !== id) return k
            // Going manual: seed from the current auto name when nothing's typed,
            // so the field opens populated (mirrors freezing a stop's position).
            const customName =
              auto || k.customName.trim() !== '' ? k.customName : autoName(keyColorOf(k))
            return { ...k, autoName: auto, customName }
          }),
        })),

      // A channel edit updates the targeted stop's typed buffer and recomputes
      // its color (+ its lightness-driven position when auto) from the full
      // channel set. We keep the user's raw strings (don't re-derive channels
      // here) so mid-edit input stays untouched.
      setStopChannel: (pcId, stopId, channelId, value) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => {
            if (k.id !== pcId) return k
            const stop = k.stops.find((s) => s.id === stopId)
            if (stop === undefined) return k
            const channels = { ...stop.channels, [channelId]: value }
            const color = channelsToColor(channels, state.settings.inputColorModel)
            return {
              ...k,
              stops: setStopColor(
                k,
                stopId,
                color,
                channels,
                state.settings.toneAxisDirection,
                state.settings.blendingColorModel,
              ),
            }
          }),
        })),

      // Patch several channels of one stop in a single update — used by the color
      // picker's wheel drag (hue + saturation move together), so it lands as one
      // undo step / one save.
      setStopChannels: (pcId, stopId, patch) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => {
            if (k.id !== pcId) return k
            const stop = k.stops.find((s) => s.id === stopId)
            if (stop === undefined) return k
            const channels = { ...stop.channels, ...patch }
            const color = channelsToColor(channels, state.settings.inputColorModel)
            return {
              ...k,
              stops: setStopColor(
                k,
                stopId,
                color,
                channels,
                state.settings.toneAxisDirection,
                state.settings.blendingColorModel,
              ),
            }
          }),
        })),

      // A hex edit sets the stop's color, then re-derives its channel buffer.
      setStopFromHex: (pcId, stopId, hex) =>
        set((state) => {
          const color = hexToColor(hex)
          const channels = colorToChannels(color, state.settings.inputColorModel)
          return {
            keyColors: state.keyColors.map((k) =>
              k.id === pcId
                ? {
                    ...k,
                    stops: setStopColor(
                      k,
                      stopId,
                      color,
                      channels,
                      state.settings.toneAxisDirection,
                      state.settings.blendingColorModel,
                    ),
                  }
                : k,
            ),
          }
        }),

      // Add a stop at `position` (0..1), color sampled from the gradient there.
      // Returns the new stop's id so a drag can continue moving it.
      addStop: (pcId, position) => {
        let newStopId: string | null = null
        set((state) => ({
          keyColors: state.keyColors.map((k) => {
            if (k.id !== pcId) return k
            const { stops, stopId } = addStopToGradient(
              k,
              position,
              state.settings.blendingColorModel,
              state.settings.inputColorModel,
            )
            newStopId = stopId
            return { ...k, stops }
          }),
        }))
        return newStopId
      },

      // Remove a stop (no-op on endpoints / the key stop — guarded here too).
      removeStop: (pcId, stopId) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) =>
            k.id === pcId && canDeleteStop(k, stopId)
              ? { ...k, stops: removeStopFromGradient(k, stopId) }
              : k,
          ),
        })),

      // Pin a stop's position (a drag) — switches it to manual.
      setStopPosition: (pcId, stopId, position) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) =>
            k.id === pcId ? { ...k, stops: setStopPositionInGradient(k, stopId, position) } : k,
          ),
        })),

      // Toggle a stop's auto-position (the "A" button).
      setStopAutoPosition: (pcId, stopId, auto) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) =>
            k.id === pcId
              ? {
                  ...k,
                  stops: setStopAutoPositionInGradient(
                    k,
                    stopId,
                    auto,
                    state.settings.toneAxisDirection,
                    state.settings.blendingColorModel,
                  ),
                }
              : k,
          ),
        })),

      // Switching the input model leaves the canonical colors untouched and only
      // re-derives each key stop's channel buffer into the new model — so a
      // switch is fully reversible (no lossy channel->channel round-trip).
      setInputColorModel: (model) =>
        set((state) => {
          if (state.settings.inputColorModel === model) return {}
          return {
            settings: { ...state.settings, inputColorModel: model },
            keyColors: state.keyColors.map((k) => ({
              ...k,
              stops: rederiveChannels(k.stops, model),
            })),
          }
        }),

      // The blending model also defines the lightness metric for auto positions,
      // so switching it re-positions every auto stop (manual stops stay put).
      setBlendingColorModel: (model) =>
        set((state) => {
          if (state.settings.blendingColorModel === model) return {}
          return {
            settings: { ...state.settings, blendingColorModel: model },
            keyColors: state.keyColors.map((k) => ({
              ...k,
              stops: repositionAutoStops(k.stops, state.settings.toneAxisDirection, model),
            })),
          }
        }),

      // Flipping the tone direction mirrors every gradient (position -> 1 - pos),
      // so the scale reverses while the colors and the key stop stay the same.
      setToneAxisDirection: (direction) =>
        set((state) => {
          if (state.settings.toneAxisDirection === direction) return {}
          return {
            settings: { ...state.settings, toneAxisDirection: direction },
            keyColors: state.keyColors.map((k) => ({ ...k, stops: mirrorStops(k.stops) })),
          }
        }),

      setShadeCount: (count) =>
        set((state) => {
          const n = Math.min(MAX_SHADE_COUNT, Math.max(MIN_SHADE_COUNT, Math.round(count)))
          const cur = state.shades.steps
          if (n === cur.length) return {}
          const steps =
            n < cur.length
              ? cur.slice(0, n)
              : [...cur, ...new Array<number | null>(n - cur.length).fill(null)]
          return { shades: { steps } }
        }),

      setShadeStep: (index, value) =>
        set((state) => {
          const steps = state.shades.steps.slice()
          if (index < 0 || index >= steps.length) return {}
          steps[index] = value === null ? null : clampStepValue(steps, index, value)
          return { shades: { steps } }
        }),
    }),
    {
      limit: 100,
      // Track only the document, not the (stable) action functions.
      partialize: (state): PaletteDocument => ({
        keyColors: state.keyColors,
        settings: state.settings,
        shades: state.shades,
      }),
      // Skip pushing identical snapshots onto the history stack.
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    },
  ),
)

export function useTemporalStore<T>(selector: (state: TemporalState<PaletteDocument>) => T): T {
  return useStore(usePaletteStore.temporal, selector)
}
