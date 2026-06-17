import { converter, interpolate } from 'culori'
import type { Color } from 'culori'
import type { BlendingColorModel, GradientStop, PaletteColor, ToneAxisDirection } from '@/types'

const toOklch = converter('oklch')

const WHITE: Color = { mode: 'rgb', r: 1, g: 1, b: 1 }
const BLACK: Color = { mode: 'rgb', r: 0, g: 0, b: 0 }

const BLENDING_MODE: Record<BlendingColorModel, 'rgb' | 'hsl' | 'oklch'> = {
  rgb: 'rgb',
  hsl: 'hsl',
  oklch: 'oklch',
}

let stopIdCounter = 0
export function newStopId(): string {
  stopIdCounter += 1
  return `gs_${Date.now().toString(36)}_${stopIdCounter.toString(36)}`
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

export function sortStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position)
}

// The key stop = the named seed color of a palette color.
export function keyStopOf(pc: PaletteColor): GradientStop {
  return pc.stops.find((s) => s.id === pc.keyStopId) ?? pc.stops[0]
}

export function keyColorOf(pc: PaletteColor): Color {
  return keyStopOf(pc).color
}

// OKLch lightness (0..1, perceptual) — places the key stop on the tone axis.
export function oklchLightness(color: Color): number {
  return clamp01(toOklch(color).l ?? 0)
}

// Where the key stop sits for a color, given the tone direction. The position is
// a rewritable default that follows the color's lightness (until a future editor
// detaches it): light-dark puts a light color near step 0, dark-light reverses it.
export function keyStopPosition(color: Color, direction: ToneAxisDirection): number {
  const l = oklchLightness(color)
  return clamp01(direction === 'light-dark' ? 1 - l : l)
}

// Default gradient for a fresh key color: black & white endpoints with the key
// color placed between them at its lightness. Tone direction decides which
// endpoint is at position 0.
export function buildDefaultStops(
  color: Color,
  direction: ToneAxisDirection,
): { stops: GradientStop[]; keyStopId: string } {
  const lightDark = direction === 'light-dark'
  const keyId = newStopId()
  const start: GradientStop = { id: newStopId(), position: 0, color: lightDark ? WHITE : BLACK }
  const end: GradientStop = { id: newStopId(), position: 1, color: lightDark ? BLACK : WHITE }
  const key: GradientStop = { id: keyId, position: keyStopPosition(color, direction), color }
  return { stops: sortStops([start, key, end]), keyStopId: keyId }
}

// Set the key stop's color and reposition it by the new color's lightness, then
// re-sort. Used by every key-color edit (channel/hex/reroll) while the position
// is still an auto default.
export function setKeyColor(
  pc: PaletteColor,
  color: Color,
  direction: ToneAxisDirection,
): GradientStop[] {
  const position = keyStopPosition(color, direction)
  return sortStops(pc.stops.map((s) => (s.id === pc.keyStopId ? { ...s, color, position } : s)))
}

// Mirror every stop across the axis midpoint (position -> 1 - position). Applied
// when the tone direction flips, so the gradient visually reverses.
export function mirrorStops(stops: GradientStop[]): GradientStop[] {
  return sortStops(stops.map((s) => ({ ...s, position: clamp01(1 - s.position) })))
}

// Build a sampler `(u: 0..1) -> Color` over the gradient, blending adjacent stops
// in the configured color model. culori interpolate takes the stop positions
// directly as `[color, position]` tuples (non-uniform domain). Build once per
// palette color, then sample at each shade step.
export function buildGradientSampler(
  stops: GradientStop[],
  blending: BlendingColorModel,
): (u: number) => Color {
  const sorted = sortStops(stops)
  if (sorted.length === 1) {
    const only = sorted[0].color
    return () => only
  }
  const fn = interpolate(
    sorted.map((s) => [s.color, s.position] as [Color, number]),
    BLENDING_MODE[blending],
  )
  return (u: number) => fn(clamp01(u)) as Color
}

export function sampleGradient(
  stops: GradientStop[],
  u: number,
  blending: BlendingColorModel,
): Color {
  return buildGradientSampler(stops, blending)(u)
}
