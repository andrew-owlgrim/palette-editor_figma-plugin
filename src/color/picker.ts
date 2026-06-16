// Polar geometry for the hue wheel + helpers to map raw channel strings onto
// the picker axes (angle / radius / lightness). Pure functions, no rendering.

import { channelsToHex, colorToHex, formatChannel, MODELS } from '@/color/models'
import type { ColorChannels, InputColorModel } from '@/types'

// Rotates the wheel so hue 0° sits strictly to the right (east / 3 o'clock),
// with hue increasing clockwise. The same offset drives both the conic-gradient
// background and the handle math, so a handle always sits on the hue it
// represents. (90° = east measured clockwise from the geometry's north origin.)
export const ANGLE_OFFSET_DEG = 90

// `from` angle for the CSS conic-gradient background, derived from the offset so
// the painted hue matches handle positions exactly.
export const WHEEL_CONIC_FROM_DEG = ANGLE_OFFSET_DEG

function num(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

export interface Point {
  x: number
  y: number
}

// (hue 0..360, radius 0..1) → position as fractions of the wheel box (0..1),
// with the center at (0.5, 0.5). Clockwise from top.
export function hueRadiusToXY(hue: number, radius01: number): Point {
  const theta = ((hue + ANGLE_OFFSET_DEG) * Math.PI) / 180
  const r = Math.max(0, Math.min(1, radius01)) * 0.5
  return { x: 0.5 + r * Math.sin(theta), y: 0.5 - r * Math.cos(theta) }
}

// Inverse: a position fraction (0..1) within the wheel box → (hue, radius 0..1).
// Radius is clamped to the unit circle; hue normalized to [0, 360).
export function xyToHueRadius(x: number, y: number): { hue: number; radius01: number } {
  const dx = x - 0.5
  const dy = y - 0.5
  const radius01 = Math.min(1, Math.hypot(dx, dy) / 0.5)
  let hue = (Math.atan2(dx, -dy) * 180) / Math.PI - ANGLE_OFFSET_DEG
  hue = ((hue % 360) + 360) % 360
  return { hue, radius01 }
}

function channelDef(model: InputColorModel, id: string) {
  const def = MODELS[model].channels.find((c) => c.id === id)
  if (def === undefined) throw new Error(`Unknown channel ${id} for model ${model}`)
  return def
}

// Read the polar position of a color from its raw channels.
export function channelsToWheel(
  channels: ColorChannels,
  model: InputColorModel,
): { hue: number; radius01: number } {
  const { angle, radius } = MODELS[model].picker
  const radiusMax = channelDef(model, radius).maximum
  return { hue: num(channels[angle]), radius01: num(channels[radius]) / radiusMax }
}

// Write a polar wheel position back into the angle + radius channel strings.
export function wheelToChannels(
  hue: number,
  radius01: number,
  model: InputColorModel,
): ColorChannels {
  const { angle, radius } = MODELS[model].picker
  const angleDef = channelDef(model, angle)
  const radiusDef = channelDef(model, radius)
  return {
    [angle]: formatChannel(hue, angleDef),
    [radius]: formatChannel(radius01 * radiusDef.maximum, radiusDef),
  }
}

// The lightness/value axis as a 0..1 position for the gradient slider.
export function channelsToAxis(channels: ColorChannels, model: InputColorModel): number {
  const def = channelDef(model, MODELS[model].picker.axis)
  const value = num(channels[def.id])
  return (value - def.minimum) / (def.maximum - def.minimum)
}

// Convert a 0..1 gradient position back into the axis channel string.
export function axisToChannel(t: number, model: InputColorModel): { id: string; value: string } {
  const def = channelDef(model, MODELS[model].picker.axis)
  const value = def.minimum + t * (def.maximum - def.minimum)
  return { id: def.id, value: formatChannel(value, def) }
}

// CSS conic-gradient for the hue ring, painted in the ACTIVE model's hue scale
// (LCH hue ≠ HSL hue, so a static HSL ring would mislabel LCH colors). Samples
// the model's fully-saturated `hueRingColor` every 15° (gamut-mapped to hex);
// `from` matches the handle geometry so the painted hue sits under its handle.
export function buildHueWheelConic(model: InputColorModel): string {
  const steps = 24
  const stops: string[] = []
  for (let i = 0; i <= steps; i += 1) {
    const hue = (i / steps) * 360
    stops.push(`${colorToHex(MODELS[model].hueRingColor(hue))} ${Math.round(hue)}deg`)
  }
  return `conic-gradient(from ${WHEEL_CONIC_FROM_DEG}deg, ${stops.join(', ')})`
}

// CSS linear-gradient for the axis track: sample the color at N points along the
// axis (hue + radius held fixed) and convert each to hex. Accurate for every
// model (hsl L: black→color→white, hsv V: black→color, lch L: black→color→white).
export function buildAxisGradient(channels: ColorChannels, model: InputColorModel): string {
  const def = channelDef(model, MODELS[model].picker.axis)
  const steps = 8
  const stops: string[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const value = def.minimum + t * (def.maximum - def.minimum)
    const hex = channelsToHex({ ...channels, [def.id]: formatChannel(value, def) }, model)
    stops.push(`${hex} ${Math.round(t * 100)}%`)
  }
  return `linear-gradient(to right, ${stops.join(', ')})`
}
