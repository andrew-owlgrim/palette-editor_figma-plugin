import { useCallback, useRef } from 'preact/hooks'
import type { JSX, RefObject } from 'preact'

// Position of the pointer as a fraction (0..1) of the tracked element's box.
// May fall outside [0, 1] when the pointer leaves the element — callers clamp.
export interface DragFraction {
  x: number
  y: number
}

interface PointerDragOptions {
  onMove: (fraction: DragFraction) => void
  onStart?: () => void
  onEnd?: () => void
}

/**
 * Pointer-drag binding for a single track element (wheel / slider). Attach the
 * returned `ref` to the track and `onPointerDown` to its pointer-down handler.
 * `onMove` fires on press and on every move until release, with the pointer
 * position as a fraction of the element box (captured at press time).
 *
 * Move/up listeners live on `window`, so dragging keeps working when the pointer
 * leaves the element — and release is never missed (no stuck drag). Constraints
 * (clamping into a circle, onto a line, etc.) are the caller's job in `onMove`.
 */
export function usePointerDrag({ onMove, onStart, onEnd }: PointerDragOptions): {
  ref: RefObject<HTMLDivElement>
  onPointerDown: (event: JSX.TargetedPointerEvent<HTMLDivElement>) => void
} {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the latest callbacks without re-binding listeners mid-drag.
  const callbacks = useRef({ onMove, onStart, onEnd })
  callbacks.current = { onMove, onStart, onEnd }

  const onPointerDown = useCallback((event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    const element = ref.current
    if (element === null) return

    const rect = element.getBoundingClientRect()
    const emit = (clientX: number, clientY: number) => {
      callbacks.current.onMove({
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      })
    }

    const handleMove = (moveEvent: PointerEvent) => emit(moveEvent.clientX, moveEvent.clientY)
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      callbacks.current.onEnd?.()
    }

    callbacks.current.onStart?.()
    emit(event.clientX, event.clientY)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    event.preventDefault()
  }, [])

  return { ref, onPointerDown }
}
