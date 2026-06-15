import { converter, formatHex, parse } from 'culori'
import type { Color } from 'culori'
import type { ColorChannels, InputColorModel } from '@/types'

const toHsl = converter('hsl')
const toHsv = converter('hsv')
const toLch = converter('lch')

export interface ChannelDef {
  id: string
  label: string
  minimum: number
  maximum: number
  suffix?: string
  integer?: boolean
}

export interface ColorModelDef {
  id: InputColorModel
  channels: ChannelDef[]
  toChannels: (color: Color) => ColorChannels
  fromChannels: (channels: ColorChannels) => Color
}

function num(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value: number, decimals = 0): string {
  const factor = 10 ** decimals
  return String(Math.round((value + Number.EPSILON) * factor) / factor)
}

export const MODELS: Record<InputColorModel, ColorModelDef> = {
  hsl: {
    id: 'hsl',
    channels: [
      { id: 'h', label: 'H', minimum: 0, maximum: 360, integer: true },
      { id: 's', label: 'S', minimum: 0, maximum: 100, suffix: '%', integer: true },
      { id: 'l', label: 'L', minimum: 0, maximum: 100, suffix: '%', integer: true },
    ],
    toChannels(color) {
      const c = toHsl(color)
      return { h: round(c.h ?? 0), s: round((c.s ?? 0) * 100), l: round((c.l ?? 0) * 100) }
    },
    fromChannels(ch) {
      return { mode: 'hsl', h: num(ch.h), s: num(ch.s) / 100, l: num(ch.l) / 100 }
    },
  },
  hsv: {
    id: 'hsv',
    channels: [
      { id: 'h', label: 'H', minimum: 0, maximum: 360, integer: true },
      { id: 's', label: 'S', minimum: 0, maximum: 100, suffix: '%', integer: true },
      { id: 'v', label: 'V', minimum: 0, maximum: 100, suffix: '%', integer: true },
    ],
    toChannels(color) {
      const c = toHsv(color)
      return { h: round(c.h ?? 0), s: round((c.s ?? 0) * 100), v: round((c.v ?? 0) * 100) }
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
    toChannels(color) {
      const c = toLch(color)
      return { l: round(c.l ?? 0), c: round(c.c ?? 0, 1), h: round(c.h ?? 0) }
    },
    fromChannels(ch) {
      return { mode: 'lch', l: num(ch.l), c: num(ch.c), h: num(ch.h) }
    },
  },
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
