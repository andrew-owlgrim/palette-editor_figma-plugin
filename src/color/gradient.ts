import { converter, interpolate } from 'culori'
import type { Color } from 'culori'
import { colorToChannels, colorToHex } from '@/color/models'
import type {
  BlendingColorModel,
  ColorChannels,
  GradientStop,
  InputColorModel,
  PaletteColor,
  ToneAxisDirection,
} from '@/types'

const toOklch = converter('oklch')
const toLch = converter('lch')
const toHsl = converter('hsl')
const toRgb = converter('rgb')

// Default gradient endpoints. The dark end is NOT pure black: the bottom OKLab
// range is perceptually indistinguishable, so default to a neutral gray at this
// OKLab lightness to cut that dead zone off the generated ramp. Tune freely —
// 0.15 ≈ #0b0b0b, 0.20 ≈ #161616, 0.25 ≈ #222222. (ADR-022)
const DARK_ENDPOINT_L = 0.15
const WHITE: Color = { mode: 'rgb', r: 1, g: 1, b: 1 }
const DARK: Color = toRgb({ mode: 'oklch', l: DARK_ENDPOINT_L, c: 0, h: 0 })

const BLENDING_MODE: Record<BlendingColorModel, 'rgb' | 'hsl' | 'oklch' | 'lch'> = {
  rgb: 'rgb',
  hsl: 'hsl',
  oklch: 'oklch',
  lch: 'lch',
}

let stopIdCounter = 0
export function newStopId(): string {
  stopIdCounter += 1
  // Random tail for cross-instance uniqueness (see newId in store/index.ts).
  return `gs_${Date.now().toString(36)}_${stopIdCounter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`
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

// Lightness (0..1) of a color in the BLENDING model — the metric that places an
// auto stop on the tone axis, so the axis matches the space shades blend in:
// rgb/hsl → HSL L = (max+min)/2, oklch → OKLab L, lch → CIE L*. OKLab lifts the
// dark range hard; LCH (CIE L*) is the perceptual-without-dark-lift option. (ADR-022)
export function modelLightness(color: Color, blending: BlendingColorModel): number {
  switch (blending) {
    case 'oklch':
      return clamp01(toOklch(color).l ?? 0)
    case 'lch':
      return clamp01((toLch(color).l ?? 0) / 100)
    default:
      return clamp01(toHsl(color).l ?? 0)
  }
}

// Where an auto stop sits for a color, given the tone direction + blending model:
// light-dark puts a light color near step 0, dark-light reverses it. Used for
// every stop whose `autoPosition` is true (the default), so its position follows
// its color in the active blending model's lightness.
//
// The lightness is normalized to the gradient's actual span [DARK_ENDPOINT_L, 1]
// (not [0, 1]): the dark end is a near-black, not pure black, so a color as dark
// as the dark endpoint maps to the very end (0) rather than leaving a gap.
export function keyStopPosition(
  color: Color,
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
): number {
  const lo = modelLightness(DARK, blending)
  const span = 1 - lo
  const raw = span <= 0 ? 0 : (modelLightness(color, blending) - lo) / span
  const n = clamp01(raw)
  return clamp01(direction === 'light-dark' ? 1 - n : n)
}

// Build a stop with its derived channel buffer. `autoPosition` stops get their
// position from the color's lightness (in the blending model); manual stops keep
// the passed `position`.
export function makeStop(
  color: Color,
  position: number,
  autoPosition: boolean,
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
  model: InputColorModel,
): GradientStop {
  return {
    id: newStopId(),
    position: autoPosition ? keyStopPosition(color, direction, blending) : clamp01(position),
    color,
    autoPosition,
    channels: colorToChannels(color, model),
  }
}

// Default gradient for a fresh key color: a near-black (DARK) and white endpoint
// with the key color placed between them at its lightness. Tone direction decides
// which endpoint is at position 0. Endpoints are PINNED at the scale ends (manual)
// so the dark end stays at 0/1 rather than following its DARK_ENDPOINT_L lightness;
// only the key stop is auto-positioned.
export function buildDefaultStops(
  color: Color,
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
  model: InputColorModel,
): { stops: GradientStop[]; keyStopId: string } {
  const lightDark = direction === 'light-dark'
  const start = makeStop(lightDark ? WHITE : DARK, 0, false, direction, blending, model)
  const end = makeStop(lightDark ? DARK : WHITE, 1, false, direction, blending, model)
  const key = makeStop(color, 0, true, direction, blending, model)
  return { stops: sortStops([start, key, end]), keyStopId: key.id }
}

// Endpoints = the lowest- and highest-positioned stops. They anchor the scale
// ends; they can't be deleted (but can be recolored / toggled auto).
function endpointIds(stops: GradientStop[]): Set<string> {
  const sorted = sortStops(stops)
  return new Set([sorted[0]?.id, sorted[sorted.length - 1]?.id].filter((id) => id !== undefined))
}

// A stop can be deleted unless it's an endpoint or the key stop.
export function canDeleteStop(pc: PaletteColor, stopId: string): boolean {
  if (stopId === pc.keyStopId) return false
  return endpointIds(pc.stops).has(stopId) === false
}

// Hard cap on a gradient's stop count (incl. the two endpoints + key stop). Keeps
// a ramp legible; once reached, pressing empty track no longer adds a stop.
export const MAX_STOPS = 7

// Whether another stop may be added (below the cap).
export function canAddStop(pc: PaletteColor): boolean {
  return pc.stops.length < MAX_STOPS
}

// Set one stop's color (+ its typed channel buffer) and, if it's auto-positioned,
// reposition it by the new color's lightness; then re-sort. Used by every color
// edit (channel / hex / wheel) on any stop, key or not.
export function setStopColor(
  pc: PaletteColor,
  stopId: string,
  color: Color,
  channels: ColorChannels,
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
): GradientStop[] {
  return sortStops(
    pc.stops.map((s) =>
      s.id === stopId
        ? {
            ...s,
            color,
            channels,
            position: s.autoPosition ? keyStopPosition(color, direction, blending) : s.position,
          }
        : s,
    ),
  )
}

// Add a stop at `position`, sampling its color from the current gradient there.
// New stops are manual (pinned where the user dropped them). Returns the new
// stop id so the caller can keep dragging / select it.
export function addStop(
  pc: PaletteColor,
  position: number,
  blending: BlendingColorModel,
  model: InputColorModel,
): { stops: GradientStop[]; stopId: string } {
  const at = clamp01(position)
  const color = buildGradientSampler(pc.stops, blending)(at)
  // Manual stop — `direction`/`blending` don't affect its pinned position.
  const stop = makeStop(color, at, false, 'light-dark', blending, model)
  return { stops: sortStops([...pc.stops, stop]), stopId: stop.id }
}

export function removeStop(pc: PaletteColor, stopId: string): GradientStop[] {
  return pc.stops.filter((s) => s.id !== stopId)
}

// Pin a stop to `position` (a drag). Switches it to manual and re-sorts.
export function setStopPosition(
  pc: PaletteColor,
  stopId: string,
  position: number,
): GradientStop[] {
  return sortStops(
    pc.stops.map((s) =>
      s.id === stopId ? { ...s, position: clamp01(position), autoPosition: false } : s,
    ),
  )
}

// Toggle a stop's auto-position. Turning auto ON snaps it back onto the tone axis
// at its color's lightness; turning it OFF freezes the current position.
export function setStopAutoPosition(
  pc: PaletteColor,
  stopId: string,
  auto: boolean,
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
): GradientStop[] {
  return sortStops(
    pc.stops.map((s) =>
      s.id === stopId
        ? {
            ...s,
            autoPosition: auto,
            position: auto ? keyStopPosition(s.color, direction, blending) : s.position,
          }
        : s,
    ),
  )
}

// Recompute every auto stop's position for the current direction + blending
// model (manual stops untouched). Applied when the blending model changes, since
// position is derived from that model's lightness.
export function repositionAutoStops(
  stops: GradientStop[],
  direction: ToneAxisDirection,
  blending: BlendingColorModel,
): GradientStop[] {
  return sortStops(
    stops.map((s) =>
      s.autoPosition ? { ...s, position: keyStopPosition(s.color, direction, blending) } : s,
    ),
  )
}

// Re-derive every stop's channel buffer into `model` (on an input-model switch).
// The canonical colors are untouched, so the switch is lossless/reversible.
export function rederiveChannels(stops: GradientStop[], model: InputColorModel): GradientStop[] {
  return stops.map((s) => ({ ...s, channels: colorToChannels(s.color, model) }))
}

// Mirror every stop across the axis midpoint (position -> 1 - position). Applied
// when the tone direction flips, so the gradient visually reverses. (Auto stops
// land where keyStopPosition would put them under the new direction anyway.)
export function mirrorStops(stops: GradientStop[]): GradientStop[] {
  return sortStops(stops.map((s) => ({ ...s, position: clamp01(1 - s.position) })))
}

// A tint this faint (rgb max−min, ~3/255) reads as gray and rounds to 0 in the UI
// channels — but its leftover micro-chroma still carries a definite hue. We treat
// such stops as truly achromatic when blending so a phantom hue can't tint the
// ramp.
const ACHROMATIC_EPS = 0.012

function isAchromatic(color: Color): boolean {
  const c = toRgb(color)
  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < ACHROMATIC_EPS
}

// Build a sampler `(u: 0..1) -> Color` over the gradient, blending adjacent stops
// in the configured color model. culori interpolate takes the stop positions
// directly as `[color, position]` tuples (non-uniform domain). Build once per
// palette color, then sample at each shade step.
//
// Near-gray stops get their hue dropped (set undefined) so culori carries the
// adjacent chromatic stop's hue across them instead of interpolating toward a
// phantom hue — otherwise an imperceptible micro-chroma shifts the dark shades.
export function buildGradientSampler(
  stops: GradientStop[],
  blending: BlendingColorModel,
): (u: number) => Color {
  const mode = BLENDING_MODE[blending]
  const sorted = sortStops(stops)
  if (sorted.length === 1) {
    const only = sorted[0].color
    return () => only
  }
  const toMode = converter(mode)
  const points = sorted.map((s) => {
    const color = toMode(s.color)
    if (mode !== 'rgb' && isAchromatic(s.color)) {
      return [{ ...color, h: undefined }, s.position] as [Color, number]
    }
    return [color as Color, s.position] as [Color, number]
  })
  const fn = interpolate(points, mode)
  return (u: number) => fn(clamp01(u)) as Color
}

export function sampleGradient(
  stops: GradientStop[],
  u: number,
  blending: BlendingColorModel,
): Color {
  return buildGradientSampler(stops, blending)(u)
}

// CSS `linear-gradient` painting the gradient for the editor track. Sampled at
// `samples` evenly-spaced points so the blending model (oklch/hsl) shows
// truthfully — a raw stop-list would let the browser interpolate in sRGB.
export function buildGradientCss(
  stops: GradientStop[],
  blending: BlendingColorModel,
  samples = 24,
): string {
  const sampler = buildGradientSampler(stops, blending)
  const parts: string[] = []
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples
    parts.push(`${colorToHex(sampler(u))} ${Math.round(u * 1000) / 10}%`)
  }
  return `linear-gradient(to right, ${parts.join(', ')})`
}
