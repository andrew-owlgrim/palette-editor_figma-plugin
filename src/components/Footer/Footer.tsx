import { Button } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import { useEffect, useRef, useState } from 'preact/hooks'
import { buildExportPalette } from '@/color/export'
import { usePaletteStore } from '@/store'
import type { CreateStylesHandler, CreateVariablesHandler, ExportSwatchesHandler } from '@/types'
import styles from './Footer.css'

type ExportKind = 'variables' | 'styles' | 'swatches'

// Default vs. just-exported label per button. After a successful export the
// button briefly shows the "done" label (with a check), then reverts.
const LABELS: Record<ExportKind, { idle: string; done: string }> = {
  variables: { idle: 'Create variables', done: '✔ Done' },
  styles: { idle: 'Create styles', done: '✔ Done' },
  swatches: { idle: 'Create swatches', done: '✔ Done' },
}

const FEEDBACK_MS = 1000

// The export bar: writes the palette into Figma variables, paint styles, or a
// grid of swatches on the canvas. Each button flashes a confirmation label +
// success fill for a moment after a press (one active flash at a time). All
// three are disabled with no key colors.
export function Footer() {
  const keyColors = usePaletteStore((s) => s.keyColors)
  const shades = usePaletteStore((s) => s.shades)
  const blending = usePaletteStore((s) => s.settings.blendingColorModel)
  const collectionName = usePaletteStore((s) => s.settings.collectionName)

  // Which button is currently showing its "done" state (null = all idle).
  const [flashed, setFlashed] = useState<ExportKind | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const empty = keyColors.length === 0

  function run(kind: ExportKind, send: (palette: ReturnType<typeof buildExportPalette>) => void) {
    send(buildExportPalette(keyColors, shades, blending, collectionName))
    setFlashed(kind)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setFlashed(null), FEEDBACK_MS)
  }

  function label(kind: ExportKind): string {
    return flashed === kind ? LABELS[kind].done : LABELS[kind].idle
  }

  function flashClass(kind: ExportKind): string | undefined {
    return flashed === kind ? styles.flash : undefined
  }

  return (
    <footer class={styles.footer}>
      <Button
        secondary
        fullWidth
        disabled={empty}
        class={flashClass('variables')}
        onClick={() => run('variables', (p) => emit<CreateVariablesHandler>('CREATE_VARIABLES', p))}
      >
        {label('variables')}
      </Button>
      <Button
        secondary
        fullWidth
        disabled={empty}
        class={flashClass('styles')}
        onClick={() => run('styles', (p) => emit<CreateStylesHandler>('CREATE_STYLES', p))}
      >
        {label('styles')}
      </Button>
      <Button
        secondary
        fullWidth
        disabled={empty}
        class={flashClass('swatches')}
        onClick={() => run('swatches', (p) => emit<ExportSwatchesHandler>('EXPORT_SWATCHES', p))}
      >
        {label('swatches')}
      </Button>
    </footer>
  )
}
