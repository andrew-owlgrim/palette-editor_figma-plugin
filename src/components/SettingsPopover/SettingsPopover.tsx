import { SegmentedControl } from '@create-figma-plugin/ui'
import type { SegmentedControlOption } from '@create-figma-plugin/ui'
import { usePaletteStore } from '@/store'
import type { BlendingColorModel, InputColorModel } from '@/types'
import styles from './SettingsPopover.css'

const INPUT_MODEL_OPTIONS: Array<SegmentedControlOption> = [
  { value: 'hsl', children: 'HSL' },
  { value: 'hsv', children: 'HSV' },
  { value: 'lch', children: 'LCH' },
]

const BLENDING_MODEL_OPTIONS: Array<SegmentedControlOption> = [
  { value: 'rgb', children: 'RGB' },
  { value: 'hsl', children: 'HSL' },
  { value: 'oklch', children: 'OKLCH' },
]

export function SettingsPopover() {
  const inputColorModel = usePaletteStore((s) => s.settings.inputColorModel)
  const blendingColorModel = usePaletteStore((s) => s.settings.blendingColorModel)
  const setInputColorModel = usePaletteStore((s) => s.setInputColorModel)
  const setBlendingColorModel = usePaletteStore((s) => s.setBlendingColorModel)

  return (
    <div class={styles.settings}>
      <div class={styles.field}>
        <div class={styles.label}>Input color model</div>
        <SegmentedControl
          options={INPUT_MODEL_OPTIONS}
          value={inputColorModel}
          onValueChange={(value) => setInputColorModel(value as InputColorModel)}
        />
      </div>
      <div class={styles.field}>
        <div class={styles.label}>Blending color model</div>
        <SegmentedControl
          options={BLENDING_MODEL_OPTIONS}
          value={blendingColorModel}
          onValueChange={(value) => setBlendingColorModel(value as BlendingColorModel)}
        />
      </div>
    </div>
  )
}
