import { Handle } from '@/components/Handle/Handle'
import { usePointerDrag } from '@/hooks/usePointerDrag'
import { hueRadiusToXY, WHEEL_CONIC_FROM_DEG, xyToHueRadius } from '@/color/picker'
import styles from './HueWheel.css'

export interface WheelDot {
  id: string
  hue: number
  radius01: number
  color: string
}

interface HueWheelProps {
  hue: number
  radius01: number
  color: string
  // Other key colors, drawn as static white dots.
  dots: WheelDot[]
  onChange: (hue: number, radius01: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

// Conic hue ring; the `from` angle matches the handle math (see picker.ts).
const HUE_CONIC = `conic-gradient(from ${WHEEL_CONIC_FROM_DEG}deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))`
// White-to-transparent overlay gives the center-to-edge saturation falloff.
const SATURATION_OVERLAY = 'radial-gradient(circle at center, #fff 0%, transparent 70%)'

export function HueWheel({
  hue,
  radius01,
  color,
  dots,
  onChange,
  onDragStart,
  onDragEnd,
}: HueWheelProps) {
  const { ref, onPointerDown } = usePointerDrag({
    onMove: ({ x, y }) => {
      const next = xyToHueRadius(x, y)
      onChange(next.hue, next.radius01)
    },
    onStart: onDragStart,
    onEnd: onDragEnd,
  })

  const active = hueRadiusToXY(hue, radius01)

  return (
    <div
      ref={ref}
      class={styles.wheel}
      style={{ backgroundImage: `${SATURATION_OVERLAY}, ${HUE_CONIC}` }}
      onPointerDown={onPointerDown}
    >
      {dots.map((dot) => {
        const point = hueRadiusToXY(dot.hue, dot.radius01)
        return <Handle key={dot.id} x={point.x} y={point.y} />
      })}
      <Handle x={active.x} y={active.y} draggable color={color} />
    </div>
  )
}
