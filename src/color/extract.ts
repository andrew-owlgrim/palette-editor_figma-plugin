import { converter } from 'culori'
import { colorToHex } from './models'

// Color-count tunables for the extractor UI (stepper bounds + default).
export const MIN_COLOR_COUNT = 2
export const MAX_COLOR_COUNT = 16
export const DEFAULT_COLOR_COUNT = 6

// k-means stops once assignments settle or this many Lloyd passes run — a small
// cap keeps re-clustering on every stepper tick snappy without hurting quality.
const MAX_ITERATIONS = 12
// Pixels at or below this alpha are dropped before clustering (transparent
// regions shouldn't pull a centroid toward an arbitrary RGB).
const MIN_ALPHA = 8

const toOklab = converter('oklab')

// One clustered color: its hex and the share of sampled pixels it represents
// (0..1). Results are ordered by `weight` descending — most dominant first.
export interface ExtractedColor {
  hex: string
  weight: number
}

type Lab = [number, number, number]

// Squared Euclidean distance in OKLab — "perceptual" enough that clusters track
// how distinct colors look, and squared (no sqrt) since we only ever compare.
function distanceSq(a: Lab, b: Lab): number {
  const dl = a[0] - b[0]
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return dl * dl + da * da + db * db
}

// RGBA bytes -> opaque pixels as OKLab points. Transparent pixels are skipped.
function toLabPoints(pixels: Uint8ClampedArray): Lab[] {
  const points: Lab[] = []
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] <= MIN_ALPHA) continue
    const lab = toOklab({
      mode: 'rgb',
      r: pixels[i] / 255,
      g: pixels[i + 1] / 255,
      b: pixels[i + 2] / 255,
    })
    points.push([lab.l, lab.a, lab.b])
  }
  return points
}

// k-means++ seeding: first center random, each subsequent one drawn with
// probability proportional to its squared distance from the nearest center so
// far. Spreads the initial centers out and gives k-means a stable start.
function seedCenters(points: Lab[], k: number): Lab[] {
  const centers: Lab[] = [points[Math.floor(Math.random() * points.length)]]
  const nearestSq = points.map((p) => distanceSq(p, centers[0]))

  while (centers.length < k) {
    let total = 0
    for (const d of nearestSq) total += d
    // All remaining points coincide with a center — nothing left to spread to.
    if (total === 0) break

    let threshold = Math.random() * total
    let chosen = 0
    for (let i = 0; i < points.length; i += 1) {
      threshold -= nearestSq[i]
      if (threshold <= 0) {
        chosen = i
        break
      }
    }

    const center = points[chosen]
    centers.push(center)
    for (let i = 0; i < points.length; i += 1) {
      const d = distanceSq(points[i], center)
      if (d < nearestSq[i]) nearestSq[i] = d
    }
  }
  return centers
}

// Extract `count` dominant colors from RGBA pixel data via k-means++ in OKLab.
// Returns hex colors ordered by cluster weight (dominance) descending. `count`
// is clamped to the number of distinct-enough pixels available, so a tiny or
// near-solid image yields fewer colors rather than duplicates.
export function extractColors(pixels: Uint8ClampedArray, count: number): ExtractedColor[] {
  const points = toLabPoints(pixels)
  if (points.length === 0) return []

  const k = Math.min(count, points.length)
  const centers = seedCenters(points, k)
  const assignment = new Array<number>(points.length).fill(-1)

  for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
    // Assignment step: nearest center per point. Track whether anything moved.
    let changed = false
    for (let i = 0; i < points.length; i += 1) {
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < centers.length; c += 1) {
        const d = distanceSq(points[i], centers[c])
        if (d < bestDist) {
          bestDist = d
          best = c
        }
      }
      if (assignment[i] !== best) {
        assignment[i] = best
        changed = true
      }
    }
    if (!changed && iter > 0) break

    // Update step: each center becomes the mean of its assigned points. Empty
    // clusters keep their previous center (rare after k-means++ seeding).
    const sums: Lab[] = centers.map(() => [0, 0, 0])
    const counts = new Array<number>(centers.length).fill(0)
    for (let i = 0; i < points.length; i += 1) {
      const c = assignment[i]
      sums[c][0] += points[i][0]
      sums[c][1] += points[i][1]
      sums[c][2] += points[i][2]
      counts[c] += 1
    }
    for (let c = 0; c < centers.length; c += 1) {
      if (counts[c] === 0) continue
      centers[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]]
    }
  }

  // Final weights from the last assignment, then drop empty clusters.
  const counts = new Array<number>(centers.length).fill(0)
  for (const c of assignment) counts[c] += 1

  return centers
    .map((center, c) => ({
      hex: colorToHex({ mode: 'oklab', l: center[0], a: center[1], b: center[2] }),
      weight: counts[c] / points.length,
    }))
    .filter((color) => color.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}
