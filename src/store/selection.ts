import { create } from 'zustand'

interface SelectionState {
  // Solid fills (hex) of the current canvas selection, deduped.
  fills: string[]
  // Raw number of directly-selected nodes (independent of whether they have
  // solid fills) — lets the UI branch on "is anything selected".
  count: number
  setSelection: (data: { fills: string[]; count: number }) => void
}

// Ephemeral selection state, intentionally separate from the palette store so it
// never enters undo history (zundo) or persistence.
export const useSelectionStore = create<SelectionState>()((set) => ({
  fills: [],
  count: 0,
  setSelection: ({ fills, count }) => set({ fills, count }),
}))
