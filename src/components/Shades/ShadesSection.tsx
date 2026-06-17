import { useMemo } from 'preact/hooks'
import { CountStepper } from './CountStepper'
import { StopInput } from './StopInput'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { colorToHex } from '@/color/models'
import { buildGradientSampler } from '@/color/gradient'
import { resolveSteps, SHADE_MAX } from '@/color/shades'
import { usePaletteStore } from '@/store'
import styles from './ShadesSection.css'

export function ShadesSection() {
  const keyColors = usePaletteStore((s) => s.keyColors)
  const steps = usePaletteStore((s) => s.shades.steps)
  const blending = usePaletteStore((s) => s.settings.blendingColorModel)
  const setShadeCount = usePaletteStore((s) => s.setShadeCount)
  const setShadeStep = usePaletteStore((s) => s.setShadeStep)

  const count = steps.length
  const resolved = useMemo(() => resolveSteps(steps), [steps])

  // One sampler per key color, applied at every step position (value / 1000).
  const rows = useMemo(
    () =>
      keyColors.map((pc) => {
        const sample = buildGradientSampler(pc.stops, blending)
        return { id: pc.id, colors: resolved.map((v) => colorToHex(sample(v / SHADE_MAX))) }
      }),
    [keyColors, resolved, blending],
  )

  // Both the step row and the swatch grid share this column template so columns
  // line up; the scroller scrolls them together when there are many steps.
  const columns = { gridTemplateColumns: `repeat(${count}, minmax(28px, 1fr))` }

  return (
    <section class={styles.section}>
      <div class={styles.header}>
        <span class={styles.title}>Shades</span>
        <CountStepper value={count} onChange={setShadeCount} />
      </div>

      <div class={styles.scroller}>
        <div class={styles.steps} style={columns}>
          {steps.map((value, i) => (
            <Tooltip key={i} content="specify stop">
              <StopInput
                value={value}
                placeholder={resolved[i]}
                onCommit={(next) => setShadeStep(i, next)}
              />
            </Tooltip>
          ))}
        </div>

        {keyColors.length > 0 ? (
          <div class={styles.grid} style={columns}>
            {rows.map((row) =>
              row.colors.map((hex, i) => (
                <div
                  key={`${row.id}:${i}`}
                  class={styles.swatch}
                  style={{ backgroundColor: hex }}
                />
              )),
            )}
          </div>
        ) : (
          <div class={styles.empty}>Add a key color to generate shades</div>
        )}
      </div>
    </section>
  )
}
