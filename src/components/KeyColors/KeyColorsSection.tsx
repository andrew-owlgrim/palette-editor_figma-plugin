import { IconButton, IconPlusSmall24 } from '@create-figma-plugin/ui'
import { KeyColorCard } from './KeyColorCard'
import { usePaletteStore } from '@/store'
import styles from './KeyColorsSection.css'

export function KeyColorsSection() {
  const keyColors = usePaletteStore((s) => s.keyColors)
  const addKeyColor = usePaletteStore((s) => s.addKeyColor)

  return (
    <section class={styles.section}>
      <div class={styles.header}>
        <span class={styles.title}>Key colors</span>
        <IconButton onClick={() => addKeyColor()}>
          <IconPlusSmall24 />
        </IconButton>
      </div>

      {keyColors.length === 0 ? (
        <div class={styles.empty}>No key colors yet</div>
      ) : (
        <div class={styles.list}>
          {keyColors.map((keyColor) => (
            <KeyColorCard key={keyColor.id} keyColor={keyColor} />
          ))}
        </div>
      )}
    </section>
  )
}
