import { converter, differenceEuclidean, toGamut } from 'culori'
import type { Color } from 'culori'

const toRgb = converter('rgb')
// Reduce out-of-sRGB samples into gamut (chroma reduction in OKLCH), so every
// generated color is directly displayable — matches how colors are shown.
const intoSrgb = toGamut('rgb', 'oklch')
// Perceptual distance: Euclidean in OKLab. "Far apart" ≈ "visually distinct".
const distance = differenceEuclidean('oklab')

// Constrain ONLY lightness, and generously: the central ~60% of the OKLCH
// lightness range. This drops the very dark / very light colors that leave no
// headroom to build a tonal scale; hue and chroma stay free (a chroma sample
// above the sRGB limit is just reduced into gamut, not clamped to neon).
const L_MIN = 0.3
const L_MAX = 0.8
const CHROMA_MAX = 0.17
// Candidates weighed per pick. The goal is variety, not optimality — a modest
// count keeps results lively rather than always landing in the exact same gap.
const CANDIDATE_COUNT = 32

function randomColor(): Color {
  const l = L_MIN + Math.random() * (L_MAX - L_MIN)
  const c = Math.random() * CHROMA_MAX
  const h = Math.random() * 360
  return toRgb(intoSrgb({ mode: 'oklch', l, c, h }))
}

function nearestDistance(color: Color, others: readonly Color[]): number {
  let nearest = Infinity
  for (const other of others) {
    const d = distance(color, other)
    if (d < nearest) nearest = d
  }
  return nearest
}

// A new color that fits an existing row without colliding with it: draw random
// (lightness-bounded) candidates and keep the one whose nearest existing color
// is the most distant in OKLab (best-candidate / farthest-point sampling). It's
// random by design, so each call — a fresh "add" or a reroll — differs. An empty
// set just yields a random color.
export function harmoniousColor(existing: readonly Color[]): Color {
  if (existing.length === 0) return randomColor()

  let best = randomColor()
  let bestNearest = nearestDistance(best, existing)
  for (let i = 1; i < CANDIDATE_COUNT; i += 1) {
    const candidate = randomColor()
    const nearest = nearestDistance(candidate, existing)
    if (nearest > bestNearest) {
      bestNearest = nearest
      best = candidate
    }
  }
  return best
}
