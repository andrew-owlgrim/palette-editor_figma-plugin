import { buildGradientSampler } from '@/color/gradient'
import { colorToHex } from '@/color/models'
import { resolveName } from '@/color/naming'
import { resolveSteps, SHADE_MAX, stepLabel } from '@/color/shades'
import type {
  BlendingColorModel,
  ExportPalette,
  PaletteColor,
  ShadeScale,
  StepNaming,
} from '@/types'

// Resolve the palette into a flat, Figma-ready form: each key color's effective
// name + its color at every shade step. Mirrors the swatch grid exactly (same
// `resolveSteps` + per-color `buildGradientSampler`), so the export always
// matches what's shown. The main thread turns this into nodes/variables/styles.
export function buildExportPalette(
  keyColors: PaletteColor[],
  shades: ShadeScale,
  blending: BlendingColorModel,
  collectionName: string,
  stepNaming: StepNaming,
): ExportPalette {
  const resolved = resolveSteps(shades.steps)
  return {
    collectionName,
    colors: keyColors.map((pc) => {
      const sample = buildGradientSampler(pc.stops, blending)
      return {
        name: resolveName(pc),
        shades: resolved.map((step, i) => ({
          step,
          hex: colorToHex(sample(step / SHADE_MAX)),
          label: stepLabel(stepNaming, step, i),
        })),
      }
    }),
  }
}
