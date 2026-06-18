import { IconButton, IconTrash24, TextboxNumeric } from '@create-figma-plugin/ui'
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

// Manual position editor: a compact numeric % field. Controlled by a local string
// draft while focused (the RawTextboxNumeric controlled-input gotcha — see
// StopInput), committing the parsed value [0..100] on blur.
function PositionField({
  percent,
  onCommit,
}: {
  percent: number
  onCommit: (pct: number) => void
}) {
  const stored = String(percent)
  const [draft, setDraft] = useState(stored)
  const [focused, setFocused] = useState(false)

  function commit() {
    setFocused(false)
    const parsed = Number.parseFloat(draft.trim())
    if (Number.isFinite(parsed)) onCommit(Math.min(100, Math.max(0, parsed)))
    else setDraft(stored)
  }

  return (
    <div class={styles.positionInput}>
      <TextboxNumeric
        value={focused ? draft : stored}
        minimum={0}
        maximum={100}
        integer
        onValueInput={setDraft}
        onFocus={() => {
          setDraft(stored)
          setFocused(true)
        }}
        onBlur={commit}
      />
    </div>
  )
}

// A full-width gradient-stop card (mirrors KeyColorCard): swatch opens the color
// picker for THIS stop; footer shows the position % and an "A" auto-position
// toggle; a delete tile appears on hover for non-endpoint, non-key stops.
export function StopCard({ paletteColorId, stop, isKey, canDelete }: StopCardProps) {
  const removeStop = usePaletteStore((s) => s.removeStop)
  const setStopAutoPosition = usePaletteStore((s) => s.setStopAutoPosition)
  const setStopPosition = usePaletteStore((s) => s.setStopPosition)

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
        {stop.autoPosition ? (
          <span class={styles.position}>{percent}%</span>
        ) : (
          <PositionField
            percent={percent}
            onCommit={(pct) => setStopPosition(paletteColorId, stop.id, pct / 100)}
          />
        )}
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
