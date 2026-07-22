import { emit } from '@create-figma-plugin/utilities'
import { Fragment } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { CountStepper } from './CountStepper'
import { GradientEditor } from './GradientEditor'
import { StopInput } from './StopInput'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { useOverlayScrollbars } from '@/hooks/useOverlayScrollbars'
import { colorToHex } from '@/color/models'
import { buildGradientSampler } from '@/color/gradient'
import { resolveName } from '@/color/naming'
import { resolveSteps, SHADE_MAX, stepLabel } from '@/color/shades'
import { usePaletteStore } from '@/store'
import { useSelectionStore } from '@/store/selection'
import { copyText } from '@/utils/clipboard'
import type { ApplyFillToSelectionHandler, NotifyHandler } from '@/types'
import styles from './ShadesSection.css'

export function ShadesSection() {
  const keyColors = usePaletteStore((s) => s.keyColors)
  const steps = usePaletteStore((s) => s.shades.steps)
  const blending = usePaletteStore((s) => s.settings.blendingColorModel)
  const setShadeCount = usePaletteStore((s) => s.setShadeCount)
  const setShadeStep = usePaletteStore((s) => s.setShadeStep)
  // Target variable collection (settings) — lets apply bind a fill to an already-
  // exported `{name}/{step}` COLOR variable instead of a raw color.
  const collectionName = usePaletteStore((s) => s.settings.collectionName)
  // How the `{name}/{step}` token is labelled — must match the export so an
  // applied fill binds to the same-named variable.
  const stepNaming = usePaletteStore((s) => s.settings.stepNaming)
  // Non-zero when something is selected on the canvas — switches the modifier
  // gesture from "copy hex" to "apply color to the selection's first fill".
  const selectionCount = useSelectionStore((s) => s.count)

  // Which key color's gradient editor is open (injected under its row). A stale
  // id (its color removed) simply renders no editor — guarded at render.
  const [editingId, setEditingId] = useState<string | null>(null)
  // Horizontal scroller (step row + swatch rows scroll together).
  const { ref: scrollerRef } = useOverlayScrollbars({ overflow: { x: 'scroll', y: 'hidden' } })

  // Pick mode: while ctrl/cmd is held, a swatch press copies its hex (or applies
  // it to the selection) instead of opening the editor, and the row stops behaving
  // like a button (no hover/toggle). Tracked reactively so hover + the tooltip can
  // switch as the modifier goes down/up. The window key listeners only fire when
  // the iframe has focus, so a `pointermove` over the section (below) also syncs it
  // — that's what makes the affordance appear when entering straight from the
  // canvas without first clicking the plugin into focus.
  const [pickMode, setPickMode] = useState(false)
  useEffect(() => {
    const sync = (event: KeyboardEvent) => setPickMode(event.metaKey || event.ctrlKey)
    const off = () => setPickMode(false)
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', off)
    }
  }, [])

  async function copyHex(hex: string) {
    const value = hex.toUpperCase()
    const ok = await copyText(value)
    emit<NotifyHandler>(
      'NOTIFY',
      ok ? { message: `Copied ${value}` } : { message: `Couldn't copy ${value}`, error: true },
    )
  }

  // The modifier gesture: apply to the selection when there is one, else copy.
  // Fired from `pointerdown` (not `click`) so the very first press lands even when
  // the iframe isn't focused yet — Figma swallows that focusing click, but the
  // pointer event still carries the modifier state. `variableName` (`{name}/{step}`)
  // lets main bind the fill to that token when `bindVariable` is set (⇧ held) —
  // matching Figma's native eyedropper, where a plain pick lays down the raw color
  // and Shift binds the variable if one exists.
  function pickSwatch(hex: string, variableName: string, bindVariable: boolean) {
    if (selectionCount > 0) {
      emit<ApplyFillToSelectionHandler>('APPLY_FILL_TO_SELECTION', {
        hex,
        variableName,
        collectionName,
        bindVariable,
      })
    } else {
      void copyHex(hex)
    }
  }

  const count = steps.length
  const resolved = useMemo(() => resolveSteps(steps), [steps])

  // One sampler per key color, applied at every step position (value / 1000).
  // `name` is the effective (auto/custom) name — used to build the `{name}/{step}`
  // variable name when applying a swatch to the selection.
  const rows = useMemo(
    () =>
      keyColors.map((pc) => {
        const sample = buildGradientSampler(pc.stops, blending)
        return {
          id: pc.id,
          name: resolveName(pc),
          colors: resolved.map((v) => colorToHex(sample(v / SHADE_MAX))),
        }
      }),
    [keyColors, resolved, blending],
  )

  // The step row and every swatch row share this column template so columns line
  // up; the scroller scrolls them together when there are many steps.
  const columns = { gridTemplateColumns: `repeat(${count}, minmax(40px, 1fr))` }

  function toggleEditing(id: string) {
    setEditingId((current) => (current === id ? null : id))
  }

  return (
    <section class={styles.section}>
      <div class={styles.header}>
        <span class={styles.title}>Shades</span>
        <CountStepper value={count} onChange={setShadeCount} />
      </div>

      <div class={styles.scroller} ref={scrollerRef}>
        <div
          class={styles.inner}
          // Sync pick mode from the pointer's modifier state too, so the affordance
          // works when entering from the canvas before the iframe gains focus.
          onPointerMove={(event) => setPickMode(event.metaKey || event.ctrlKey)}
        >
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
              const swatchRow = (
                <div
                  class={pickMode ? `${styles.row} ${styles.pickMode}` : styles.row}
                  style={columns}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    // In pick mode a press belongs to a swatch (copy/apply), not the row.
                    if (event.metaKey || event.ctrlKey) return
                    toggleEditing(row.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleEditing(row.id)
                    }
                  }}
                >
                  {row.colors.map((hex, i) => {
                    const swatch = (
                      <div
                        class={styles.swatch}
                        style={{ backgroundColor: hex }}
                        onPointerDown={(event) => {
                          if (event.metaKey || event.ctrlKey) {
                            event.stopPropagation()
                            pickSwatch(
                              hex,
                              `${row.name}/${stepLabel(stepNaming, resolved[i], i)}`,
                              event.shiftKey,
                            )
                          }
                        }}
                      />
                    )
                    return pickMode ? (
                      <Tooltip
                        key={i}
                        block
                        placement="top"
                        delay={120}
                        content={
                          <Fragment>
                            <strong>{hex.toUpperCase()}</strong>
                            <br />
                            {selectionCount > 0 ? (
                              <Fragment>
                                apply color
                                <br />⇧ apply variable
                              </Fragment>
                            ) : (
                              'copy hex'
                            )}
                          </Fragment>
                        }
                      >
                        {swatch}
                      </Tooltip>
                    ) : (
                      <Fragment key={i}>{swatch}</Fragment>
                    )
                  })}
                </div>
              )
              // Active rows fold the swatch row and its editor into one full-bleed
              // secondary panel; inactive rows render the swatch row on its own.
              return active && paletteColor !== undefined ? (
                <div key={row.id} class={styles.expanded}>
                  {swatchRow}
                  <GradientEditor paletteColor={paletteColor} />
                </div>
              ) : (
                <Fragment key={row.id}>{swatchRow}</Fragment>
              )
            })
          ) : (
            <div class={styles.empty}>Add a key color to generate shades</div>
          )}
        </div>
      </div>
    </section>
  )
}
