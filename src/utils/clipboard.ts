// Copy text to the clipboard from the plugin iframe. The async Clipboard API is
// the happy path, but it can be unavailable or rejected in Figma's sandboxed
// iframe (permissions / no secure-context guarantee), so we fall back to a hidden
// <textarea> + execCommand('copy'). Both run inside the click gesture that calls
// this. Returns whether the copy succeeded so callers can toast accordingly.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    // Keep it out of view and out of layout, but still selectable.
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
