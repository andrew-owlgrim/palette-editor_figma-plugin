import type { ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import styles from './Popover.css'

type AnchorRef = { readonly current: HTMLElement | null }

// Preferred placement: right edge of the anchor → left edge of the popover, tops
// aligned, nudged out by `offset`. Flips to the left side automatically when it
// would overflow the right edge of the window (right-top → left-top).
type Placement = 'right-top'

// Keep the popover at least this far from the window edges.
const VIEWPORT_MARGIN = 8

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
  const popoverRef = useRef<HTMLDivElement>(null)

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
      const popover = popoverRef.current
      if (anchor == null || popover == null) return
      const rect = anchor.getBoundingClientRect()
      const { width, height } = popover.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight

      // Horizontal: prefer the right side; flip to the left when it would
      // overflow, then clamp so it never leaves the window.
      let left = rect.right + offset
      if (left + width + VIEWPORT_MARGIN > viewportWidth) {
        const flipped = rect.left - offset - width
        left = flipped >= VIEWPORT_MARGIN ? flipped : viewportWidth - width - VIEWPORT_MARGIN
      }
      left = Math.max(VIEWPORT_MARGIN, left)

      // Vertical: top-aligned with the anchor, clamped into the window.
      let top = rect.top
      if (top + height + VIEWPORT_MARGIN > viewportHeight) {
        top = viewportHeight - height - VIEWPORT_MARGIN
      }
      top = Math.max(VIEWPORT_MARGIN, top)

      setPosition({ left, top })
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
  if (anchorRef != null) {
    // Always rendered so it can be measured; kept invisible (but laid out) until
    // its position is computed, to avoid a flash at the wrong spot.
    return (
      <div
        ref={popoverRef}
        class={styles.floating}
        style={{
          left: `${position?.left ?? 0}px`,
          top: `${position?.top ?? 0}px`,
          visibility: position === null ? 'hidden' : 'visible',
        }}
      >
        {children}
      </div>
    )
  }
  return <div class={styles.popover}>{children}</div>
}
