import type { Color } from 'culori'
import { colorToHex } from '@/color/models'
import { COLOR_NAMES } from '@/color/colorNames.data'
import type { KeyColor } from '@/types'

interface PaletteEntry {
  name: string
  r: number
  g: number
  b: number
}

// Parse a 6-digit '#rrggbb' into 0..255 components.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

// Precompute the name list's RGB once at module load.
const PALETTE: PaletteEntry[] = COLOR_NAMES.map((c) => ({ name: c.name, ...hexToRgb(c.hex) }))

// Nearest name by Euclidean distance in sRGB. We match against the DISPLAYED
// (gamut-mapped) hex, so the auto name always agrees with the swatch on screen.
export function autoName(color: Color): string {
  const { r, g, b } = hexToRgb(colorToHex(color))
  let best = PALETTE[0]
  let bestDistance = Infinity
  for (const entry of PALETTE) {
    const dr = entry.r - r
    const dg = entry.g - g
    const db = entry.b - b
    const distance = dr * dr + dg * dg + db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = entry
    }
  }
  return best.name
}

// Effective display/export name: a user-set custom name, or the auto name
// derived from the color when none is set.
export function resolveName(keyColor: KeyColor): string {
  return keyColor.customName ?? autoName(keyColor.color)
}
