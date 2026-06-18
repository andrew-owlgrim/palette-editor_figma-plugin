import { useLayoutEffect, useRef } from 'preact/hooks'
import { Handle } from '@/components/Handle/Handle'
import { usePointerDrag } from '@/hooks/usePointerDrag'
import { channelsToHue01, squareColorAt } from '@/color/picker'
import type { ColorChannels, InputColorModel } from '@/types'
import styles from './SquareField.css'

// Backing-canvas resolution. The bitmap is sample-painted at RES×RES then CSS-
// scaled to the element with the browser's default smoothing — a smooth,
// model-correct field (incl. LCH gamut mapping) at ~RES² culori conversions per
// hue change. Bump for crispness; repaint cost grows as RES².
const RES = 32

export interface SquareDot {
  id: string
  // Square position: x = radius fraction, y = axis fraction (both 0..1).
  x: number
  y: number
}

interface SquareFieldProps {
  // Active position: x = radius fraction, y = axis fraction (both 0..1).
  x: number
  y: number
  color: string
  // Current channels (only the hue is read — radius/axis ARE the square's axes)
  // + model, so the field paints itself in the active model's space.
  channels: ColorChannels
  model: InputColorModel
  // Other stops of the same palette color, drawn as static reference dots.
  dots: SquareDot[]
  onChange: (x: number, y: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

// A saturation/chroma (X) × lightness/value (Y) square with a hue held fixed.
// Y is inverted: the top edge is high lightness/value (axis = 1).
export function SquareField({
  x,
  y,
  color,
  channels,
  model,
  dots,
  onChange,
  onDragStart,
  onDragEnd,
}: SquareFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { ref, onPointerDown } = usePointerDrag({
    onMove: ({ x: px, y: py }) =>
      onChange(Math.max(0, Math.min(1, px)), Math.max(0, Math.min(1, 1 - py))),
    onStart: onDragStart,
    onEnd: onDragEnd,
  })

  // The field depends only on hue + model — radius/axis drags move the handle,
  // not the field — so repaint only when those change, not on every edit.
  const hue = channelsToHue01(channels, model)
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (canvas === null || ctx === null) return
    const image = ctx.createImageData(RES, RES)
    for (let j = 0; j < RES; j += 1) {
      // Row 0 is the top edge = axis 1 (high lightness/value).
      const ay = 1 - j / (RES - 1)
      for (let i = 0; i < RES; i += 1) {
        const hex = squareColorAt(channels, model, i / (RES - 1), ay)
        const offset = (j * RES + i) * 4
        image.data[offset] = Number.parseInt(hex.slice(1, 3), 16)
        image.data[offset + 1] = Number.parseInt(hex.slice(3, 5), 16)
        image.data[offset + 2] = Number.parseInt(hex.slice(5, 7), 16)
        image.data[offset + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  }, [hue, model])

  return (
    <div ref={ref} class={styles.field} onPointerDown={onPointerDown}>
      <canvas ref={canvasRef} width={RES} height={RES} class={styles.canvas} />
      {dots.map((dot) => (
        <Handle key={dot.id} x={dot.x} y={1 - dot.y} />
      ))}
      <Handle x={x} y={1 - y} draggable color={color} />
    </div>
  )
}
