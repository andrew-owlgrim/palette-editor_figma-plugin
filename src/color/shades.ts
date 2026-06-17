// The shade scale lives on the 0..1000 tone axis (tailwind 1/1000 format).
export const SHADE_MAX = 1000
export const DEFAULT_SHADE_COUNT = 11
export const MIN_SHADE_COUNT = 2
export const MAX_SHADE_COUNT = 26

// Resolve each step's value (0..1000). Set steps are anchors; unset (`null`)
// steps are filled by even distribution (by index) between the surrounding
// anchors. The first/last steps act as anchors at 0/1000 when unset — so an
// all-`null` scale is evenly spread 0..1000, and a user-set step pins its run.
export function resolveSteps(steps: Array<number | null>): number[] {
  const n = steps.length
  if (n === 0) return []
  if (n === 1) return [steps[0] ?? 0]

  const anchors: Array<{ i: number; v: number }> = []
  for (let i = 0; i < n; i += 1) {
    const v = steps[i]
    if (v !== null) anchors.push({ i, v })
  }
  // Pin the edges so runs of nulls at the start/end have something to span to.
  if (anchors.length === 0 || anchors[0].i !== 0) anchors.unshift({ i: 0, v: steps[0] ?? 0 })
  if (anchors[anchors.length - 1].i !== n - 1) {
    anchors.push({ i: n - 1, v: steps[n - 1] ?? SHADE_MAX })
  }

  const out = new Array<number>(n)
  for (let k = 0; k < anchors.length - 1; k += 1) {
    const a = anchors[k]
    const b = anchors[k + 1]
    for (let i = a.i; i <= b.i; i += 1) {
      const t = b.i === a.i ? 0 : (i - a.i) / (b.i - a.i)
      out[i] = Math.round(a.v + (b.v - a.v) * t)
    }
  }
  return out
}

// Clamp a user-entered step value into the gap between its nearest SET neighbors
// (with the 0 / 1000 edges as outer bounds), keeping the scale monotonic.
export function clampStepValue(steps: Array<number | null>, index: number, value: number): number {
  let lo = 0
  for (let i = index - 1; i >= 0; i -= 1) {
    const v = steps[i]
    if (v !== null) {
      lo = v
      break
    }
  }
  let hi = SHADE_MAX
  for (let i = index + 1; i < steps.length; i += 1) {
    const v = steps[i]
    if (v !== null) {
      hi = v
      break
    }
  }
  return Math.min(hi, Math.max(lo, Math.round(value)))
}
