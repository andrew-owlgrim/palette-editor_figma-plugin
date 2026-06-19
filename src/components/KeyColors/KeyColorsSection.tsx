import {
  IconButton,
  IconImageSmall24,
  IconPlusSmall24,
  IconSelectMatchingSmall24,
} from '@create-figma-plugin/ui'
import { useEffect, useRef, useState } from 'preact/hooks'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { KeyColorCard } from './KeyColorCard'
import { KeyColorCardPreview } from './KeyColorCardPreview'
import { PaletteImport } from '@/components/PaletteImport/PaletteImport'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { useOverlayScrollbars } from '@/hooks/useOverlayScrollbars'
import { usePaletteStore } from '@/store'
import { useExtractorStore } from '@/store/extractor'
import { useSelectionStore } from '@/store/selection'
import type { PaletteColor } from '@/types'
import styles from './KeyColorsSection.css'

export function KeyColorsSection() {
  const keyColors = usePaletteStore((s) => s.keyColors)
  const addKeyColor = usePaletteStore((s) => s.addKeyColor)
  const addKeyColors = usePaletteStore((s) => s.addKeyColors)
  const importPaletteColors = usePaletteStore((s) => s.importPaletteColors)
  const moveKeyColor = usePaletteStore((s) => s.moveKeyColor)
  const selectionFills = useSelectionStore((s) => s.fills)
  const openExtractor = useExtractorStore((s) => s.open)

  // Id of the card currently being dragged (drives the DragOverlay clone).
  const [activeId, setActiveId] = useState<string | null>(null)
  // Tiny activation distance: a real click never moves, so it falls through to
  // the card's controls; the slightest drag starts a reorder.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }))

  // Overlay scrollbars on the horizontal card list; `instance` lets us scroll the
  // library-managed viewport (not the host) to reveal newly added cards.
  const { ref: listRef, instance: listScrollbars } = useOverlayScrollbars<HTMLDivElement>({
    overflow: { x: 'scroll', y: 'hidden' },
  })
  // Set only by the add buttons so we scroll on user-add, not on load/undo.
  const scrollToEndRef = useRef(false)

  // After the new card(s) have rendered, reveal them (appended at the end).
  useEffect(() => {
    if (!scrollToEndRef.current) return
    scrollToEndRef.current = false
    const viewport = listScrollbars.current?.elements().viewport
    viewport?.scrollTo({ left: viewport.scrollWidth, behavior: 'smooth' })
  }, [keyColors.length])

  function handleAdd() {
    scrollToEndRef.current = true
    addKeyColor()
  }

  function handleAddMatching() {
    if (selectionFills.length === 0) return
    scrollToEndRef.current = true
    addKeyColors(selectionFills)
  }

  function handleImport(colors: PaletteColor[]) {
    scrollToEndRef.current = true
    importPaletteColors(colors)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over !== null && active.id !== over.id) {
      moveKeyColor(String(active.id), String(over.id))
    }
    setActiveId(null)
  }

  const activeKeyColor =
    activeId !== null ? (keyColors.find((k) => k.id === activeId) ?? null) : null

  return (
    <section class={styles.section}>
      <div class={styles.header}>
        <span class={styles.title}>Key colors</span>
        <div class={styles.actions}>
          <PaletteImport onImport={handleImport} />
          <Tooltip content="Extract colors from image">
            <IconButton onClick={openExtractor}>
              <IconImageSmall24 />
            </IconButton>
          </Tooltip>
          <Tooltip content="Add colors from selection">
            <IconButton onClick={handleAddMatching} disabled={selectionFills.length === 0}>
              <IconSelectMatchingSmall24 />
            </IconButton>
          </Tooltip>
          <Tooltip content="Add color">
            <IconButton onClick={handleAdd}>
              <IconPlusSmall24 />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {keyColors.length === 0 ? (
        <div class={styles.empty}>No key colors yet</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={keyColors.map((k) => k.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div class={styles.list} ref={listRef}>
              <div class={styles.track}>
                {keyColors.map((keyColor) => (
                  <KeyColorCard key={keyColor.id} keyColor={keyColor} />
                ))}
              </div>
            </div>
          </SortableContext>
          <DragOverlay>
            {activeKeyColor !== null ? <KeyColorCardPreview keyColor={activeKeyColor} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  )
}
