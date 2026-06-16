import { IconButton, IconPlusSmall24 } from '@create-figma-plugin/ui'
import { useEffect, useRef } from 'preact/hooks'
import { KeyColorCard } from './KeyColorCard'
import { usePaletteStore } from '@/store'
import styles from './KeyColorsSection.css'

export function KeyColorsSection() {
  const keyColors = usePaletteStore((s) => s.keyColors)
  const addKeyColor = usePaletteStore((s) => s.addKeyColor)

  const listRef = useRef<HTMLDivElement>(null)
  // Set only by the "+" button so we scroll on user-add, not on load/undo.
  const scrollToEndRef = useRef(false)

  // After the new card has rendered, reveal it (it's appended at the end).
  useEffect(() => {
    if (!scrollToEndRef.current) return
    scrollToEndRef.current = false
    const list = listRef.current
    if (list !== null) {
      list.scrollTo({ left: list.scrollWidth, behavior: 'smooth' })
    }
  }, [keyColors.length])

  function handleAdd() {
    scrollToEndRef.current = true
    addKeyColor()
  }

  return (
    <section class={styles.section}>
      <div class={styles.header}>
        <span class={styles.title}>Key colors</span>
        <IconButton onClick={handleAdd}>
          <IconPlusSmall24 />
        </IconButton>
      </div>

      {keyColors.length === 0 ? (
        <div class={styles.empty}>No key colors yet</div>
      ) : (
        <div class={styles.list} ref={listRef}>
          {keyColors.map((keyColor) => (
            <KeyColorCard key={keyColor.id} keyColor={keyColor} />
          ))}
        </div>
      )}
    </section>
  )
}
