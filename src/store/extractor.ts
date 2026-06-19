import { create } from 'zustand'
import type { DecodedImage } from '@/utils/image'

// Where the extractor flow is: closed (normal UI) → intake (drop/paste/upload
// modal) → loading (decoding a source) → workspace (full-area image + colors).
export type ExtractorStage = 'closed' | 'intake' | 'loading' | 'workspace'

interface ExtractorState {
  stage: ExtractorStage
  // Decoded image, present only in the workspace stage.
  source: DecodedImage | null
  // Last intake failure (bad file, blocked link), shown in the modal.
  error: string | null
  // Open the intake modal over the normal UI.
  open: () => void
  // A source is being decoded — show a spinner, swallow further intake.
  startLoading: () => void
  // Decode succeeded → switch to the full-area workspace.
  setSource: (source: DecodedImage) => void
  // Decode failed → back to intake with a message.
  fail: (message: string) => void
  // Close the flow and release the preview object URL.
  close: () => void
}

// Ephemeral, like the selection store: the in-progress image and extracted
// colors are transient working state, never part of the palette document, so
// they stay out of undo history (zundo) and persistence.
export const useExtractorStore = create<ExtractorState>()((set, get) => ({
  stage: 'closed',
  source: null,
  error: null,
  open: () => set({ stage: 'intake', error: null }),
  startLoading: () => set({ stage: 'loading', error: null }),
  setSource: (source) => {
    // Revoke a previous preview URL it's about to replace — e.g. two decodes
    // raced (paste twice / paste then drop) and the earlier one resolved first.
    // Without this its object URL would leak for the rest of the session.
    const prev = get().source
    if (prev !== null && prev.previewUrl !== source.previewUrl) {
      URL.revokeObjectURL(prev.previewUrl)
    }
    set({ stage: 'workspace', source, error: null })
  },
  fail: (message) => set({ stage: 'intake', error: message }),
  close: () => {
    const { source } = get()
    if (source !== null) URL.revokeObjectURL(source.previewUrl)
    set({ stage: 'closed', source: null, error: null })
  },
}))
