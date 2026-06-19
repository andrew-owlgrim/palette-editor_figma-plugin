import styles from './Swatch.css'

interface SwatchProps {
  hex: string
  selected: boolean
  onToggle: () => void
}

// A square color sample with a checkbox in its top-left corner that makes the
// include/exclude toggle explicit. Clicking anywhere on the swatch toggles it;
// deselected swatches dim their fill (the checkbox stays crisp for clarity).
// Shared by the image-extraction workspace and the import-from-palette modal.
export function Swatch({ hex, selected, onToggle }: SwatchProps) {
  return (
    <button
      type="button"
      class={styles.swatch}
      onClick={onToggle}
      aria-pressed={selected}
      title={selected ? 'Click to exclude' : 'Click to include'}
    >
      <span
        class={`${styles.fill} ${selected ? '' : styles.inactive}`}
        style={{ backgroundColor: hex }}
      />
      <span class={`${styles.check} ${selected ? styles.checked : ''}`}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d="M1.5 5.2 L4 7.5 L8.5 2.5"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}
