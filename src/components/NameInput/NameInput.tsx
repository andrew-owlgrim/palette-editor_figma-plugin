import { useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import styles from './NameInput.css'

interface NameInputProps {
  // Effective name to display: the auto name while auto, else the custom name.
  value: string
  // Commit a custom name (empty string reverts to auto in the store).
  onCommit: (name: string) => void
}

// Ghost text field for the key-color name, mirroring the gradient stop's position
// field: always editable. While focused it edits a local draft; otherwise it shows
// the live `value` (so the auto name tracks the color). On blur it commits ONLY if
// the text changed — so blurring an auto name untouched leaves it auto, while
// editing it pins a custom name (→ manual; empty reverts to auto in the store).
// Blur/Enter commit; Escape cancels. Name fields do NOT select on focus.
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
    const next = draft.trim()
    if (next !== value) onCommit(next)
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
