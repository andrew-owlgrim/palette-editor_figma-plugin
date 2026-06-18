import { Button, IconButton, IconMinusSmall24, IconPlusSmall24 } from '@create-figma-plugin/ui'
import { useMemo, useState } from 'preact/hooks'
import {
  DEFAULT_COLOR_COUNT,
  MAX_COLOR_COUNT,
  MIN_COLOR_COUNT,
  extractColors,
} from '@/color/extract'
import { usePaletteStore } from '@/store'
import { useExtractorStore } from '@/store/extractor'
import { Swatch } from './Swatch'
import styles from './ExtractWorkspace.css'

// Full-area workspace shown once an image is decoded: the image on the left, a
// color-count stepper + the extracted-color list on the right, and submit/cancel
// at the bottom. Replaces the normal plugin UI while open (see App).
export function ExtractWorkspace() {
  const source = useExtractorStore((s) => s.source)
  const close = useExtractorStore((s) => s.close)
  const addKeyColors = usePaletteStore((s) => s.addKeyColors)

  const [count, setCount] = useState(DEFAULT_COLOR_COUNT)

  // Re-cluster only when the image or the requested count changes — not on every
  // toggle. (extractColors keeps run-to-run variance low via best-of-N restarts.)
  const colors = useMemo(
    () => (source === null ? [] : extractColors(source.imageData.data, count)),
    [source, count],
  )

  // Hexes whose swatch is selected; these get added on submit. A fresh cluster
  // set (count changed / image loaded) starts all-selected. Resetting here —
  // during render, by comparing the memoized `colors` ref — instead of in an
  // effect avoids a one-frame flash where new swatches paint before selection
  // catches up (all dimmed, then lit).
  const [selected, setSelected] = useState<Set<string>>(() => new Set(colors.map((c) => c.hex)))
  const [clustered, setClustered] = useState(colors)
  if (clustered !== colors) {
    setClustered(colors)
    setSelected(new Set(colors.map((c) => c.hex)))
  }

  if (source === null) return null

  function toggle(hex: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(hex)) next.delete(hex)
      else next.add(hex)
      return next
    })
  }

  function submit() {
    const hexes = colors.filter((c) => selected.has(c.hex)).map((c) => c.hex)
    if (hexes.length > 0) addKeyColors(hexes)
    close()
  }

  return (
    <div class={styles.workspace}>
      <div class={styles.preview}>
        <img class={styles.image} src={source.previewUrl} alt="" />
      </div>

      <div class={styles.panel}>
        <div class={styles.stepper}>
          <span class={styles.label}>Colors</span>
          <div class={styles.controls}>
            <IconButton onClick={() => setCount((c) => c - 1)} disabled={count <= MIN_COLOR_COUNT}>
              <IconMinusSmall24 />
            </IconButton>
            <span class={styles.count}>{count}</span>
            <IconButton onClick={() => setCount((c) => c + 1)} disabled={count >= MAX_COLOR_COUNT}>
              <IconPlusSmall24 />
            </IconButton>
          </div>
        </div>

        <div class={styles.grid}>
          {colors.map((color, index) => (
            <Swatch
              key={index}
              hex={color.hex}
              selected={selected.has(color.hex)}
              onToggle={() => toggle(color.hex)}
            />
          ))}
        </div>

        <div class={styles.footer}>
          <Button secondary fullWidth onClick={close}>
            Cancel
          </Button>
          <Button fullWidth onClick={submit} disabled={selected.size === 0}>
            Add {selected.size} {selected.size === 1 ? 'color' : 'colors'}
          </Button>
        </div>
      </div>
    </div>
  )
}
