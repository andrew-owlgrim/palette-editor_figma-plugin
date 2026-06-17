import { IconButton, IconMinusSmall24, IconPlusSmall24 } from '@create-figma-plugin/ui'
import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { MAX_SHADE_COUNT, MIN_SHADE_COUNT } from '@/color/shades'
import styles from './CountStepper.css'

interface CountStepperProps {
  value: number
  onChange: (count: number) => void
}

// −/+ buttons around a directly-editable count field. The store clamps to
// [MIN, MAX]; the buttons disable at the bounds. The field commits on blur/Enter.
export function CountStepper({ value, onChange }: CountStepperProps) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  function commit(raw: string) {
    const parsed = Number.parseInt(raw.trim(), 10)
    if (Number.isFinite(parsed)) onChange(parsed)
  }

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  return (
    <div class={styles.stepper}>
      <IconButton onClick={() => onChange(value - 1)} disabled={value <= MIN_SHADE_COUNT}>
        <IconMinusSmall24 />
      </IconButton>
      <input
        class={styles.field}
        type="text"
        inputMode="numeric"
        spellcheck={false}
        value={focused ? draft : String(value)}
        onFocus={() => {
          setDraft(String(value))
          setFocused(true)
        }}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onBlur={(event) => {
          setFocused(false)
          commit(event.currentTarget.value)
        }}
        onKeyDown={handleKeyDown}
      />
      <IconButton onClick={() => onChange(value + 1)} disabled={value >= MAX_SHADE_COUNT}>
        <IconPlusSmall24 />
      </IconButton>
    </div>
  )
}
