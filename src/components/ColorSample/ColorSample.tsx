import styles from './ColorSample.css'

interface ColorSampleProps {
  hex: string
  onClick: () => void
}

// Square swatch that acts as the trigger for the custom color picker.
export function ColorSample({ hex, onClick }: ColorSampleProps) {
  return (
    <button
      type="button"
      class={styles.sample}
      style={{ backgroundColor: hex }}
      onClick={onClick}
      aria-label="Edit color"
    />
  )
}
