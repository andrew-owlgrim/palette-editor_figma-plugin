import {
  arrow,
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type Placement,
} from '@floating-ui/dom'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import styles from './Tooltip.css'

// Tooltips appear only after a deliberate hover dwell, not instantly.
const SHOW_DELAY_MS = 1000
// Arrow square side (px). The visible tip is half of it (the square overlaps the
// bubble by 50%); the diagonal half-width drives how far we push the bubble off.
const ARROW_SIZE = 8
const ARROW_OFFSET = Math.sqrt(2 * ARROW_SIZE ** 2) / 2 + 2

const OPPOSITE_SIDE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const

interface TooltipProps {
  // Plain text, or rich content (e.g. a bold hex over a hint line).
  content: ComponentChildren
  // Preferred side. `flip`/`shift` move it automatically when it would overflow.
  placement?: Placement
  // Hover dwell before showing (ms). Override for snappier surfaces.
  delay?: number
  // Make the trigger span a block that fills its parent (instead of the default
  // inline-flex hug) — needed when the wrapped child is a grid/flex item that
  // must stretch to its cell (e.g. a shade swatch).
  block?: boolean
  // Single trigger (e.g. an IconButton), wrapped in an inline-flex span that is
  // both the positioning reference and the event surface — so it works even when
  // the trigger is `disabled` (the CSS neutralizes the inert child's events).
  children: ComponentChildren
}

export function Tooltip({
  content,
  placement = 'bottom',
  delay = SHOW_DELAY_MS,
  block = false,
  children,
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLDivElement>(null)
  // Set on press to make the current hover one-shot: the bubble stays dismissed
  // until the cursor actually leaves the trigger and returns. Cleared only on a
  // genuine leave, so a spurious re-enter under a still cursor (e.g. the button
  // toggling `disabled`) can't re-pop it.
  const suppressedRef = useRef(false)

  // Two independent reasons the bubble is visible, OR-combined: a hover (gated
  // behind a dwell delay) and keyboard focus (immediate). `positioned` gates the
  // first paint until floating-ui has placed it.
  const [hovering, setHovering] = useState(false)
  const [hoverShown, setHoverShown] = useState(false)
  const [focusShown, setFocusShown] = useState(false)
  const [positioned, setPositioned] = useState(false)
  const open = hoverShown || focusShown

  // Hover lifecycle. The robust "the cursor left" signal is a global
  // `pointermove` whose target is no longer inside the trigger: moving the mouse
  // is the only way to leave, and `pointermove` is reliable where `pointerleave`
  // and `:hover` matching are not in the plugin iframe. So a fast pass cancels
  // the pending show before it fires, and a shown bubble hides on the first move
  // away — neither depends on `pointerleave`.
  useEffect(() => {
    if (hovering === false) {
      setHoverShown(false)
      return
    }
    const timer = setTimeout(() => {
      if (suppressedRef.current === false) setHoverShown(true)
    }, delay)
    function leave() {
      // A real leave both re-arms a fresh hover and lifts a click's suppression.
      suppressedRef.current = false
      setHovering(false)
    }
    function onPointerMove(event: PointerEvent) {
      const trigger = triggerRef.current
      if (trigger != null && trigger.contains(event.target as Node) === false) {
        leave()
      }
    }
    document.addEventListener('pointermove', onPointerMove)
    // Cursor left the plugin window without a move event.
    window.addEventListener('blur', leave)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('blur', leave)
    }
  }, [hovering, delay])

  // Position while open and keep it positioned (scroll/resize) via autoUpdate.
  // `strategy: 'fixed'` lets it escape card overflow. `computePosition` is async,
  // so the bubble paints at its CSS default (0,0) for one frame before the
  // promise places it — kept hidden via `positioned` until then, and reset when
  // closed so the next open doesn't flash at the old/default spot.
  useEffect(() => {
    if (open === false) {
      setPositioned(false)
      return
    }
    const trigger = triggerRef.current
    const floating = floatingRef.current
    const arrowEl = arrowRef.current
    if (trigger == null || floating == null) return

    function update() {
      computePosition(trigger!, floating!, {
        placement,
        strategy: 'fixed',
        middleware: [
          offset(ARROW_OFFSET),
          flip({ padding: 8 }),
          shift({ padding: 8 }),
          arrow({ element: arrowEl!, padding: 6 }),
        ],
      }).then(({ x, y, placement: finalPlacement, middlewareData }) => {
        floating!.style.left = `${x}px`
        floating!.style.top = `${y}px`

        const arrowData = middlewareData.arrow
        if (arrowEl != null && arrowData != null) {
          const side = finalPlacement.split('-')[0] as keyof typeof OPPOSITE_SIDE
          arrowEl.style.left = arrowData.x == null ? '' : `${arrowData.x}px`
          arrowEl.style.top = arrowData.y == null ? '' : `${arrowData.y}px`
          arrowEl.style.right = ''
          arrowEl.style.bottom = ''
          arrowEl.style[OPPOSITE_SIDE[side]] = `${-ARROW_SIZE / 2}px`
        }
        setPositioned(true)
      })
    }

    return autoUpdate(trigger, floating, update)
  }, [open, placement])

  return (
    <span
      ref={triggerRef}
      class={block ? `${styles.trigger} ${styles.block}` : styles.trigger}
      onPointerEnter={() => setHovering(true)}
      // A press dismisses and suppresses this hover; only a real leave + re-enter
      // shows it again. `hovering` stays true so the leave guard keeps watching.
      onPointerDown={() => {
        suppressedRef.current = true
        setHoverShown(false)
      }}
      // Keyboard focus reveals it immediately; ignore focus from a pointer press
      // (no `:focus-visible`) so a click doesn't re-pop it.
      onFocusIn={(event) => {
        if ((event.target as HTMLElement).matches(':focus-visible')) setFocusShown(true)
      }}
      onFocusOut={() => setFocusShown(false)}
    >
      {children}
      {open ? (
        <div
          ref={floatingRef}
          class={styles.tooltip}
          role="tooltip"
          style={{ visibility: positioned ? 'visible' : 'hidden' }}
        >
          {content}
          <div ref={arrowRef} class={styles.arrow} />
        </div>
      ) : null}
    </span>
  )
}
