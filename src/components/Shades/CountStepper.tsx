import {
  IconButton,
  IconMinusSmall24,
  IconPlusSmall24,
  TextboxNumeric,
} from '@create-figma-plugin/ui'
import { useEffect, useRef, useState } from 'preact/hooks'
import { MAX_SHADE_COUNT, MIN_SHADE_COUNT } from '@/color/shades'
import { blurOnEnter } from '@/utils/keyboard'
import styles from './CountStepper.css'

interface CountStepperProps {
  value: number
  onChange: (count: number) => void
}

// −/+ buttons around a directly-editable count field. The field mirrors the
// gradient editor's position input: a DS TextboxNumeric, ghost at rest (see
// CountStepper.css), selecting its value on focus and committing on blur/Enter.
// The store clamps to [MIN, MAX]; the buttons disable at the bounds.
export function CountStepper({ value, onChange }: CountStepperProps) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    setFocused(false)
    const parsed = Number.parseInt(draft.trim(), 10)
    if (Number.isFinite(parsed) && parsed !== value) onChange(parsed)
  }

  // Re-select on focus: the DS textbox selects on focus, but our focus-driven
  // value swap re-renders and clears it, so re-select once focused (as in
  // StopCard's PositionField).
  useEffect(() => {
    if (focused) inputRef.current?.select()
  }, [focused])

  return (
    <div class={styles.stepper}>
      <IconButton onClick={() => onChange(value - 1)} disabled={value <= MIN_SHADE_COUNT}>
        <IconMinusSmall24 />
      </IconButton>
      <div class={styles.field}>
        <TextboxNumeric
          ref={inputRef}
          value={focused ? draft : String(value)}
          minimum={MIN_SHADE_COUNT}
          maximum={MAX_SHADE_COUNT}
          integer
          onValueInput={setDraft}
          onFocus={() => {
            setDraft(String(value))
            setFocused(true)
          }}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
      </div>
      <IconButton onClick={() => onChange(value + 1)} disabled={value >= MAX_SHADE_COUNT}>
        <IconPlusSmall24 />
      </IconButton>
    </div>
  )
}
