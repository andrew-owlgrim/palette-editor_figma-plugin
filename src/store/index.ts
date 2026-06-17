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
import { harmoniousColor } from '@/color/harmony'
import {
  buildDefaultStops,
  keyColorOf,
  mirrorStops,
  setKeyColor,
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
): PaletteColor {
  const { stops, keyStopId } = buildDefaultStops(color, direction)
  return {
    id: newId(),
    customName: null,
    stops,
    keyStopId,
    channels: colorToChannels(color, model),
  }
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
): PaletteColor {
  const customName = k.customName !== undefined ? k.customName : (k.name ?? null)

  if (k.stops !== undefined && k.stops.length > 0 && k.keyStopId !== undefined) {
    const stops = sortStops(
      k.stops.map((s) => ({ id: s.id, position: s.position, color: s.color })),
    )
    const keyStopId = stops.some((s) => s.id === k.keyStopId) ? k.keyStopId : stops[0].id
    const keyColor = stops.find((s) => s.id === keyStopId)?.color ?? stops[0].color
    return { id: k.id, customName, stops, keyStopId, channels: colorToChannels(keyColor, model) }
  }

  const color = k.color ?? channelsToColor(k.channels ?? {}, model)
  const { stops, keyStopId } = buildDefaultStops(color, direction)
  return { id: k.id, customName, stops, keyStopId, channels: colorToChannels(color, model) }
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
  // null = revert to auto-naming; a string = pin a custom name.
  setKeyColorName: (id: string, name: string | null) => void
  setKeyColorChannel: (id: string, channelId: string, value: string) => void
  setKeyColorChannels: (id: string, channels: ColorChannels) => void
  setKeyColorFromHex: (id: string, hex: string) => void
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
            normalizePaletteColor(k, settings.inputColorModel, settings.toneAxisDirection),
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
          const { stops, keyStopId } = buildDefaultStops(color, state.settings.toneAxisDirection)
          return {
            keyColors: state.keyColors.map((k) =>
              k.id === id
                ? {
                    ...k,
                    stops,
                    keyStopId,
                    customName: null,
                    channels: colorToChannels(color, state.settings.inputColorModel),
                  }
                : k,
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

      setKeyColorName: (id, name) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => (k.id === id ? { ...k, customName: name } : k)),
        })),

      // A channel edit updates the typed buffer and recomputes the key stop's
      // color (+ its lightness-driven position) from the full channel set. We
      // keep the user's raw strings (don't re-derive channels here) so mid-edit
      // input stays untouched.
      setKeyColorChannel: (id, channelId, value) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => {
            if (k.id !== id) return k
            const channels = { ...k.channels, [channelId]: value }
            const color = channelsToColor(channels, state.settings.inputColorModel)
            return {
              ...k,
              channels,
              stops: setKeyColor(k, color, state.settings.toneAxisDirection),
            }
          }),
        })),

      // Patch several channels of one key color in a single update — used by
      // the color picker's wheel drag (hue + saturation move together), so it
      // lands as one undo step / one save.
      setKeyColorChannels: (id, patch) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => {
            if (k.id !== id) return k
            const channels = { ...k.channels, ...patch }
            const color = channelsToColor(channels, state.settings.inputColorModel)
            return {
              ...k,
              channels,
              stops: setKeyColor(k, color, state.settings.toneAxisDirection),
            }
          }),
        })),

      // A hex edit sets the key stop's color, then re-derives the channel buffer.
      setKeyColorFromHex: (id, hex) =>
        set((state) => {
          const color = hexToColor(hex)
          return {
            keyColors: state.keyColors.map((k) =>
              k.id === id
                ? {
                    ...k,
                    stops: setKeyColor(k, color, state.settings.toneAxisDirection),
                    channels: colorToChannels(color, state.settings.inputColorModel),
                  }
                : k,
            ),
          }
        }),

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
              channels: colorToChannels(keyColorOf(k), model),
            })),
          }
        }),

      setBlendingColorModel: (model) =>
        set((state) => ({ settings: { ...state.settings, blendingColorModel: model } })),

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
