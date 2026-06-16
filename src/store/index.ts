import { create, useStore } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import type {
  BlendingColorModel,
  ColorChannels,
  InputColorModel,
  KeyColor,
  PaletteDocument,
  PersistedDocument,
  PersistedKeyColor,
} from '@/types'
import { channelsToColor, colorToChannels, hexToColor } from '@/color/models'

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `kc_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

// Build a runtime key color from a persisted one. `color` (the source of truth)
// is taken as-is; older files that predate it carry `channels` instead, so we
// reconstruct `color` from them (migration). `channels` are always re-derived
// from `color` so the in-memory buffer is consistent with the canonical value.
function normalizeKeyColor(k: PersistedKeyColor, model: InputColorModel): KeyColor {
  const color = k.color ?? channelsToColor(k.channels ?? {}, model)
  // `customName` if present; otherwise migrate a legacy `name` as a custom name
  // (preserve what the user had); else auto (null).
  const customName = k.customName !== undefined ? k.customName : (k.name ?? null)
  return { id: k.id, customName, color, channels: colorToChannels(color, model) }
}

interface PaletteActions {
  hydrate: (document: PersistedDocument) => void
  addKeyColor: () => void
  addKeyColors: (hexes: string[]) => void
  removeKeyColor: (id: string) => void
  // null = revert to auto-naming; a string = pin a custom name.
  setKeyColorName: (id: string, name: string | null) => void
  setKeyColorChannel: (id: string, channelId: string, value: string) => void
  setKeyColorChannels: (id: string, channels: ColorChannels) => void
  setKeyColorFromHex: (id: string, hex: string) => void
  setInputColorModel: (model: InputColorModel) => void
  setBlendingColorModel: (model: BlendingColorModel) => void
}

type PaletteStore = PaletteDocument & PaletteActions

const initialDocument: PaletteDocument = {
  keyColors: [],
  settings: { inputColorModel: 'hsl', blendingColorModel: 'oklch' },
}

export const usePaletteStore = create<PaletteStore>()(
  temporal(
    (set) => ({
      ...initialDocument,

      hydrate: (document) =>
        set({
          keyColors: document.keyColors.map((k) =>
            normalizeKeyColor(k, document.settings.inputColorModel),
          ),
          settings: document.settings,
        }),

      addKeyColor: () =>
        set((state) => {
          const color = hexToColor('#ffffff')
          return {
            keyColors: [
              ...state.keyColors,
              {
                id: newId(),
                customName: null,
                color,
                channels: colorToChannels(color, state.settings.inputColorModel),
              },
            ],
          }
        }),

      // Append one key color per hex in a single update (one undo step / one
      // save) — used by "add matching" from the canvas selection.
      addKeyColors: (hexes) =>
        set((state) => ({
          keyColors: [
            ...state.keyColors,
            ...hexes.map((hex) => {
              const color = hexToColor(hex)
              return {
                id: newId(),
                customName: null,
                color,
                channels: colorToChannels(color, state.settings.inputColorModel),
              }
            }),
          ],
        })),

      removeKeyColor: (id) =>
        set((state) => ({ keyColors: state.keyColors.filter((k) => k.id !== id) })),

      setKeyColorName: (id, name) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => (k.id === id ? { ...k, customName: name } : k)),
        })),

      // A channel edit updates the typed buffer and recomputes the canonical
      // color from the full channel set. We keep the user's raw strings (don't
      // re-derive channels from color here) so mid-edit input stays untouched.
      setKeyColorChannel: (id, channelId, value) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => {
            if (k.id !== id) return k
            const channels = { ...k.channels, [channelId]: value }
            return {
              ...k,
              channels,
              color: channelsToColor(channels, state.settings.inputColorModel),
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
            return {
              ...k,
              channels,
              color: channelsToColor(channels, state.settings.inputColorModel),
            }
          }),
        })),

      // A hex edit sets the canonical color, then re-derives the channel buffer.
      setKeyColorFromHex: (id, hex) =>
        set((state) => {
          const color = hexToColor(hex)
          return {
            keyColors: state.keyColors.map((k) =>
              k.id === id
                ? { ...k, color, channels: colorToChannels(color, state.settings.inputColorModel) }
                : k,
            ),
          }
        }),

      // Switching the input model leaves the canonical color untouched and only
      // re-derives each channel buffer into the new model — so a switch is fully
      // reversible (no lossy channel->channel round-trip).
      setInputColorModel: (model) =>
        set((state) => {
          if (state.settings.inputColorModel === model) return {}
          return {
            settings: { ...state.settings, inputColorModel: model },
            keyColors: state.keyColors.map((k) => ({
              ...k,
              channels: colorToChannels(k.color, model),
            })),
          }
        }),

      setBlendingColorModel: (model) =>
        set((state) => ({ settings: { ...state.settings, blendingColorModel: model } })),
    }),
    {
      limit: 100,
      // Track only the document, not the (stable) action functions.
      partialize: (state): PaletteDocument => ({
        keyColors: state.keyColors,
        settings: state.settings,
      }),
      // Skip pushing identical snapshots onto the history stack.
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    },
  ),
)

export function useTemporalStore<T>(selector: (state: TemporalState<PaletteDocument>) => T): T {
  return useStore(usePaletteStore.temporal, selector)
}
