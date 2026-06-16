import { useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import styles from './NameInput.css'

interface NameInputProps {
  // Resolved name to display (custom or auto).
  value: string
  // Commit a custom name, or null to revert to auto-naming (empty input).
  onCommit: (name: string | null) => void
}

// Ghost text field for the key-color name. While focused it edits a local draft;
// when not focused it always shows the resolved `value`, so the auto name stays
// live as the color changes — and an emptied field snaps back to the auto name
// even when committing it is a no-op (was already auto). Blur/Enter commit
// (empty → null = auto); Escape cancels without committing.
export function NameInput({ value, onCommit }: NameInputProps) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const cancelRef = useRef(false)

  function handleFocus() {
    setDraft(value)
    setFocused(true)
  }

  function handleBlur() {
    setFocused(false)
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    const trimmed = draft.trim()
    onCommit(trimmed === '' ? null : trimmed)
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
      placeholder="Name"
      spellcheck={false}
      value={focused ? draft : value}
      onFocus={handleFocus}
      onInput={(event) => setDraft(event.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
