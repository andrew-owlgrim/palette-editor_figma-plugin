import { create } from 'zustand'
import type { InputColorModel } from '@/types'

// The user-global input color model (ADR-027). It is a pure display/editing
// concern — NOT palette data and NOT part of undo history — so it lives in its
// own tiny store rather than in the palette document's `Settings`.
//
// Keeping it here (instead of inside the library store) lets the palette store
// read it when deriving channel buffers without importing the library store,
// avoiding an import cycle. The library store owns the *change* action
// (`setInputColorModel`) and mirrors this value into the persisted
// `UserLibrary.prefs`; this module is only the reactive value holder.
interface PrefsState {
  inputColorModel: InputColorModel
}

export const usePrefsStore = create<PrefsState>(() => ({
  inputColorModel: 'hsl',
}))

// Non-reactive read for use inside store actions (call-time, not render).
export function inputColorModel(): InputColorModel {
  return usePrefsStore.getState().inputColorModel
}
