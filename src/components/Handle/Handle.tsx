import styles from './Handle.css'

// Rendered sizes (px). Exported so a track that insets its handles by the radius
// can map pointer ↔ position with the same geometry (see GradientEditor).
export const DRAGGABLE_HANDLE_SIZE = 20
export const HANDLE_SIZE = 10

interface HandleProps {
  // Position as a fraction (0..1) of the parent box; centered on the point.
  x: number
  y: number
  // Draggable handle (white ring with a color sample inside) vs. a plain white
  // dot used to mark other key colors. Dragging itself is owned by the parent
  // track, so this component is purely visual.
  draggable?: boolean
  // Sample color shown in the center of a draggable handle.
  color?: string
  // Inset the handle by its radius so a handle at 0/1 sits with its outer edge on
  // the track edge instead of overflowing. The track must use the matching
  // pointer↔position mapping. Off by default (2D wheels position freely).
  inset?: boolean
}

// Map a 0..1 fraction to a CSS position. With `inset`, the usable span is shrunk
// by the handle size and offset by its radius, so the centered handle's outer
// edge lands on the track edge at the extremes.
function axis(fraction: number, size: number, inset: boolean): string {
  if (inset === false) return `${fraction * 100}%`
  return `calc(${fraction} * (100% - ${size}px) + ${size / 2}px)`
}

export function Handle({ x, y, draggable = false, color, inset = false }: HandleProps) {
  const size = draggable === true ? DRAGGABLE_HANDLE_SIZE : HANDLE_SIZE
  const className = draggable === true ? `${styles.handle} ${styles.draggable}` : styles.handle
  return (
    <div class={className} style={{ left: axis(x, size, inset), top: axis(y, size, inset) }}>
      {draggable === true && color !== undefined ? (
        <div class={styles.sample} style={{ backgroundColor: color }} />
      ) : null}
    </div>
  )
}
