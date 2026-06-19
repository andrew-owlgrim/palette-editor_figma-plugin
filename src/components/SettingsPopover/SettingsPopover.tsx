import { SegmentedControl, Textbox } from '@create-figma-plugin/ui'
import type { SegmentedControlOption } from '@create-figma-plugin/ui'
import { useState } from 'preact/hooks'
import { DEFAULT_COLLECTION_NAME, usePaletteStore } from '@/store'
import { useLibraryStore } from '@/store/library'
import { usePrefsStore } from '@/store/prefs'
import type { BlendingColorModel, InputColorModel, ToneAxisDirection } from '@/types'
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
  { value: 'lch', children: 'LCH' },
]

const TONE_AXIS_OPTIONS: Array<SegmentedControlOption> = [
  { value: 'dark-light', children: 'Dark → Light' },
  { value: 'light-dark', children: 'Light → Dark' },
]

// Collection-name field. While focused it edits a local draft and commits on
// blur (one undo step instead of one per keystroke); otherwise it shows the live
// stored value, so an external change (e.g. undo) tracks. Empty reverts to the
// default in the store. Mirrors NameInput's focused-draft idiom.
function CollectionNameField() {
  const collectionName = usePaletteStore((s) => s.settings.collectionName)
  const setCollectionName = usePaletteStore((s) => s.setCollectionName)
  const [draft, setDraft] = useState(collectionName)
  const [focused, setFocused] = useState(false)

  return (
    <Textbox
      value={focused ? draft : collectionName}
      placeholder={DEFAULT_COLLECTION_NAME}
      onFocus={() => {
        setDraft(collectionName)
        setFocused(true)
      }}
      onValueInput={setDraft}
      onBlur={() => {
        setFocused(false)
        setCollectionName(draft)
      }}
    />
  )
}

export function SettingsPopover() {
  // Input model is a user-GLOBAL pref (applies across palettes, not undoable —
  // ADR-027); the rest are palette-scoped and travel with the active palette.
  const inputColorModel = usePrefsStore((s) => s.inputColorModel)
  const setInputColorModel = useLibraryStore((s) => s.setInputColorModel)
  const blendingColorModel = usePaletteStore((s) => s.settings.blendingColorModel)
  const toneAxisDirection = usePaletteStore((s) => s.settings.toneAxisDirection)
  const setBlendingColorModel = usePaletteStore((s) => s.setBlendingColorModel)
  const setToneAxisDirection = usePaletteStore((s) => s.setToneAxisDirection)

  return (
    <div class={styles.settings}>
      <section class={styles.section}>
        <div class={styles.sectionTitle}>User settings</div>
        <div class={styles.field}>
          <div class={styles.label}>Input color model</div>
          <div class={styles.control}>
            <SegmentedControl
              options={INPUT_MODEL_OPTIONS}
              value={inputColorModel}
              onValueChange={(value) => setInputColorModel(value as InputColorModel)}
            />
          </div>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.sectionTitle}>Palette settings</div>
        <div class={styles.field}>
          <div class={styles.label}>Blending color model</div>
          <div class={styles.control}>
            <SegmentedControl
              options={BLENDING_MODEL_OPTIONS}
              value={blendingColorModel}
              onValueChange={(value) => setBlendingColorModel(value as BlendingColorModel)}
            />
          </div>
        </div>
        <div class={styles.field}>
          <div class={styles.label}>Tone axis direction</div>
          <div class={styles.control}>
            <SegmentedControl
              options={TONE_AXIS_OPTIONS}
              value={toneAxisDirection}
              onValueChange={(value) => setToneAxisDirection(value as ToneAxisDirection)}
            />
          </div>
        </div>
        <div class={styles.field}>
          <div class={styles.label}>Variable collection</div>
          <CollectionNameField />
        </div>
      </section>
    </div>
  )
}
