import { formatHex, parse } from 'culori'
import { useEffect, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import styles from './GhostInput.css'

interface GhostInputProps {
  // Current hex value WITH a leading '#', e.g. "#fdfaff".
  value: string
  onChange: (hex: string) => void
}

// Drop any leading '#'(s) — the field shows/edits bare hex digits; the '#' is a
// static label, matching how Figma surfaces hex values.
const strip = (value: string): string => value.replace(/^#+/, '')

// Hex field styled like a DS TextboxNumeric (filled, '#' in the icon slot). The
// value is edited without '#'; we re-add it for parsing. Validates on blur
// (revert on invalid) and on Escape.
export function GhostInput({ value, onChange }: GhostInputProps) {
  const [draft, setDraft] = useState(strip(value))

  // Follow external changes (e.g. edits from the wheel) while not editing.
  useEffect(() => {
    setDraft(strip(value))
  }, [value])

  function commit() {
    const parsed = parse(`#${strip(draft)}`)
    if (parsed === undefined) {
      setDraft(strip(value))
      return
    }
    const hex = formatHex(parsed)
    onChange(hex)
    setDraft(strip(hex))
  }

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      setDraft(strip(value))
      event.currentTarget.blur()
    }
  }

  return (
    <div class={styles.field}>
      <span class={styles.tag}>#</span>
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
    </div>
  )
}
