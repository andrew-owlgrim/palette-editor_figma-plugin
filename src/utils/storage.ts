// All functions in this file run in the main thread (main.ts).
// The Figma Plugin API is not available in the UI iframe.

import type { ActivePaletteRef, InputColorModel, Palette, UserLibrary, UserPrefs } from '@/types'

// Figma restricts the namespace to alphanumeric characters and `_` (no `-`).
const PLUGIN_NAMESPACE = 'mycolors'

// ─── User storage ────────────────────────────────────────────────────────────
// Persists between plugin sessions for the current user only.

export async function getUserData<T>(key: string): Promise<T | null> {
  const value = await figma.clientStorage.getAsync(key)
  return (value as T) ?? null
}

export async function setUserData<T>(key: string, value: T): Promise<void> {
  await figma.clientStorage.setAsync(key, value)
}

export async function deleteUserData(key: string): Promise<void> {
  await figma.clientStorage.deleteAsync(key)
}

// ─── File storage ─────────────────────────────────────────────────────────────
// Shared between all collaborators who open this Figma file.

export function getFileData<T>(key: string): T | null {
  const raw = figma.root.getSharedPluginData(PLUGIN_NAMESPACE, key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setFileData<T>(key: string, value: T): void {
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, key, JSON.stringify(value))
}

export function deleteFileData(key: string): void {
  figma.root.setSharedPluginData(PLUGIN_NAMESPACE, key, '')
}

// ─── User palette library (clientStorage) ──────────────────────────────────
// One `clientStorage` entry holds the whole per-user library: saved palettes,
// global prefs, and the per-file active-palette pointers (ADR-026). Private to
// the user, visible in every file. Async — fetched over the bridge after mount.

const LIBRARY_KEY = 'library'
// Schema version; bump + migrate in `getUserLibrary` when the shape changes.
const LIBRARY_VERSION = 1
// Soft cap on the serialized library. Figma's clientStorage allows ~5 MB total
// across keys / ~1 MB per entry; palettes are tiny (a few KB each), so this is a
// friendly guard against runaway growth, well under the platform limit.
const LIBRARY_MAX_BYTES = 900_000
// Default input model when the library is created fresh (ADR-027).
const DEFAULT_INPUT_COLOR_MODEL: InputColorModel = 'hsl'

export function emptyUserLibrary(): UserLibrary {
  return {
    version: LIBRARY_VERSION,
    palettes: [],
    prefs: { inputColorModel: DEFAULT_INPUT_COLOR_MODEL },
    activeByDocument: {},
  }
}

function isUserLibrary(value: unknown): value is UserLibrary {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as UserLibrary).palettes) &&
    typeof (value as UserLibrary).prefs === 'object'
  )
}

// Read the library, tolerating a missing / malformed / older entry by filling in
// defaults (mirrors the tolerant document hydrate). A future version bump adds a
// migration switch here, gated on the stored `version`.
export async function getUserLibrary(): Promise<UserLibrary> {
  const raw: unknown = await figma.clientStorage.getAsync(LIBRARY_KEY)
  if (!isUserLibrary(raw)) return emptyUserLibrary()
  const base = emptyUserLibrary()
  return {
    version: LIBRARY_VERSION,
    palettes: raw.palettes,
    prefs: { ...base.prefs, ...raw.prefs },
    activeByDocument: raw.activeByDocument ?? {},
  }
}

async function setUserLibrary(library: UserLibrary): Promise<void> {
  if (JSON.stringify(library).length > LIBRARY_MAX_BYTES) {
    throw new Error('Palette library is full — delete a saved palette and try again.')
  }
  await figma.clientStorage.setAsync(LIBRARY_KEY, library)
}

// Serialize read-modify-write operations so overlapping saves (a debounced
// palette upsert racing a prefs/active write) can't clobber each other. Each op
// reads the latest library, applies its mutation, and writes it back, chained on
// the previous op. The chain itself swallows errors to stay alive; the caller
// still sees the rejection of its own op (e.g. a quota overflow → notify).
let writeChain: Promise<unknown> = Promise.resolve()

function mutateUserLibrary(fn: (library: UserLibrary) => UserLibrary): Promise<void> {
  const next = writeChain.then(async () => {
    const library = await getUserLibrary()
    await setUserLibrary(fn(library))
  })
  writeChain = next.catch(() => undefined)
  return next
}

export function upsertUserPalette(palette: Palette): Promise<void> {
  return mutateUserLibrary((library) => {
    const idx = library.palettes.findIndex((p) => p.id === palette.id)
    const palettes =
      idx === -1
        ? [...library.palettes, palette]
        : library.palettes.map((p) => (p.id === palette.id ? palette : p))
    return { ...library, palettes }
  })
}

export function deleteUserPalette(id: string): Promise<void> {
  return mutateUserLibrary((library) => ({
    ...library,
    palettes: library.palettes.filter((p) => p.id !== id),
  }))
}

export function saveUserPrefs(prefs: UserPrefs): Promise<void> {
  return mutateUserLibrary((library) => ({ ...library, prefs }))
}

export function setActivePalette(documentId: string, ref: ActivePaletteRef): Promise<void> {
  return mutateUserLibrary((library) => ({
    ...library,
    activeByDocument: { ...library.activeByDocument, [documentId]: ref },
  }))
}
