import type { ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { createPortal } from 'preact/compat'
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
  // For the CSS-anchored default (no `anchorRef`): which container edge to align
  // the popover to. 'right' (default) keeps the existing below-right behavior;
  // 'left' anchors below-left (used by a trigger sitting at the window's left).
  align?: 'left' | 'right'
  children: ComponentChildren
}

export function Popover({
  open,
  onClose,
  containerRef,
  anchorRef,
  placement = 'right-top',
  offset = 8,
  align = 'right',
  children,
}: PopoverProps) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open === false) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      const container = containerRef.current
      const popover = popoverRef.current
      // The floating variant is portaled out of `containerRef` (see below), so a
      // click inside it would otherwise read as "outside" and close the popover.
      const inside =
        (container !== null && container.contains(target)) ||
        (popover !== null && popover.contains(target))
      if (!inside) onClose()
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
    // Portaled to <body> so it lives in the root stacking context — otherwise an
    // OverlayScrollbars viewport (or any positioned/`contain` ancestor) would trap
    // it and let sibling scrollbars/content paint over it. Always rendered so it
    // can be measured; kept invisible (but laid out) until positioned.
    return createPortal(
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
      </div>,
      document.body,
    )
  }
  return (
    <div class={styles.popover} style={align === 'left' ? { left: 0, right: 'auto' } : undefined}>
      {children}
    </div>
  )
}
