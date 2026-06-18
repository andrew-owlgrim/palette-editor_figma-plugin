import { emit, on } from '@create-figma-plugin/utilities'
import { useEffect } from 'preact/hooks'
import { ExtractWorkspace } from '@/components/ColorExtractor/ExtractWorkspace'
import { IntakeModal } from '@/components/ColorExtractor/IntakeModal'
import { Footer } from '@/components/Footer/Footer'
import { Header } from '@/components/Header/Header'
import { KeyColorsSection } from '@/components/KeyColors/KeyColorsSection'
import { ShadesSection } from '@/components/Shades/ShadesSection'
import { usePaletteStore } from '@/store'
import { useExtractorStore } from '@/store/extractor'
import { useSelectionStore } from '@/store/selection'
import type {
  PersistedDocument,
  RequestSelectionFillsHandler,
  SaveDocumentHandler,
  SelectionFillsHandler,
} from '@/types'
import styles from './App.css'

interface AppProps {
  initialDocument?: PersistedDocument | null
}

const SAVE_DEBOUNCE_MS = 400

function isValidDocument(value: PersistedDocument | null | undefined): value is PersistedDocument {
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
          // Persist the gradient (stops + keyStopId) + custom name; channels and
          // auto names are re-derived on load.
          keyColors: state.keyColors.map(({ id, customName, autoName, keyStopId, stops }) => ({
            id,
            customName,
            autoName,
            keyStopId,
            stops: stops.map(({ id, position, color, autoPosition }) => ({
              id,
              position,
              color,
              autoPosition,
            })),
          })),
          settings: state.settings,
          shades: state.shades,
        })
      }, SAVE_DEBOUNCE_MS)
    })

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [initialDocument])

  // Track canvas-selection fills (ephemeral, kept out of the palette store).
  useEffect(() => {
    const unsubscribe = on<SelectionFillsHandler>('SELECTION_FILLS', ({ fills }) => {
      useSelectionStore.getState().setFills(fills)
    })
    emit<RequestSelectionFillsHandler>('REQUEST_SELECTION_FILLS')
    return unsubscribe
  }, [])

  // Undo/redo hotkeys: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Matches on `event.code`
  // (physical key) so it's layout-independent — `event.key` would be the
  // localized character (e.g. 'я' on a Cyrillic layout) and miss. Always drives
  // the plugin's history and `preventDefault`s the browser's native textbox undo
  // (which fights our store). If a field is focused, blur it first so its pending
  // edit commits as a normal history entry, then undo operates on a clean state.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey
      if (!mod || event.code !== 'KeyZ') return

      event.preventDefault()

      const active = document.activeElement
      if (
        active instanceof HTMLElement &&
        (active.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
      ) {
        active.blur()
      }

      const temporal = usePaletteStore.temporal.getState()
      if (event.shiftKey) temporal.redo()
      else temporal.undo()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // The extractor's full-area workspace replaces the normal UI while open; the
  // intake modal overlays it during intake/loading. The store actions live
  // outside React, so swapping the rendered tree doesn't disturb the save
  // subscription or selection tracking above.
  const extractorStage = useExtractorStore((s) => s.stage)
  if (extractorStage === 'workspace') {
    return <ExtractWorkspace />
  }

  return (
    <div class={styles.root}>
      <Header />
      <div class={styles.body}>
        <KeyColorsSection />
        <ShadesSection />
      </div>
      <Footer />
      {(extractorStage === 'intake' || extractorStage === 'loading') && <IntakeModal />}
    </div>
  )
}
