import { useRef } from 'preact/hooks'
import type { JSX } from 'preact'
import styles from './ColorSample.css'

interface ColorSampleProps {
  hex: string
  onChange: (hex: string) => void
}

// Square swatch that opens the default (native) color picker on click.
// Placeholder picker until the custom one is built.
export function ColorSample({ hex, onChange }: ColorSampleProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    onChange(event.currentTarget.value)
  }

  return (
    <div
      class={styles.sample}
      style={{ backgroundColor: hex }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        class={styles.nativeInput}
        type="color"
        value={hex}
        onInput={handleInput}
      />
    </div>
  )
}
