import { useRef } from 'preact/hooks'
import { DRAGGABLE_HANDLE_SIZE, Handle } from '@/components/Handle/Handle'
import { StopCard } from './StopCard'
import { usePointerDrag } from '@/hooks/usePointerDrag'
import { colorToHex } from '@/color/models'
import { buildGradientCss, canDeleteStop, sortStops } from '@/color/gradient'
import { usePaletteStore } from '@/store'
import { beginLiveEdit, endLiveEdit } from '@/store/history'
import type { GradientStop, PaletteColor } from '@/types'
import styles from './GradientEditor.css'

interface GradientEditorProps {
  paletteColor: PaletteColor
}

// How close (px) a press must land to an existing handle to grab it instead of
// adding a new stop.
const GRAB_PX = 10

// Inline editor injected under a shade row. The track paints the gradient and
// hosts a draggable handle per stop; pressing empty track adds a stop and drags
// it (ADR-022). Below, one full-width StopCard per stop (recolor / auto / delete).
export function GradientEditor({ paletteColor }: GradientEditorProps) {
  const blending = usePaletteStore((s) => s.settings.blendingColorModel)
  const addStop = usePaletteStore((s) => s.addStop)
  const setStopPosition = usePaletteStore((s) => s.setStopPosition)

  // Drag state across a single press: which stop we're moving (null until the
  // first move decides).
  const drag = useRef<{ stopId: string | null; decided: boolean }>({
    stopId: null,
    decided: false,
  })

  const { ref, onPointerDown } = usePointerDrag({
    onStart: () => {
      beginLiveEdit()
      drag.current = { stopId: null, decided: false }
    },
    onMove: ({ x }) => {
      // Handles are inset by their radius (Handle `inset`), so map the pointer
      // through the same geometry: the centered handle's outer edge reaches the
      // track edge at 0/1, and the grabbed handle stays under the cursor.
      const width = ref.current?.getBoundingClientRect().width ?? 1
      const usable = Math.max(1, width - DRAGGABLE_HANDLE_SIZE)
      const pos = Math.max(0, Math.min(1, (x * width - DRAGGABLE_HANDLE_SIZE / 2) / usable))
      const state = drag.current
      // The first move (fired on press) only decides the target; actual moves
      // come on later ticks. This keeps a plain click on a handle from flipping
      // it to manual, while a click on empty track still adds a stop.
      const decidingTick = state.decided === false
      if (decidingTick) {
        state.decided = true
        const threshold = GRAB_PX / usable
        let nearest: GradientStop | null = null
        let best = Infinity
        for (const s of paletteColor.stops) {
          const d = Math.abs(s.position - pos)
          if (d < best) {
            best = d
            nearest = s
          }
        }
        if (nearest !== null && best <= threshold) {
          // Grab the nearest handle — any stop, endpoints included.
          state.stopId = nearest.id
        } else {
          // Click on empty track adds a stop there (already positioned).
          state.stopId = addStop(paletteColor.id, pos)
        }
      }
      // Only commit drags after the deciding tick, so a click doesn't move/pin.
      if (decidingTick === false && state.stopId !== null) {
        setStopPosition(paletteColor.id, state.stopId, pos)
      }
    },
    onEnd: () => {
      endLiveEdit()
      drag.current = { stopId: null, decided: false }
    },
  })

  const stops = sortStops(paletteColor.stops)
  const trackCss = buildGradientCss(paletteColor.stops, blending)

  return (
    <div class={styles.editor}>
      <div
        ref={ref}
        class={styles.track}
        style={{ backgroundImage: trackCss }}
        onPointerDown={onPointerDown}
      >
        {stops.map((s) => (
          <Handle key={s.id} x={s.position} y={0.5} draggable inset color={colorToHex(s.color)} />
        ))}
      </div>

      <div class={styles.stops}>
        {stops.map((s) => (
          <StopCard
            key={s.id}
            paletteColorId={paletteColor.id}
            stop={s}
            isKey={s.id === paletteColor.keyStopId}
            canDelete={canDeleteStop(paletteColor, s.id)}
          />
        ))}
      </div>
    </div>
  )
}
