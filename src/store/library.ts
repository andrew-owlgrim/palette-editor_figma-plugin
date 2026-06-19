import { emit } from '@create-figma-plugin/utilities'
import { create } from 'zustand'
import type {
  ActivePaletteRef,
  DeleteUserPaletteHandler,
  InputColorModel,
  Palette,
  PersistedDocument,
  SaveDocumentHandler,
  SaveUserPaletteHandler,
  SaveUserPrefsHandler,
  SetActivePaletteHandler,
  UserLibrary,
  UserPrefs,
} from '@/types'
import { emptyPaletteBody, newPaletteId, usePaletteStore } from '.'
import { usePrefsStore } from './prefs'

// The palette library (ADR-026). A plain zustand store (NO temporal) holding the
// set of user palettes, the document palette's identity + cached body, the
// active-palette pointer, and the global prefs. Library mutations
// (create/duplicate/rename/delete/switch) are deliberately outside undo —
// switching palettes clears the (per-palette) undo history by design.
//
// This module also owns the debounced *save controller* (below): it routes each
// commit of the active palette body to the right target (document → shared
// plugin data; user → clientStorage) and exposes a flush so a palette switch
// never loses a pending edit. Co-locating it here avoids an import cycle (it
// needs the library state to route).

const SAVE_DEBOUNCE_MS = 400

interface LibraryState {
  // True until the async user library arrives over the bridge after mount.
  loading: boolean
  // Document palette identity (id = figma.root.id, name = file name; ADR-026/8.3).
  documentId: string
  documentName: string
  // Cached persisted body of the document palette, kept in sync on every save so
  // switching back to it needs no round-trip to the main thread.
  documentBody: PersistedDocument
  palettes: Palette[]
  prefs: UserPrefs
  activeRef: ActivePaletteRef

  // Seed identity from the synchronous showUI props (document active by default).
  initFromProps: (
    initialDocument: PersistedDocument | null | undefined,
    documentId: string,
    documentName: string,
  ) => void
  // Apply the async-loaded library: prefs, palettes, and the resolved active ref.
  receiveLibrary: (library: UserLibrary) => void
  selectPalette: (ref: ActivePaletteRef) => void
  createPalette: () => void
  duplicatePalette: (id: string) => void
  renamePalette: (id: string, name: string) => void
  deletePalette: (id: string) => void
  // Apply a persist result from the main thread: a failed FIRST save of an
  // optimistically-added palette rolls it back out of the store.
  handleSaveResult: (id: string, ok: boolean) => void
  setInputColorModel: (model: InputColorModel) => void
}

// Ids of palettes added optimistically this session that haven't yet been
// confirmed persisted. A save FAILURE for an id still in this set (e.g. the
// library hit its size cap) means the palette never reached clientStorage, so we
// roll it back rather than leave a ghost that vanishes on reload. A success ack
// clears the id, so a later edit-save failure to it only notifies (the palette is
// already on disk).
const unpersistedIds = new Set<string>()

// Legacy input model found on the loaded document's settings (pre-ADR-027). Used
// once, as a first-run nicety, to seed the global pref so existing users keep
// their model. Captured at init; consumed in `receiveLibrary`.
let legacyDocumentModel: InputColorModel | undefined

function nextPaletteName(palettes: Palette[]): string {
  const base = 'New palette'
  const names = new Set(palettes.map((p) => p.name))
  if (!names.has(base)) return base
  let n = 2
  while (names.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

// Set the global input model, mirror it into the prefs holder, and re-derive
// every stop's channel buffer — WITHOUT recording an undo entry (temporal
// paused). The canonical colors are untouched, so this is a pure display change.
function applyInputColorModel(model: InputColorModel): void {
  usePrefsStore.setState({ inputColorModel: model })
  const temporal = usePaletteStore.temporal.getState()
  temporal.pause()
  usePaletteStore.getState().rederiveAllChannels(model)
  temporal.resume()
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  loading: true,
  documentId: '',
  documentName: '',
  documentBody: emptyPaletteBody(),
  palettes: [],
  prefs: { inputColorModel: 'hsl' },
  activeRef: { kind: 'document', id: '' },

  initFromProps: (initialDocument, documentId, documentName) => {
    legacyDocumentModel = (
      initialDocument?.settings as Partial<{ inputColorModel: InputColorModel }> | undefined
    )?.inputColorModel
    set({
      documentId,
      documentName,
      documentBody: initialDocument ?? emptyPaletteBody(),
      activeRef: { kind: 'document', id: documentId },
    })
  },

  receiveLibrary: (library) => {
    // First-run nicety: an untouched library (no palettes, no active pointers)
    // adopts the legacy document input model instead of the bare default.
    const firstRun =
      library.palettes.length === 0 && Object.keys(library.activeByDocument).length === 0
    let prefs = library.prefs
    if (
      firstRun &&
      legacyDocumentModel !== undefined &&
      legacyDocumentModel !== prefs.inputColorModel
    ) {
      prefs = { inputColorModel: legacyDocumentModel }
      emit<SaveUserPrefsHandler>('SAVE_USER_PREFS', { prefs })
    }
    applyInputColorModel(prefs.inputColorModel)

    // Resolve the active pointer for this file; fall back to the document palette
    // if absent or it points to a deleted user palette.
    const stored = library.activeByDocument[get().documentId]
    const validUser = stored?.kind === 'user' && library.palettes.some((p) => p.id === stored.id)

    set({ palettes: library.palettes, prefs, loading: false })

    if (validUser) {
      get().selectPalette(stored)
    } else {
      set({ activeRef: { kind: 'document', id: get().documentId } })
    }
  },

  selectPalette: (ref) => {
    const state = get()
    if (ref.kind === state.activeRef.kind && ref.id === state.activeRef.id) return

    // 1. Flush the pending save of the CURRENT active palette to its own target
    //    first, so no debounced write lands on the wrong palette after we switch.
    flushSave()

    // 2. Resolve the target body (locally cached — no main round-trip needed).
    const body: PersistedDocument | undefined =
      ref.kind === 'document' ? state.documentBody : state.palettes.find((p) => p.id === ref.id)
    if (body === undefined) return // stale pointer; ignore

    // 3. Load it and clear undo so the loaded state is the new baseline (mirrors
    //    the hydrate-then-clear pattern used at startup).
    usePaletteStore.getState().hydrate(body)
    usePaletteStore.temporal.getState().clear()

    // 4. Baseline the save dedupe so the hydrate isn't echoed back as a save.
    resetSaveBaseline()

    // 5. Update + persist the per-document active pointer.
    set({ activeRef: ref })
    emit<SetActivePaletteHandler>('SET_ACTIVE_PALETTE', {
      documentId: state.documentId,
      ref,
    })
  },

  createPalette: () => {
    const id = newPaletteId()
    const palette: Palette = {
      id,
      name: nextPaletteName(get().palettes),
      updatedAt: Date.now(),
      ...emptyPaletteBody(),
    }
    unpersistedIds.add(id)
    set({ palettes: [...get().palettes, palette] })
    emit<SaveUserPaletteHandler>('SAVE_USER_PALETTE', { palette })
    get().selectPalette({ kind: 'user', id })
  },

  duplicatePalette: (id) => {
    // If duplicating the active palette, flush first so the copy reflects the
    // latest in-flight edits (commitSave writes them into `palettes`).
    if (get().activeRef.kind === 'user' && get().activeRef.id === id) flushSave()
    const source = get().palettes.find((p) => p.id === id)
    if (source === undefined) return
    const copy: Palette = {
      // Deep-copy the body so the copy and source never share nested references.
      ...(JSON.parse(JSON.stringify(source)) as Palette),
      id: newPaletteId(),
      name: `${source.name} copy`,
      updatedAt: Date.now(),
    }
    unpersistedIds.add(copy.id)
    set({ palettes: [...get().palettes, copy] })
    emit<SaveUserPaletteHandler>('SAVE_USER_PALETTE', { palette: copy })
    get().selectPalette({ kind: 'user', id: copy.id })
  },

  renamePalette: (id, name) => {
    const trimmed = name.trim()
    if (trimmed === '') return // empty → keep previous name
    if (get().activeRef.kind === 'user' && get().activeRef.id === id) flushSave()
    const palette = get().palettes.find((p) => p.id === id)
    if (palette === undefined || palette.name === trimmed) return
    const updated: Palette = { ...palette, name: trimmed, updatedAt: Date.now() }
    set({ palettes: get().palettes.map((p) => (p.id === id ? updated : p)) })
    emit<SaveUserPaletteHandler>('SAVE_USER_PALETTE', { palette: updated })
  },

  deletePalette: (id) => {
    const wasActive = get().activeRef.kind === 'user' && get().activeRef.id === id
    // Drop any pending debounced save for this palette — otherwise it could be
    // re-written to clientStorage right after we delete it (resurrection race).
    if (wasActive) cancelPendingSave()
    unpersistedIds.delete(id)
    set({ palettes: get().palettes.filter((p) => p.id !== id) })
    emit<DeleteUserPaletteHandler>('DELETE_USER_PALETTE', { id })
    if (wasActive) {
      // Fall back to the document palette (flushSave inside is now a no-op).
      get().selectPalette({ kind: 'document', id: get().documentId })
    }
  },

  handleSaveResult: (id, ok) => {
    if (ok) {
      unpersistedIds.delete(id) // confirmed persisted; later failures only notify
      return
    }
    // A persist failed. Only roll back if this palette was never persisted (still
    // optimistic) — an edit-save failure to an already-saved palette must keep it.
    if (!unpersistedIds.has(id)) return
    unpersistedIds.delete(id)
    const wasActive = get().activeRef.kind === 'user' && get().activeRef.id === id
    if (wasActive) cancelPendingSave()
    set({ palettes: get().palettes.filter((p) => p.id !== id) })
    if (wasActive) get().selectPalette({ kind: 'document', id: get().documentId })
  },

  setInputColorModel: (model) => {
    if (usePrefsStore.getState().inputColorModel === model) return
    applyInputColorModel(model)
    const prefs: UserPrefs = { inputColorModel: model }
    set({ prefs })
    emit<SaveUserPrefsHandler>('SAVE_USER_PREFS', { prefs })
  },
}))

// ─── Save controller ────────────────────────────────────────────────────────
// Debounced, flushable, routed by the active palette kind, with dedupe so a
// channels-only change (input-model switch) is never written (ADR-027).

let saveTimeout: ReturnType<typeof setTimeout> | undefined
let lastSavedBody: string | null = null

// Serialize the live palette store into a persisted body — the SAME shape for
// both document and user palettes. `channels` and the resolved auto name are
// re-derived on load, so they are intentionally not persisted.
export function currentPersistedBody(): PersistedDocument {
  const { keyColors, settings, shades } = usePaletteStore.getState()
  return {
    keyColors: keyColors.map(({ id, customName, autoName, keyStopId, stops }) => ({
      id,
      customName,
      autoName,
      keyStopId,
      stops: stops.map(({ id, position, color, autoPosition }) => ({
        id,
        position,
        color,
        autoPosition,
      })),
    })),
    settings,
    shades,
  }
}

function commitSave(): void {
  saveTimeout = undefined
  const body = currentPersistedBody()
  const serialized = JSON.stringify(body)
  // Dedupe: an input-model switch only changes the (unpersisted) channel buffer,
  // leaving the persisted body identical — skip the write and the updatedAt bump.
  if (serialized === lastSavedBody) return
  lastSavedBody = serialized

  const state = useLibraryStore.getState()
  if (state.activeRef.kind === 'document') {
    useLibraryStore.setState({ documentBody: body })
    emit<SaveDocumentHandler>('SAVE_DOCUMENT', body)
    return
  }

  const id = state.activeRef.id
  const existing = state.palettes.find((p) => p.id === id)
  if (existing === undefined) return // palette was deleted mid-flight; drop the write
  const palette: Palette = { ...existing, updatedAt: Date.now(), ...body }
  useLibraryStore.setState({
    palettes: state.palettes.map((p) => (p.id === id ? palette : p)),
  })
  emit<SaveUserPaletteHandler>('SAVE_USER_PALETTE', { palette })
}

// Called by the App subscription on every palette-store change.
export function scheduleSave(): void {
  if (saveTimeout !== undefined) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(commitSave, SAVE_DEBOUNCE_MS)
}

// Force any pending write now (before a palette switch / on unmount).
export function flushSave(): void {
  if (saveTimeout === undefined) return
  clearTimeout(saveTimeout)
  commitSave()
}

// Drop a pending write without committing it (used when deleting the active
// palette — its in-flight edit must not resurrect it).
export function cancelPendingSave(): void {
  if (saveTimeout === undefined) return
  clearTimeout(saveTimeout)
  saveTimeout = undefined
}

// Set the dedupe baseline to the current live body without saving — used right
// after a hydrate/select so the loaded state isn't echoed back as a save.
export function resetSaveBaseline(): void {
  lastSavedBody = JSON.stringify(currentPersistedBody())
}
