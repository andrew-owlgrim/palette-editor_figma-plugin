import { Handle } from '@/components/Handle/Handle'
import { usePointerDrag } from '@/hooks/usePointerDrag'
import styles from './Gradient.css'

interface GradientProps {
  // Handle position as a fraction (0..1) of the track width.
  value: number
  // CSS background painted on the track (built by the consumer, e.g. an axis
  // gradient). Keeps this component generic — it owns the handle, not the color.
  gradient: string
  // Sample color shown inside the draggable handle.
  color: string
  onChange: (value: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

export function Gradient({
  value,
  gradient,
  color,
  onChange,
  onDragStart,
  onDragEnd,
}: GradientProps) {
  const { ref, onPointerDown } = usePointerDrag({
    onMove: ({ x }) => onChange(Math.max(0, Math.min(1, x))),
    onStart: onDragStart,
    onEnd: onDragEnd,
  })

  return (
    <div
      ref={ref}
      class={styles.track}
      style={{ backgroundImage: gradient }}
      onPointerDown={onPointerDown}
    >
      <Handle x={Math.max(0, Math.min(1, value))} y={0.5} draggable color={color} />
    </div>
  )
}
