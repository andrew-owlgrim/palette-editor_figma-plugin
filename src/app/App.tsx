import { emit } from '@create-figma-plugin/utilities'
import { useEffect } from 'preact/hooks'
import { Header } from '@/components/Header/Header'
import { KeyColorsSection } from '@/components/KeyColors/KeyColorsSection'
import { usePaletteStore } from '@/store'
import type { PaletteDocument, SaveDocumentHandler } from '@/types'
import styles from './App.css'

interface AppProps {
  initialDocument?: PaletteDocument | null
}

const SAVE_DEBOUNCE_MS = 400

function isValidDocument(value: PaletteDocument | null | undefined): value is PaletteDocument {
  return value != null && Array.isArray(value.keyColors) && value.settings != null
}

export function App({ initialDocument }: AppProps) {
  useEffect(() => {
    // Hydrate from the file-persisted document first, then reset the undo
    // history so the loaded state is the baseline. Doing this before attaching
    // the save subscription prevents the hydration from being saved back (echo).
    if (isValidDocument(initialDocument)) {
      usePaletteStore.getState().hydrate(initialDocument)
      usePaletteStore.temporal.getState().clear()
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = usePaletteStore.subscribe((state) => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        emit<SaveDocumentHandler>('SAVE_DOCUMENT', {
          keyColors: state.keyColors,
          settings: state.settings,
        })
      }, SAVE_DEBOUNCE_MS)
    })

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [initialDocument])

  return (
    <div class={styles.root}>
      <Header />
      <div class={styles.body}>
        <KeyColorsSection />
      </div>
    </div>
  )
}
