import { TextboxNumeric } from '@create-figma-plugin/ui'
import { useState } from 'preact/hooks'
import { SHADE_MAX } from '@/color/shades'
import { blurOnEnter } from '@/utils/keyboard'

interface StopInputProps {
  // Pinned value (0..1000), or null when auto.
  value: number | null
  // Auto-resolved value shown as placeholder when `value` is null.
  placeholder: number
  // Commit a pinned value, or null to revert to auto (empty input).
  onCommit: (value: number | null) => void
}

// DS numeric textbox (like ChannelInput, no icon): default styling, select-on-
// focus, placeholder, min/max validation. RawTextboxNumeric is fully controlled
// and renders `value` verbatim, so we drive it from a local STRING draft while
// focused (mirroring exactly what's typed) — feeding a re-stringified number
// straight back fought the controlled input and blocked typing. The parsed value
// commits on blur; empty = auto (null).
export function StopInput({ value, placeholder, onCommit }: StopInputProps) {
  const stored = value === null ? '' : String(value)
  const [draft, setDraft] = useState(stored)
  const [focused, setFocused] = useState(false)

  function handleFocus() {
    setDraft(stored)
    setFocused(true)
  }

  function handleBlur() {
    setFocused(false)
    const trimmed = draft.trim()
    if (trimmed === '') {
      onCommit(null)
      return
    }
    const parsed = Number.parseInt(trimmed, 10)
    onCommit(Number.isFinite(parsed) ? parsed : null)
  }

  return (
    <TextboxNumeric
      value={focused ? draft : stored}
      placeholder={String(placeholder)}
      minimum={0}
      maximum={SHADE_MAX}
      integer
      onValueInput={setDraft}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={blurOnEnter}
    />
  )
}
