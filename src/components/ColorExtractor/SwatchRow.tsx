import { Toggle } from '@create-figma-plugin/ui'
import styles from './SwatchRow.css'

interface SwatchRowProps {
  hex: string
  selected: boolean
  onToggle: (selected: boolean) => void
}

// One extracted color: swatch + hex + a toggle deciding whether it lands in key
// colors on submit.
export function SwatchRow({ hex, selected, onToggle }: SwatchRowProps) {
  return (
    <div class={styles.row}>
      <span class={styles.sample} style={{ backgroundColor: hex }} />
      <span class={styles.hex}>{hex}</span>
      <Toggle value={selected} onValueChange={onToggle}>
        {''}
      </Toggle>
    </div>
  )
}
