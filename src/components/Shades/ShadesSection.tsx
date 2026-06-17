import { Fragment } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { CountStepper } from './CountStepper'
import { GradientEditor } from './GradientEditor'
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

  // Which key color's gradient editor is open (injected under its row). A stale
  // id (its color removed) simply renders no editor — guarded at render.
  const [editingId, setEditingId] = useState<string | null>(null)

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

  // The step row and every swatch row share this column template so columns line
  // up; the scroller scrolls them together when there are many steps.
  const columns = { gridTemplateColumns: `repeat(${count}, minmax(28px, 1fr))` }

  function toggleEditing(id: string) {
    setEditingId((current) => (current === id ? null : id))
  }

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
          rows.map((row) => {
            const paletteColor = keyColors.find((k) => k.id === row.id)
            const active = editingId === row.id
            return (
              <Fragment key={row.id}>
                <div
                  class={active ? `${styles.row} ${styles.rowActive}` : styles.row}
                  style={columns}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleEditing(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleEditing(row.id)
                    }
                  }}
                >
                  {row.colors.map((hex, i) => (
                    <div key={i} class={styles.swatch} style={{ backgroundColor: hex }} />
                  ))}
                </div>
                {active && paletteColor !== undefined ? (
                  <GradientEditor paletteColor={paletteColor} />
                ) : null}
              </Fragment>
            )
          })
        ) : (
          <div class={styles.empty}>Add a key color to generate shades</div>
        )}
      </div>
    </section>
  )
}
