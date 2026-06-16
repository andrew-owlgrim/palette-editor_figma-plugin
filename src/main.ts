import { on, showUI } from '@create-figma-plugin/utilities'
import type { PaletteDocument, SaveDocumentHandler } from '@/types'
import { getFileData, setFileData } from '@/utils/storage'

const DOCUMENT_KEY = 'document'

export default function () {
  on<SaveDocumentHandler>('SAVE_DOCUMENT', (document) => {
    setFileData(DOCUMENT_KEY, document)
  })

  // sharedPluginData reads are synchronous, so we can hand the stored document
  // straight to the UI as initial props.
  const document = getFileData<PaletteDocument>(DOCUMENT_KEY)
  showUI({ width: 720, height: 640 }, { initialDocument: document })
}
