import { IconButton, IconTrash24 } from '@create-figma-plugin/ui'
import { useRef, useState } from 'preact/hooks'
import { ColorSample } from '@/components/ColorSample/ColorSample'
import { ColorPicker } from '@/components/ColorPicker/ColorPicker'
import { Popover } from '@/components/Popover/Popover'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { colorToHex } from '@/color/models'
import { usePaletteStore } from '@/store'
import type { GradientStop } from '@/types'
import styles from './StopCard.css'

interface StopCardProps {
  paletteColorId: string
  stop: GradientStop
  isKey: boolean
  canDelete: boolean
}

// A full-width gradient-stop card (mirrors KeyColorCard): swatch opens the color
// picker for THIS stop; footer shows the position % and an "A" auto-position
// toggle; a delete tile appears on hover for non-endpoint, non-key stops.
export function StopCard({ paletteColorId, stop, isKey, canDelete }: StopCardProps) {
  const removeStop = usePaletteStore((s) => s.removeStop)
  const setStopAutoPosition = usePaletteStore((s) => s.setStopAutoPosition)

  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const hex = colorToHex(stop.color)
  const percent = Math.round(stop.position * 100)
  const autoClass = stop.autoPosition ? `${styles.auto} ${styles.autoActive}` : styles.auto

  return (
    <div class={styles.card}>
      <div class={styles.swatch} ref={containerRef}>
        <div class={styles.anchor} ref={anchorRef}>
          <ColorSample hex={hex} onClick={() => setPickerOpen((open) => !open)} />
        </div>
        {isKey ? <span class={styles.badge}>Key</span> : null}
        {canDelete ? (
          <div class={styles.actionRow}>
            <div class={styles.action}>
              <Tooltip content="Delete stop">
                <IconButton onClick={() => removeStop(paletteColorId, stop.id)}>
                  <IconTrash24 />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        ) : null}
        <Popover
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          containerRef={containerRef}
          anchorRef={anchorRef}
          placement="right-top"
        >
          <ColorPicker paletteColorId={paletteColorId} stopId={stop.id} />
        </Popover>
      </div>

      <div class={styles.footer}>
        <span class={styles.position}>{percent}%</span>
        <Tooltip content={stop.autoPosition ? 'Auto position (by lightness)' : 'Manual position'}>
          <button
            type="button"
            class={autoClass}
            onClick={() => setStopAutoPosition(paletteColorId, stop.id, !stop.autoPosition)}
            aria-label="Toggle auto position"
          >
            A
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
