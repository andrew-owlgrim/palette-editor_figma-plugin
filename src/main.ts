import { emit, on, showUI } from '@create-figma-plugin/utilities'
import type {
  CreateStylesHandler,
  CreateVariablesHandler,
  ExportPalette,
  ExportSwatchesHandler,
  PersistedDocument,
  RequestSelectionFillsHandler,
  SaveDocumentHandler,
  SelectionFillsHandler,
} from '@/types'
import { getFileData, setFileData } from '@/utils/storage'

const DOCUMENT_KEY = 'document'

// Swatch grid geometry (px): cell size and gap between cells.
const SWATCH_SIZE = 40
const SWATCH_GAP = 8

function channelHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')
}

// Figma RGB is sRGB 0..1 → '#rrggbb'.
function rgbToHex({ r, g, b }: RGB): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`
}

// '#rrggbb' → Figma RGB (sRGB 0..1). Inverse of rgbToHex; the UI always sends
// 6-digit display hex.
function hexToRgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16)
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 }
}

// Drop the palette on the canvas as a real GRID auto-layout frame (one row per
// key color, one column per shade), named after the collection. Each cell is a
// 40×40 rectangle named `{name}/{step}` (same scheme as variables/styles). The
// frame is placed at the viewport center and selected/zoomed so the user sees it.
function exportSwatches({ collectionName, colors }: ExportPalette): void {
  const cols = colors.reduce((max, c) => Math.max(max, c.shades.length), 0)
  if (colors.length === 0 || cols === 0) {
    figma.notify('No shades to export')
    return
  }
  const width = cols * SWATCH_SIZE + (cols - 1) * SWATCH_GAP
  const height = colors.length * SWATCH_SIZE + (colors.length - 1) * SWATCH_GAP

  const frame = figma.createFrame()
  frame.name = collectionName
  frame.fills = []
  frame.clipsContent = false
  // Native grid layout: fixed counts + gaps. The frame is sized exactly to the
  // tracks below, so the default FLEX tracks resolve to 40px cells.
  frame.layoutMode = 'GRID'
  frame.gridColumnCount = cols
  frame.gridRowCount = colors.length
  frame.gridColumnGap = SWATCH_GAP
  frame.gridRowGap = SWATCH_GAP
  frame.resize(width, height)
  frame.x = Math.round(figma.viewport.center.x - width / 2)
  frame.y = Math.round(figma.viewport.center.y - height / 2)

  for (let row = 0; row < colors.length; row += 1) {
    const color = colors[row]
    for (let col = 0; col < color.shades.length; col += 1) {
      const shade = color.shades[col]
      const rect = figma.createRectangle()
      rect.name = `${color.name}/${shade.step}`
      rect.fills = [{ type: 'SOLID', color: hexToRgb(shade.hex) }]
      frame.appendChildAt(rect, row, col)
      // Fill the grid cell rather than holding a fixed size, so the swatches
      // track the frame/track sizes if the grid is resized. (Set after append —
      // layout sizing is only valid on an auto-layout child.)
      rect.layoutSizingHorizontal = 'FILL'
      rect.layoutSizingVertical = 'FILL'
    }
  }

  figma.currentPage.selection = [frame]
  figma.viewport.scrollAndZoomIntoView([frame])
  figma.notify(`Exported ${colors.length * cols} swatches`)
}

// Write the palette into the file's variables. Variables live in the collection
// named in settings (created if missing) and are named `{name}/{step}` so Figma
// groups them by color. Existing same-named color variables in that collection
// are updated in place rather than duplicated, so re-exporting stays idempotent.
async function createVariables({ collectionName, colors }: ExportPalette): Promise<void> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const collection =
    collections.find((c) => c.name === collectionName) ??
    figma.variables.createVariableCollection(collectionName)
  const modeId = collection.modes[0].modeId

  const existing = await figma.variables.getLocalVariablesAsync('COLOR')
  const byName = new Map(
    existing.filter((v) => v.variableCollectionId === collection.id).map((v) => [v.name, v]),
  )

  let count = 0
  for (const color of colors) {
    for (const shade of color.shades) {
      const name = `${color.name}/${shade.step}`
      const variable = byName.get(name) ?? figma.variables.createVariable(name, collection, 'COLOR')
      variable.setValueForMode(modeId, hexToRgb(shade.hex))
      count += 1
    }
  }
  figma.notify(`Wrote ${count} variables to "${collectionName}"`)
}

// Write the palette into the file's paint styles, named `{name}/{step}` (the
// slash groups them into Figma style folders). No collection — styles are flat.
// Existing same-named styles are updated in place.
async function createStyles({ colors }: ExportPalette): Promise<void> {
  const existing = await figma.getLocalPaintStylesAsync()
  const byName = new Map(existing.map((s) => [s.name, s]))

  let count = 0
  for (const color of colors) {
    for (const shade of color.shades) {
      const name = `${color.name}/${shade.step}`
      const style = byName.get(name) ?? figma.createPaintStyle()
      style.name = name
      style.paints = [{ type: 'SOLID', color: hexToRgb(shade.hex) }]
      count += 1
    }
  }
  figma.notify(`Wrote ${count} paint styles`)
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

  on<ExportSwatchesHandler>('EXPORT_SWATCHES', exportSwatches)
  on<CreateVariablesHandler>('CREATE_VARIABLES', (palette) => {
    void createVariables(palette).catch((error: unknown) => {
      figma.notify(`Couldn't create variables: ${String(error)}`, { error: true })
    })
  })
  on<CreateStylesHandler>('CREATE_STYLES', (palette) => {
    void createStyles(palette).catch((error: unknown) => {
      figma.notify(`Couldn't create styles: ${String(error)}`, { error: true })
    })
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
