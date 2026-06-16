import { usePaletteStore } from '@/store'
import type { PaletteDocument } from '@/types'

// Must match the `limit` passed to zundo's temporal middleware in store/index.ts.
const HISTORY_LIMIT = 100

// Snapshot taken at the start of a live interaction (drag / text edit). While an
// interaction is in progress, zundo tracking is paused so the stream of
// intermediate updates is not recorded; on commit we push exactly this snapshot
// as a single history entry. `null` means no interaction is in progress.
let snapshot: PaletteDocument | null = null

function currentDocument(): PaletteDocument {
  const { keyColors, settings } = usePaletteStore.getState()
  return { keyColors, settings }
}

/**
 * Begin a live interaction: snapshot the document and pause undo tracking so the
 * rapid intermediate states (a drag's moves, a field's keystrokes) don't each
 * become an undo step. Re-entrant calls keep the first snapshot.
 */
export function beginLiveEdit(): void {
  if (snapshot !== null) return
  snapshot = currentDocument()
  usePaletteStore.temporal.getState().pause()
}

/**
 * Commit a live interaction: resume tracking and, if the document actually
 * changed, push the pre-interaction snapshot as one history entry — mirroring
 * zundo's own `_handleSet` (append past, clear redo, honor the limit).
 */
export function endLiveEdit(): void {
  const before = snapshot
  snapshot = null
  usePaletteStore.temporal.getState().resume()
  if (before === null) return
  if (JSON.stringify(before) === JSON.stringify(currentDocument())) return
  usePaletteStore.temporal.setState((state) => ({
    pastStates: [...state.pastStates, before].slice(-HISTORY_LIMIT),
    futureStates: [],
  }))
}
