import { useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import styles from './NameInput.css'

interface NameInputProps {
  // Effective name to display: the auto name while `auto`, else the custom name.
  value: string
  // Auto-naming on: the field is read-only and muted (the name follows the color);
  // the "A" toggle next to it switches to manual.
  auto: boolean
  // Commit a custom name (empty string reverts to auto in the store).
  onCommit: (name: string) => void
}

// Ghost text field for the key-color name, mirroring the gradient stop's position
// field: editable when manual, read-only + muted when auto. While focused it edits
// a local draft; otherwise it shows the live `value` (so the auto name tracks the
// color). Blur/Enter commit; Escape cancels. Name fields do NOT select on focus.
export function NameInput({ value, auto, onCommit }: NameInputProps) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const cancelRef = useRef(false)

  function handleFocus() {
    // Auto fields are read-only: ignore focus so a stray tab+blur can't commit.
    if (auto) return
    setDraft(value)
    setFocused(true)
  }

  function handleBlur() {
    if (auto) return
    setFocused(false)
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    onCommit(draft.trim())
  }

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (auto) return
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      cancelRef.current = true
      event.currentTarget.blur()
    }
  }

  return (
    <input
      class={auto ? `${styles.input} ${styles.auto}` : styles.input}
      type="text"
      placeholder="Name"
      spellcheck={false}
      readOnly={auto}
      value={focused ? draft : value}
      onFocus={handleFocus}
      onInput={(event) => setDraft(event.currentTarget.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
