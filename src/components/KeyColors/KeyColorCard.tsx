import { IconButton, IconEyedropperSmall24, IconTrash24 } from '@create-figma-plugin/ui'
import { useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconDice24 } from '@/components/icons/IconDice24'
import { ColorPicker } from '@/components/ColorPicker/ColorPicker'
import { ColorSample } from '@/components/ColorSample/ColorSample'
import { NameInput } from '@/components/NameInput/NameInput'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { Popover } from '@/components/Popover/Popover'
import { colorToHex } from '@/color/models'
import { keyColorOf } from '@/color/gradient'
import { resolveName } from '@/color/naming'
import { usePaletteStore } from '@/store'
import { useSelectionStore } from '@/store/selection'
import type { PaletteColor } from '@/types'
import styles from './KeyColorCard.css'

interface KeyColorCardProps {
  keyColor: PaletteColor
}

export function KeyColorCard({ keyColor }: KeyColorCardProps) {
  const removeKeyColor = usePaletteStore((s) => s.removeKeyColor)
  const rerollKeyColor = usePaletteStore((s) => s.rerollKeyColor)
  const setKeyColorName = usePaletteStore((s) => s.setKeyColorName)
  const setKeyColorFromHex = usePaletteStore((s) => s.setKeyColorFromHex)
  const selectionFills = useSelectionStore((s) => s.fills)

  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Whole card is the drag source. With the section's `distance: 1` activation
  // constraint a plain click still falls through to the swatch/buttons/name —
  // drag only starts once the pointer actually moves. While dragging, the
  // original is hidden (the floating clone lives in the section's DragOverlay),
  // leaving a hole the siblings animate around.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: keyColor.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    visibility: isDragging ? ('hidden' as const) : undefined,
  }
  // DnD Kit types `attributes` against React's DOM types (e.g. `role: string`);
  // cast to Preact's so it fits a Preact element.
  const sortableAttributes = attributes as JSX.HTMLAttributes<HTMLDivElement>

  const hex = colorToHex(keyColorOf(keyColor))

  return (
    <div ref={setNodeRef} class={styles.card} style={style} {...sortableAttributes} {...listeners}>
      <div class={styles.swatch} ref={containerRef}>
        <div class={styles.anchor} ref={anchorRef}>
          <ColorSample hex={hex} onClick={() => setPickerOpen((open) => !open)} />
        </div>
        <div class={styles.actionRow}>
          <div class={styles.action}>
            <Tooltip content="Reroll color">
              <IconButton onClick={() => rerollKeyColor(keyColor.id)}>
                <IconDice24 />
              </IconButton>
            </Tooltip>
          </div>
          {selectionFills.length > 0 ? (
            <div class={styles.action}>
              <Tooltip content="Use color from selection">
                <IconButton onClick={() => setKeyColorFromHex(keyColor.id, selectionFills[0])}>
                  <IconEyedropperSmall24 />
                </IconButton>
              </Tooltip>
            </div>
          ) : null}
          <div class={styles.action}>
            <Tooltip content="Delete">
              <IconButton onClick={() => removeKeyColor(keyColor.id)}>
                <IconTrash24 />
              </IconButton>
            </Tooltip>
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

      {/* The name field is a text-edit zone, not a drag handle: stop pointerdown
          from reaching the card's drag listeners so click/focus/typing and mouse
          text-selection stay native (the `distance: 1` sensor would otherwise
          hijack a select-drag). Dragging the card still works from the swatch. */}
      <div class={styles.footer} onPointerDown={(event) => event.stopPropagation()}>
        <NameInput
          value={resolveName(keyColor)}
          onCommit={(name) => setKeyColorName(keyColor.id, name)}
        />
      </div>
    </div>
  )
}
