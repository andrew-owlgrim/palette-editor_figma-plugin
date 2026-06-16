// All functions in this file run in the main thread (main.ts).
// The Figma Plugin API is not available in the UI iframe.

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
