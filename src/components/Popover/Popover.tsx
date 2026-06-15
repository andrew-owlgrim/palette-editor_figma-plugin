import type { ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import styles from './Popover.css'

interface PopoverProps {
  open: boolean
  onClose: () => void
  // Wrapper element containing both the trigger and the popover. Used so that
  // clicking the trigger does not count as an "outside" click. Typed with a
  // readonly `current` so any element ref (e.g. RefObject<HTMLDivElement>) fits.
  containerRef: { readonly current: HTMLElement | null }
  children: ComponentChildren
}

export function Popover({ open, onClose, containerRef, children }: PopoverProps) {
  useEffect(() => {
    if (open === false) return
    function handlePointerDown(event: MouseEvent) {
      const container = containerRef.current
      if (container !== null && container.contains(event.target as Node) === false) {
        onClose()
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, containerRef])

  if (open === false) return null
  return <div class={styles.popover}>{children}</div>
}
