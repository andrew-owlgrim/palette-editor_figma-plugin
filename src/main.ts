import { emit, on, showUI } from '@create-figma-plugin/utilities'
import type {
  PersistedDocument,
  RequestSelectionFillsHandler,
  SaveDocumentHandler,
  SelectionFillsHandler,
} from '@/types'
import { getFileData, setFileData } from '@/utils/storage'

const DOCUMENT_KEY = 'document'

function channelHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')
}

// Figma RGB is sRGB 0..1 → '#rrggbb'.
function rgbToHex({ r, g, b }: RGB): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`
}

// Visible solid fills of the directly-selected nodes, as hex, deduped (order
// preserved). Nested layers are not traversed — selection is top-level only.
function getSelectionFills(): string[] {
  const seen = new Set<string>()
  const fills: string[] = []
  for (const node of figma.currentPage.selection) {
    if (!('fills' in node)) continue
    const paints = node.fills
    if (paints === figma.mixed) continue
    for (const paint of paints) {
      if (paint.type !== 'SOLID' || paint.visible === false) continue
      const hex = rgbToHex(paint.color)
      if (seen.has(hex)) continue
      seen.add(hex)
      fills.push(hex)
    }
  }
  return fills
}

export default function () {
  on<SaveDocumentHandler>('SAVE_DOCUMENT', (document) => {
    setFileData(DOCUMENT_KEY, document)
  })

  function sendSelectionFills() {
    emit<SelectionFillsHandler>('SELECTION_FILLS', { fills: getSelectionFills() })
  }
  figma.on('selectionchange', sendSelectionFills)
  figma.on('currentpagechange', sendSelectionFills)
  // Initial push is driven by the UI to avoid racing its listener setup.
  on<RequestSelectionFillsHandler>('REQUEST_SELECTION_FILLS', sendSelectionFills)

  // sharedPluginData reads are synchronous, so we can hand the stored document
  // straight to the UI as initial props.
  const document = getFileData<PersistedDocument>(DOCUMENT_KEY)
  showUI({ width: 720, height: 640 }, { initialDocument: document })
}
