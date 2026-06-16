import styles from './Handle.css'

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
}

export function Handle({ x, y, draggable = false, color }: HandleProps) {
  const className = draggable === true ? `${styles.handle} ${styles.draggable}` : styles.handle
  return (
    <div class={className} style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      {draggable === true && color !== undefined ? (
        <div class={styles.sample} style={{ backgroundColor: color }} />
      ) : null}
    </div>
  )
}
