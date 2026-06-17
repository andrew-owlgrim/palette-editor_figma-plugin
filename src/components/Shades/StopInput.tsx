import { useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import styles from './StopInput.css'

interface StopInputProps {
  // Pinned value (0..1000), or null when auto.
  value: number | null
  // Auto-resolved value shown as placeholder when `value` is null.
  placeholder: number
  // Commit a pinned value, or null to revert to auto (empty input).
  onCommit: (value: number | null) => void
}

// One shade-step value field (tailwind 1/1000 format). Mirrors NameInput: edits a
// local draft, commits on blur/Enter (empty -> null = auto), Escape cancels. When
// not focused it shows the pinned value, or empty so the auto value shows as the
// placeholder.
export function StopInput({ value, placeholder, onCommit }: StopInputProps) {
  const display = value === null ? '' : String(value)
  const [draft, setDraft] = useState(display)
  const [focused, setFocused] = useState(false)
  const cancelRef = useRef(false)

  function handleFocus() {
    setDraft(display)
    setFocused(true)
  }

  function handleBlur() {
    setFocused(false)
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    const trimmed = draft.trim()
    if (trimmed === '') {
      onCommit(null)
      return
    }
    const parsed = Number.parseInt(trimmed, 10)
    onCommit(Number.isFinite(parsed) ? parsed : null)
  }

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      cancelRef.current = true
      event.currentTarget.blur()
    }
  }

  return (
    <input
      class={styles.input}
      type="text"
      inputMode="numeric"
      spellcheck={false}
      placeholder={String(placeholder)}
      value={focused ? draft : display}
      onFocus={handleFocus}
      onInput={(event) => setDraft(event.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
