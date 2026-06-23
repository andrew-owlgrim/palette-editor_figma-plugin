import { Button, IconButton, IconLibrary24, Modal } from '@create-figma-plugin/ui'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Swatch } from '@/components/ColorExtractor/Swatch'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { useOverlayScrollbars } from '@/hooks/useOverlayScrollbars'
import { keyColorOf } from '@/color/gradient'
import { colorToHex } from '@/color/models'
import { DEFAULT_SETTINGS, toRuntimeColors } from '@/store'
import { useLibraryStore } from '@/store/library'
import type { PaletteColor, ToneAxisDirection } from '@/types'
import styles from './PaletteImport.css'

interface ImportSource {
  key: string
  name: string
  colors: PaletteColor[]
  // Tone direction the source ramps were authored in — passed on import so a
  // mismatch with the active palette mirrors the gradients (keeps orientation).
  direction: ToneAxisDirection
}

interface PaletteImportProps {
  // Append the chosen whole PaletteColors into the active palette (the caller
  // wires the scroll-to-new-card + the store action). `direction` is the source's
  // tone direction, used to orient the imported ramps in the target.
  onImport: (colors: PaletteColor[], direction: ToneAxisDirection) => void
}

// Tone direction of a source body, with the same default-merge `toRuntimeColors`
// applies, so legacy bodies missing the setting resolve to the current default.
function sourceDirection(settings?: { toneAxisDirection?: ToneAxisDirection }): ToneAxisDirection {
  return settings?.toneAxisDirection ?? DEFAULT_SETTINGS.toneAxisDirection
}

// Bring whole color ramps in from another palette (ADR-028): an icon button opens
// a Figma-style inverted dropdown of the OTHER palettes; picking one opens a modal
// with an all-on swatch grid (reusing the extractor's `Swatch`), and the selected
// PaletteColors are imported in full (entire gradient, name, stops).
export function PaletteImport({ onImport }: PaletteImportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [source, setSource] = useState<ImportSource | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Overlay scrollbar on the swatch grid (mounts/unmounts with the modal body).
  const { ref: gridRef } = useOverlayScrollbars({ overflow: { x: 'hidden', y: 'scroll' } })

  const activeRef = useLibraryStore((s) => s.activeRef)
  const documentBody = useLibraryStore((s) => s.documentBody)
  const documentName = useLibraryStore((s) => s.documentName)
  const palettes = useLibraryStore((s) => s.palettes)

  // Every palette except the active one, with its colors resolved to runtime form
  // for preview + import. Empty palettes are omitted (nothing to import).
  const sources = useMemo<ImportSource[]>(() => {
    const list: ImportSource[] = []
    if (activeRef.kind !== 'document') {
      const colors = toRuntimeColors(documentBody)
      const direction = sourceDirection(documentBody.settings)
      if (colors.length > 0) list.push({ key: 'document', name: documentName, colors, direction })
    }
    for (const palette of palettes) {
      if (activeRef.kind === 'user' && activeRef.id === palette.id) continue
      const colors = toRuntimeColors(palette)
      const direction = sourceDirection(palette.settings)
      if (colors.length > 0) list.push({ key: palette.id, name: palette.name, colors, direction })
    }
    return list
  }, [activeRef, documentBody, documentName, palettes])

  useEffect(() => {
    if (menuOpen === false) return
    function onPointerDown(event: MouseEvent) {
      const container = containerRef.current
      if (container !== null && container.contains(event.target as Node) === false) {
        setMenuOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  function chooseSource(src: ImportSource) {
    setMenuOpen(false)
    setSource(src)
    setSelected(new Set(src.colors.map((c) => c.id))) // all-on by default
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    if (source === null) return
    const picked = source.colors.filter((c) => selected.has(c.id))
    if (picked.length > 0) onImport(picked, source.direction)
    setSource(null)
  }

  return (
    <div class={styles.importer} ref={containerRef}>
      <Tooltip content="Import from another palette">
        <IconButton onClick={() => setMenuOpen((v) => !v)} disabled={sources.length === 0}>
          <IconLibrary24 />
        </IconButton>
      </Tooltip>

      {menuOpen && (
        <div class={styles.menu} role="menu">
          {sources.map((src) => (
            <button
              key={src.key}
              type="button"
              class={styles.menuItem}
              role="menuitem"
              title={src.name}
              onClick={() => chooseSource(src)}
            >
              {src.name}
            </button>
          ))}
        </div>
      )}

      <Modal
        open={source !== null}
        title={source !== null ? `Import from “${source.name}”` : ''}
        onCloseButtonClick={() => setSource(null)}
        onEscapeKeyDown={() => setSource(null)}
        onOverlayClick={() => setSource(null)}
        style={{ borderRadius: '12px' }}
      >
        {source !== null && (
          <div class={styles.body}>
            <div class={styles.gridScroll} ref={gridRef}>
              <div class={styles.grid}>
                {source.colors.map((color) => (
                  <Swatch
                    key={color.id}
                    hex={colorToHex(keyColorOf(color))}
                    selected={selected.has(color.id)}
                    onToggle={() => toggle(color.id)}
                  />
                ))}
              </div>
            </div>
            <div class={styles.footer}>
              <Button secondary fullWidth onClick={() => setSource(null)}>
                Cancel
              </Button>
              <Button fullWidth onClick={submit} disabled={selected.size === 0}>
                Import {selected.size} {selected.size === 1 ? 'color' : 'colors'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
