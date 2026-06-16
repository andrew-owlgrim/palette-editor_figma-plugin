import { converter, formatHex, parse, toGamut } from 'culori'
import type { Color } from 'culori'
import type { ColorChannels, InputColorModel } from '@/types'

const toHsl = converter('hsl')
const toHsv = converter('hsv')
const toLch = converter('lch')
const toRgb = converter('rgb')

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
  // Fully-saturated color at a given hue (max radius/chroma, representative
  // lightness), used to paint the hue-wheel ring in THIS model's hue scale.
  // LCH hue ≠ HSL hue, so the ring must be model-specific to stay truthful.
  hueRingColor: (hue: number) => Color
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
    hueRingColor: (h) => ({ mode: 'hsl', h, s: 1, l: 0.5 }),
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
    hueRingColor: (h) => ({ mode: 'hsv', h, s: 1, v: 1 }),
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
    // Max chroma (rim) at a vivid representative L=55; gamut-mapped on paint.
    hueRingColor: (h) => ({ mode: 'lch', l: 55, c: 150, h }),
  },
}

// Clamp + round a numeric channel value into a display string honoring the
// channel's range and integer-ness. Used by the picker when a drag produces a
// raw numeric value that must become a channel string.
export function formatChannel(value: number, def: ChannelDef): string {
  return fmt(value, def.integer === true ? 0 : 1, def.minimum, def.maximum)
}

// Build a 6-digit hex from raw channels, gamut-mapped (not naively clamped) so
// out-of-sRGB colors reduce chroma toward the L-appropriate gray instead of
// clamping to a vivid color. Used by the picker to paint axis-gradient stops.
export function channelsToHex(channels: ColorChannels, model: InputColorModel): string {
  return formatHex(toSrgb(MODELS[model].fromChannels(channels))) ?? '#000000'
}

const BLACK: Color = { mode: 'rgb', r: 0, g: 0, b: 0 }

// --- Canonical color (source of truth) <-> derived views -------------------
// The canonical color lives in float `rgb` mode and is left UNCLAMPED, so a
// wide-gamut color (e.g. high-chroma LCH) is preserved as extended sRGB and a
// later model switch can reconstruct it losslessly.

// Raw channels (in `model`) -> canonical rgb color.
export function channelsToColor(channels: ColorChannels, model: InputColorModel): Color {
  return toRgb(MODELS[model].fromChannels(channels))
}

// Canonical color -> raw channels for `model` (hsl/hsv gamut-map internally).
export function colorToChannels(color: Color, model: InputColorModel): ColorChannels {
  return MODELS[model].toChannels(color)
}

// Canonical color -> 6-digit hex for display/swatches. Gamut-mapped (chroma
// reduction in OKLCH), so a wide-gamut canonical color shows its nearest
// in-sRGB equivalent instead of a per-channel-clamped (over-bright) one.
export function colorToHex(color: Color): string {
  return formatHex(toSrgb(color)) ?? '#000000'
}

// Parse a hex/CSS string into a canonical rgb color (falls back to black).
export function hexToColor(hex: string): Color {
  const parsed = parse(hex)
  return typeof parsed === 'undefined' ? BLACK : toRgb(parsed)
}
