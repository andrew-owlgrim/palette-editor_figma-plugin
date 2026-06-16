import { IconButton, IconEyedropperSmall24, IconTrash24 } from '@create-figma-plugin/ui'
import { useRef, useState } from 'preact/hooks'
import { ColorPicker } from '@/components/ColorPicker/ColorPicker'
import { ColorSample } from '@/components/ColorSample/ColorSample'
import { NameInput } from '@/components/NameInput/NameInput'
import { Popover } from '@/components/Popover/Popover'
import { colorToHex } from '@/color/models'
import { resolveName } from '@/color/naming'
import { usePaletteStore } from '@/store'
import { useSelectionStore } from '@/store/selection'
import type { KeyColor } from '@/types'
import styles from './KeyColorCard.css'

interface KeyColorCardProps {
  keyColor: KeyColor
}

export function KeyColorCard({ keyColor }: KeyColorCardProps) {
  const removeKeyColor = usePaletteStore((s) => s.removeKeyColor)
  const setKeyColorName = usePaletteStore((s) => s.setKeyColorName)
  const setKeyColorFromHex = usePaletteStore((s) => s.setKeyColorFromHex)
  const selectionFills = useSelectionStore((s) => s.fills)

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
        <div class={styles.actionRow}>
          {selectionFills.length > 0 ? (
            <div class={styles.action}>
              <IconButton onClick={() => setKeyColorFromHex(keyColor.id, selectionFills[0])}>
                <IconEyedropperSmall24 />
              </IconButton>
            </div>
          ) : null}
          <div class={styles.action}>
            <IconButton onClick={() => removeKeyColor(keyColor.id)}>
              <IconTrash24 />
            </IconButton>
          </div>
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
        <NameInput
          value={resolveName(keyColor)}
          onCommit={(name) => setKeyColorName(keyColor.id, name)}
        />
      </div>
    </div>
  )
}
