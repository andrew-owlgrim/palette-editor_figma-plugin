import { emit, on } from '@create-figma-plugin/utilities'
import { useEffect } from 'preact/hooks'
import { ExtractWorkspace } from '@/components/ColorExtractor/ExtractWorkspace'
import { IntakeModal } from '@/components/ColorExtractor/IntakeModal'
import { Footer } from '@/components/Footer/Footer'
import { Header } from '@/components/Header/Header'
import { KeyColorsSection } from '@/components/KeyColors/KeyColorsSection'
import { ShadesSection } from '@/components/Shades/ShadesSection'
import { useOverlayScrollbars } from '@/hooks/useOverlayScrollbars'
import { usePaletteStore } from '@/store'
import { useExtractorStore } from '@/store/extractor'
import { flushSave, resetSaveBaseline, scheduleSave, useLibraryStore } from '@/store/library'
import { useSelectionStore } from '@/store/selection'
import type {
  PersistedDocument,
  RequestSelectionFillsHandler,
  RequestUserLibraryHandler,
  SaveUserPaletteResultHandler,
  SelectionFillsHandler,
  UserLibraryHandler,
} from '@/types'
import styles from './App.css'

interface AppProps {
  initialDocument?: PersistedDocument | null
  documentId?: string
  documentName?: string
}

function isValidDocument(value: PersistedDocument | null | undefined): value is PersistedDocument {
  return value != null && Array.isArray(value.keyColors) && value.settings != null
}

export function App({ initialDocument, documentId = '', documentName = '' }: AppProps) {
  useEffect(() => {
    // Seed the library store's document identity (active = document by default),
    // then hydrate the palette store from the file-persisted document and clear
    // undo so the loaded state is the baseline. Baseline the save dedupe before
    // subscribing so the hydration isn't echoed back as a save.
    useLibraryStore.getState().initFromProps(initialDocument, documentId, documentName)
    if (isValidDocument(initialDocument)) {
      usePaletteStore.getState().hydrate(initialDocument)
      usePaletteStore.temporal.getState().clear()
    }
    resetSaveBaseline()
    const unsubscribe = usePaletteStore.subscribe(() => scheduleSave())

    // The user library is async (clientStorage), so it can't ride the synchronous
    // showUI props — request it over the bridge and apply it when it arrives.
    const offLibrary = on<UserLibraryHandler>('USER_LIBRARY', ({ library }) => {
      useLibraryStore.getState().receiveLibrary(library)
    })
    // A failed first persist (e.g. the library is full) rolls the palette back
    // out of the store so it can't linger as a ghost until the next reload.
    const offSaveResult = on<SaveUserPaletteResultHandler>(
      'SAVE_USER_PALETTE_RESULT',
      ({ id, ok }) => {
        useLibraryStore.getState().handleSaveResult(id, ok)
      },
    )
    emit<RequestUserLibraryHandler>('REQUEST_USER_LIBRARY')

    return () => {
      flushSave()
      unsubscribe()
      offLibrary()
      offSaveResult()
    }
  }, [initialDocument, documentId, documentName])

  // Track canvas-selection fills (ephemeral, kept out of the palette store).
  useEffect(() => {
    const unsubscribe = on<SelectionFillsHandler>('SELECTION_FILLS', ({ fills, count }) => {
      useSelectionStore.getState().setSelection({ fills, count })
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
  // Overlay scrollbars on the main vertical scroller (called before the early
  // return so hook order stays stable; the ref simply doesn't attach when the
  // workspace replaces this tree).
  const { ref: bodyRef } = useOverlayScrollbars({ overflow: { x: 'hidden', y: 'scroll' } })

  const extractorStage = useExtractorStore((s) => s.stage)
  if (extractorStage === 'workspace') {
    return <ExtractWorkspace />
  }

  return (
    <div class={styles.root}>
      <Header />
      <div class={styles.body} ref={bodyRef}>
        {/* Inner wrapper: OverlayScrollbars forces its host to flex-row, so the
            stacked sections live one level in. */}
        <div class={styles.bodyContent}>
          <KeyColorsSection />
          <ShadesSection />
        </div>
      </div>
      <Footer />
      {(extractorStage === 'intake' || extractorStage === 'loading') && <IntakeModal />}
    </div>
  )
}
