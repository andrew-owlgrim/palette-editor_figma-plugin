import { IconButton, IconTrash24 } from '@create-figma-plugin/ui'
import { useRef, useState } from 'preact/hooks'
import { ColorPicker } from '@/components/ColorPicker/ColorPicker'
import { ColorSample } from '@/components/ColorSample/ColorSample'
import { Popover } from '@/components/Popover/Popover'
import { colorToHex } from '@/color/models'
import { usePaletteStore } from '@/store'
import type { KeyColor } from '@/types'
import styles from './KeyColorCard.css'

interface KeyColorCardProps {
  keyColor: KeyColor
}

export function KeyColorCard({ keyColor }: KeyColorCardProps) {
  const removeKeyColor = usePaletteStore((s) => s.removeKeyColor)
  const renameKeyColor = usePaletteStore((s) => s.renameKeyColor)

  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const hex = colorToHex(keyColor.color)

  return (
    <div class={styles.card}>
      <div class={styles.swatch} ref={containerRef}>
        <div class={styles.anchor} ref={anchorRef}>
          <ColorSample hex={hex} onClick={() => setPickerOpen((open) => !open)} />
        </div>
        <div class={styles.deleteButton}>
          <IconButton onClick={() => removeKeyColor(keyColor.id)}>
            <IconTrash24 />
          </IconButton>
        </div>
        <Popover
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          containerRef={containerRef}
          anchorRef={anchorRef}
          placement="right-top"
        >
          <ColorPicker keyColorId={keyColor.id} />
        </Popover>
      </div>

      <div class={styles.footer}>
        <input
          class={styles.name}
          type="text"
          value={keyColor.name}
          placeholder="Name"
          spellcheck={false}
          onInput={(event) => renameKeyColor(keyColor.id, event.currentTarget.value)}
        />
      </div>
    </div>
  )
}
