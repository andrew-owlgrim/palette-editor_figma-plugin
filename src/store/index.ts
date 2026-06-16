import { create, useStore } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import type { BlendingColorModel, InputColorModel, PaletteDocument } from '@/types'
import { hexToChannels, recomputeChannels } from '@/color/models'

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `kc_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

interface PaletteActions {
  hydrate: (document: PaletteDocument) => void
  addKeyColor: () => void
  removeKeyColor: (id: string) => void
  renameKeyColor: (id: string, name: string) => void
  setKeyColorChannel: (id: string, channelId: string, value: string) => void
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

      hydrate: (document) => set({ keyColors: document.keyColors, settings: document.settings }),

      addKeyColor: () =>
        set((state) => ({
          keyColors: [
            ...state.keyColors,
            {
              id: newId(),
              name: 'white',
              channels: hexToChannels('#ffffff', state.settings.inputColorModel),
            },
          ],
        })),

      removeKeyColor: (id) =>
        set((state) => ({ keyColors: state.keyColors.filter((k) => k.id !== id) })),

      renameKeyColor: (id, name) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) => (k.id === id ? { ...k, name } : k)),
        })),

      setKeyColorChannel: (id, channelId, value) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) =>
            k.id === id ? { ...k, channels: { ...k.channels, [channelId]: value } } : k,
          ),
        })),

      setKeyColorFromHex: (id, hex) =>
        set((state) => ({
          keyColors: state.keyColors.map((k) =>
            k.id === id
              ? { ...k, channels: hexToChannels(hex, state.settings.inputColorModel) }
              : k,
          ),
        })),

      setInputColorModel: (model) =>
        set((state) => {
          const from = state.settings.inputColorModel
          if (from === model) return {}
          return {
            settings: { ...state.settings, inputColorModel: model },
            keyColors: state.keyColors.map((k) => ({
              ...k,
              channels: recomputeChannels(k.channels, from, model),
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
