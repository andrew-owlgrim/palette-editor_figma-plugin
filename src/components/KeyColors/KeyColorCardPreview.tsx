import { colorToHex } from '@/color/models'
import { keyColorOf } from '@/color/gradient'
import { resolveName } from '@/color/naming'
import type { PaletteColor } from '@/types'
import styles from './KeyColorCard.css'

interface KeyColorCardPreviewProps {
  keyColor: PaletteColor
}

// Static, non-interactive clone of a key-color card, rendered inside the DnD
// DragOverlay so the dragged card floats above the scroll container (the real
// card is hidden in place — see KeyColorCard). Mirrors the card's layout:
// edge-to-edge swatch on top, resolved name below.
export function KeyColorCardPreview({ keyColor }: KeyColorCardPreviewProps) {
  const hex = colorToHex(keyColorOf(keyColor))
  return (
    <div class={`${styles.card} ${styles.preview}`}>
      <div class={styles.swatch}>
        <div class={styles.anchor} style={{ backgroundColor: hex }} />
      </div>
      <div class={styles.footer}>
        <span class={styles.previewName}>{resolveName(keyColor)}</span>
      </div>
    </div>
  )
}
