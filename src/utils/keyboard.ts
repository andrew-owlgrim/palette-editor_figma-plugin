import type { JSX } from 'preact'

// Blur the field on Enter so it commits its draft on blur — mirrors the DS
// textbox's built-in Escape→blur. Pass as `onKeyDown` to commit-on-blur inputs.
export function blurOnEnter(event: JSX.TargetedKeyboardEvent<HTMLInputElement>): void {
  if (event.key === 'Enter') event.currentTarget.blur()
}
