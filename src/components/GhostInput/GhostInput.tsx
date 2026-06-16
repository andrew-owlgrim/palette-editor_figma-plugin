import { formatHex, parse } from 'culori'
import { useEffect, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import styles from './GhostInput.css'

interface GhostInputProps {
  // Current hex value (e.g. "#fdfaff"). Displayed uppercased.
  value: string
  onChange: (hex: string) => void
}

// Borderless hex field: no border at rest, but hover/focus reveal a border so it
// reads as a normal textbox. Validates on blur (revert on invalid) and on Escape.
export function GhostInput({ value, onChange }: GhostInputProps) {
  const [draft, setDraft] = useState(value)

  // Follow external changes (e.g. edits from the wheel) while not editing.
  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit() {
    const parsed = parse(draft)
    if (parsed === undefined) {
      setDraft(value)
      return
    }
    const hex = formatHex(parsed)
    onChange(hex)
    setDraft(hex)
  }

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      setDraft(value)
      event.currentTarget.blur()
    }
  }

  return (
    <input
      class={styles.input}
      type="text"
      spellcheck={false}
      value={draft}
      onFocus={(event) => event.currentTarget.select()}
      onInput={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  )
}
