import { create } from 'zustand'

interface SelectionState {
  // Solid fills (hex) of the current canvas selection, deduped.
  fills: string[]
  setFills: (fills: string[]) => void
}

// Ephemeral selection state, intentionally separate from the palette store so it
// never enters undo history (zundo) or persistence.
export const useSelectionStore = create<SelectionState>()((set) => ({
  fills: [],
  setFills: (fills) => set({ fills }),
}))
