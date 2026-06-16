import { converter, formatHex, parse, toGamut } from 'culori'
import type { Color } from 'culori'
import type { ColorChannels, InputColorModel } from '@/types'

const toHsl = converter('hsl')
const toHsv = converter('hsv')
const toLch = converter('lch')

// HSL/HSV are sRGB-based and cannot represent wide-gamut colors. Map any color
// into the sRGB gamut (CSS Color 4 algorithm, chroma reduction in OKLCH) before
// reading hsl/hsv. Using toGamut (not clampChroma/clampRgb) also snaps near-white
// /near-black to exact rgb, avoiding floating-point dust that would otherwise
// blow up the numerically-unstable HSL saturation at extreme lightness.
const toSrgb = toGamut('rgb', 'oklch')

export interface ChannelDef {
  id: string
  label: string
  minimum: number
  maximum: number
  integer?: boolean
}

// Maps the three channels of a model onto the polar color-picker axes:
// `angle` = hue (wheel angle), `radius` = saturation/chroma (center → edge),
// `axis` = lightness/value (the 1D gradient slider). Lets the picker stay
// model-agnostic — it reads/writes channels by role, not by hard-coded id.
export interface PickerAxes {
  angle: string
  radius: string
  axis: string
}

export interface ColorModelDef {
  id: InputColorModel
  channels: ChannelDef[]
  picker: PickerAxes
  toChannels: (color: Color) => ColorChannels
  fromChannels: (channels: ColorChannels) => Color
}

function num(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : fallback
}

// Clamp into [min, max] then round — guarantees the displayed value never
// falls outside the channel's valid range.
function fmt(value: number, decimals: number, min: number, max: number): string {
  const clamped = Math.min(max, Math.max(min, value))
  const factor = 10 ** decimals
  return String(Math.round((clamped + Number.EPSILON) * factor) / factor)
}

export const MODELS: Record<InputColorModel, ColorModelDef> = {
  hsl: {
    id: 'hsl',
    channels: [
      { id: 'h', label: 'H', minimum: 0, maximum: 360, integer: true },
      { id: 's', label: 'S', minimum: 0, maximum: 100, integer: true },
      { id: 'l', label: 'L', minimum: 0, maximum: 100, integer: true },
    ],
    picker: { angle: 'h', radius: 's', axis: 'l' },
    toChannels(color) {
      const c = toHsl(toSrgb(color))
      return {
        h: fmt(c.h ?? 0, 0, 0, 360),
        s: fmt((c.s ?? 0) * 100, 0, 0, 100),
        l: fmt((c.l ?? 0) * 100, 0, 0, 100),
      }
    },
    fromChannels(ch) {
      return { mode: 'hsl', h: num(ch.h), s: num(ch.s) / 100, l: num(ch.l) / 100 }
    },
  },
  hsv: {
    id: 'hsv',
    channels: [
      { id: 'h', label: 'H', minimum: 0, maximum: 360, integer: true },
      { id: 's', label: 'S', minimum: 0, maximum: 100, integer: true },
      { id: 'v', label: 'V', minimum: 0, maximum: 100, integer: true },
    ],
    picker: { angle: 'h', radius: 's', axis: 'v' },
    toChannels(color) {
      const c = toHsv(toSrgb(color))
      return {
        h: fmt(c.h ?? 0, 0, 0, 360),
        s: fmt((c.s ?? 0) * 100, 0, 0, 100),
        v: fmt((c.v ?? 0) * 100, 0, 0, 100),
      }
    },
    fromChannels(ch) {
      return { mode: 'hsv', h: num(ch.h), s: num(ch.s) / 100, v: num(ch.v) / 100 }
    },
  },
  lch: {
    id: 'lch',
    channels: [
      { id: 'l', label: 'L', minimum: 0, maximum: 100, integer: true },
      { id: 'c', label: 'C', minimum: 0, maximum: 150 },
      { id: 'h', label: 'H', minimum: 0, maximum: 360, integer: true },
    ],
    picker: { angle: 'h', radius: 'c', axis: 'l' },
    toChannels(color) {
      const c = toLch(color)
      return {
        l: fmt(c.l ?? 0, 0, 0, 100),
        c: fmt(c.c ?? 0, 1, 0, 150),
        h: fmt(c.h ?? 0, 0, 0, 360),
      }
    },
    fromChannels(ch) {
      return { mode: 'lch', l: num(ch.l), c: num(ch.c), h: num(ch.h) }
    },
  },
}

// Clamp + round a numeric channel value into a display string honoring the
// channel's range and integer-ness. Used by the picker when a drag produces a
// raw numeric value that must become a channel string.
export function formatChannel(value: number, def: ChannelDef): string {
  return fmt(value, def.integer === true ? 0 : 1, def.minimum, def.maximum)
}

// Build a 6-digit hex from raw channels (naive sRGB clamp via formatHex).
export function channelsToHex(channels: ColorChannels, model: InputColorModel): string {
  return formatHex(MODELS[model].fromChannels(channels)) ?? '#000000'
}

// Parse a hex/CSS color into raw channels for the given model.
export function hexToChannels(hex: string, model: InputColorModel): ColorChannels {
  const color = parse(hex)
  if (typeof color === 'undefined') {
    return MODELS[model].toChannels({ mode: 'rgb', r: 0, g: 0, b: 0 })
  }
  return MODELS[model].toChannels(color)
}

// Re-express raw channels from one model into another (used on model switch).
export function recomputeChannels(
  channels: ColorChannels,
  from: InputColorModel,
  to: InputColorModel,
): ColorChannels {
  return MODELS[to].toChannels(MODELS[from].fromChannels(channels))
}
