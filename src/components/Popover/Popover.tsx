import type { ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useState } from 'preact/hooks'
import styles from './Popover.css'

type AnchorRef = { readonly current: HTMLElement | null }

// Right edge of the anchor → left edge of the popover, tops aligned, then nudged
// out by `offset`. (Room for more placements later if needed.)
type Placement = 'right-top'

interface PopoverProps {
  open: boolean
  onClose: () => void
  // Wrapper element containing both the trigger and the popover. Used so that
  // clicking the trigger does not count as an "outside" click. Typed with a
  // readonly `current` so any element ref (e.g. RefObject<HTMLDivElement>) fits.
  containerRef: AnchorRef
  // When provided, the popover is positioned (fixed) relative to this element
  // using `placement`. Without it, it falls back to the CSS-anchored default
  // (below-right of a relatively-positioned container).
  anchorRef?: AnchorRef
  placement?: Placement
  offset?: number
  children: ComponentChildren
}

export function Popover({
  open,
  onClose,
  containerRef,
  anchorRef,
  placement = 'right-top',
  offset = 8,
  children,
}: PopoverProps) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

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

  useLayoutEffect(() => {
    if (open === false || anchorRef?.current == null) {
      setPosition(null)
      return
    }
    function compute() {
      const anchor = anchorRef?.current
      if (anchor == null) return
      const rect = anchor.getBoundingClientRect()
      // placement === 'right-top'
      setPosition({ left: rect.right + offset, top: rect.top })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open, anchorRef, placement, offset])

  if (open === false) return null
  if (position !== null) {
    return (
      <div class={styles.floating} style={{ left: `${position.left}px`, top: `${position.top}px` }}>
        {children}
      </div>
    )
  }
  return <div class={styles.popover}>{children}</div>
}
