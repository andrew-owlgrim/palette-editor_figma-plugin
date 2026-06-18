import styles from './Swatch.css'

interface SwatchProps {
  hex: string
  selected: boolean
  onToggle: () => void
}

// A square color sample. Clicking toggles whether it lands in key colors on
// submit; deselected swatches dim to 0.4 opacity (the only state besides full).
export function Swatch({ hex, selected, onToggle }: SwatchProps) {
  return (
    <button
      type="button"
      class={`${styles.swatch} ${selected ? '' : styles.inactive}`}
      style={{ backgroundColor: hex }}
      onClick={onToggle}
      title={selected ? 'Click to exclude' : 'Click to include'}
    />
  )
}
