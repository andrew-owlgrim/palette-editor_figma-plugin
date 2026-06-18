import { IconButton, IconTrash24, TextboxNumeric } from '@create-figma-plugin/ui'
import { useEffect, useRef, useState } from 'preact/hooks'
import { AutoToggle } from '@/components/AutoToggle/AutoToggle'
import { ColorSample } from '@/components/ColorSample/ColorSample'
import { ColorPicker } from '@/components/ColorPicker/ColorPicker'
import { Popover } from '@/components/Popover/Popover'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { colorToHex } from '@/color/models'
import { usePaletteStore } from '@/store'
import { blurOnEnter } from '@/utils/keyboard'
import type { GradientStop } from '@/types'
import styles from './StopCard.css'

interface StopCardProps {
  paletteColorId: string
  stop: GradientStop
  isKey: boolean
  canDelete: boolean
}

// Position field for a stop. Always editable (auto or manual): shows "NN%" at
// rest, the bare number while editing (the RawTextboxNumeric controlled-input
// gotcha — see StopInput). On blur it commits ONLY if the value changed, so
// editing an auto value pins it (→ manual, like dragging the handle) while
// blurring it untouched leaves it auto. Keeps DS numeric behaviour (select-on-
// focus, arrow increments).
function PositionField({
  percent,
  onCommit,
}: {
  percent: number
  onCommit: (pct: number) => void
}) {
  const [draft, setDraft] = useState(String(percent))
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    setFocused(false)
    const parsed = Number.parseFloat(draft.trim())
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(100, Math.max(0, parsed))
      if (clamped !== percent) onCommit(clamped)
    }
  }

  // Select the value on focus. The DS textbox selects on focus too, but our
  // focus-driven value change (`51%` → `51`) re-renders and clears it, so re-
  // select once the bare number is committed to the input.
  useEffect(() => {
    if (focused) inputRef.current?.select()
  }, [focused])

  return (
    <div class={styles.positionInput}>
      <TextboxNumeric
        ref={inputRef}
        value={focused ? draft : `${percent}%`}
        minimum={0}
        maximum={100}
        integer
        onValueInput={setDraft}
        onFocus={() => {
          setDraft(String(percent))
          setFocused(true)
        }}
        onBlur={commit}
        onKeyDown={blurOnEnter}
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
        <PositionField
          percent={percent}
          onCommit={(pct) => setStopPosition(paletteColorId, stop.id, pct / 100)}
        />
        <AutoToggle
          active={stop.autoPosition}
          onToggle={(auto) => setStopAutoPosition(paletteColorId, stop.id, auto)}
          activeLabel="Auto position"
          inactiveLabel="Manual position"
          ariaLabel="Toggle auto position"
        />
      </div>
    </div>
  )
}
