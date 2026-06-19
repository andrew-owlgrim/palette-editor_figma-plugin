import {
  Button,
  IconButton,
  IconChevronDown24,
  IconDuplicateSmall24,
  IconPlusSmall24,
  IconTrash24,
  Modal,
  Text,
} from '@create-figma-plugin/ui'
import { useMemo, useRef, useState } from 'preact/hooks'
import { Popover } from '@/components/Popover/Popover'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { useLibraryStore } from '@/store/library'
import type { Palette } from '@/types'
import styles from './PaletteSwitcher.css'

// Editable name field for the active USER palette. Focused-draft idiom (mirrors
// SettingsPopover's CollectionNameField): edits a local draft while focused,
// commits on blur/Enter; an empty commit keeps the previous name (handled by the
// store). Escape cancels. While unfocused it shows the live store value.
function RenameField({ id, name }: { id: string; name: string }) {
  const renamePalette = useLibraryStore((s) => s.renamePalette)
  const [draft, setDraft] = useState(name)
  const [focused, setFocused] = useState(false)

  return (
    <input
      class={styles.nameInput}
      value={focused ? draft : name}
      onFocus={() => {
        setDraft(name)
        setFocused(true)
      }}
      onInput={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        setFocused(false)
        renamePalette(id, draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        else if (event.key === 'Escape') {
          setDraft(name)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function SavedRow({
  palette,
  active,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  palette: Palette
  active: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <div
      class={`${styles.row} ${active ? styles.active : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect()
      }}
    >
      <span class={styles.rowName}>{palette.name}</span>
      <span class={styles.rowActions}>
        <Tooltip content="Duplicate">
          <IconButton
            onClick={(event) => {
              event.stopPropagation()
              onDuplicate()
            }}
          >
            <IconDuplicateSmall24 />
          </IconButton>
        </Tooltip>
        <Tooltip content="Delete">
          <IconButton
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          >
            <IconTrash24 />
          </IconButton>
        </Tooltip>
      </span>
    </div>
  )
}

// Header palette switcher (ADR-026): a chevron + the active palette's name, with
// a popover listing the document palette (Current file) and the user library
// (Saved palettes). The document palette's name is the file name and is
// read-only; user palettes are renameable inline via the header field.
export function PaletteSwitcher() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Palette | null>(null)

  const loading = useLibraryStore((s) => s.loading)
  const documentName = useLibraryStore((s) => s.documentName)
  const documentId = useLibraryStore((s) => s.documentId)
  const palettes = useLibraryStore((s) => s.palettes)
  const activeRef = useLibraryStore((s) => s.activeRef)
  const selectPalette = useLibraryStore((s) => s.selectPalette)
  const createPalette = useLibraryStore((s) => s.createPalette)
  const duplicatePalette = useLibraryStore((s) => s.duplicatePalette)
  const deletePalette = useLibraryStore((s) => s.deletePalette)

  const isUserActive = activeRef.kind === 'user'
  const activePalette = palettes.find((p) => p.id === activeRef.id)
  const activeName = isUserActive ? (activePalette?.name ?? '') : documentName

  // Saved palettes are listed most-recently-edited first (a save bumps
  // `updatedAt`). Sort a copy so the store array stays untouched.
  const sortedPalettes = useMemo(
    () => [...palettes].sort((a, b) => b.updatedAt - a.updatedAt),
    [palettes],
  )

  function select(palette: Palette | 'document') {
    setOpen(false)
    selectPalette(
      palette === 'document'
        ? { kind: 'document', id: documentId }
        : { kind: 'user', id: palette.id },
    )
  }

  function confirmDelete() {
    if (deleteTarget !== null) deletePalette(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div class={styles.switcher} ref={containerRef}>
      <div class={styles.group}>
        <div class={styles.cellChevron}>
          <IconButton onClick={() => setOpen((v) => !v)}>
            <IconChevronDown24 />
          </IconButton>
        </div>
        {isUserActive ? (
          <RenameField id={activeRef.id} name={activeName} />
        ) : (
          <div class={styles.name} title={activeName}>
            {activeName}
          </div>
        )}
      </div>

      <Popover open={open} onClose={() => setOpen(false)} containerRef={containerRef} align="left">
        <div class={styles.menu}>
          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <span class={styles.sectionTitle}>Current file</span>
            </div>
            <div
              class={`${styles.row} ${activeRef.kind === 'document' ? styles.active : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => select('document')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') select('document')
              }}
            >
              <span class={styles.rowName}>{documentName}</span>
            </div>
          </section>

          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <span class={styles.sectionTitle}>Saved palettes</span>
              <Tooltip content="New palette">
                <IconButton
                  onClick={() => {
                    setOpen(false)
                    createPalette()
                  }}
                >
                  <IconPlusSmall24 />
                </IconButton>
              </Tooltip>
            </div>
            {loading ? (
              <div class={styles.hint}>Loading…</div>
            ) : palettes.length === 0 ? (
              <div class={styles.hint}>No saved palettes yet</div>
            ) : (
              sortedPalettes.map((palette) => (
                <SavedRow
                  key={palette.id}
                  palette={palette}
                  active={isUserActive && palette.id === activeRef.id}
                  onSelect={() => select(palette)}
                  onDuplicate={() => {
                    setOpen(false)
                    duplicatePalette(palette.id)
                  }}
                  onDelete={() => {
                    setOpen(false)
                    setDeleteTarget(palette)
                  }}
                />
              ))
            )}
          </section>
        </div>
      </Popover>

      <Modal
        open={deleteTarget !== null}
        title="Delete palette"
        onCloseButtonClick={() => setDeleteTarget(null)}
        onEscapeKeyDown={() => setDeleteTarget(null)}
        onOverlayClick={() => setDeleteTarget(null)}
        style={{ borderRadius: '12px' }}
      >
        <div class={styles.confirm}>
          <Text>Delete “{deleteTarget?.name}”? This can’t be undone.</Text>
          <div class={styles.confirmActions}>
            <Button secondary onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button danger onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
