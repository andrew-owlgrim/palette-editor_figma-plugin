import { Tooltip } from '@/components/Tooltip/Tooltip'
import styles from './AutoToggle.css'

interface AutoToggleProps {
  // Whether the governed value (stop position, key-color name) is auto-derived.
  active: boolean
  onToggle: (active: boolean) => void
  // Tooltip text for each state.
  activeLabel: string
  inactiveLabel: string
  ariaLabel: string
}

// The "A" auto/manual toggle shared by the gradient-stop position and the
// key-color name. Ghost + muted when off; brand glyph on a faint brand wash when
// on (the value it governs is auto-derived).
export function AutoToggle({
  active,
  onToggle,
  activeLabel,
  inactiveLabel,
  ariaLabel,
}: AutoToggleProps) {
  return (
    <Tooltip content={active ? activeLabel : inactiveLabel}>
      <button
        type="button"
        class={active ? `${styles.button} ${styles.active}` : styles.button}
        onClick={() => onToggle(!active)}
        aria-label={ariaLabel}
      >
        A
      </button>
    </Tooltip>
  )
}
