import {
  IconButton,
  IconNavigateBack24,
  IconNavigateForward24,
  IconSettings24,
} from '@create-figma-plugin/ui'
import { useRef, useState } from 'preact/hooks'
import { PaletteSwitcher } from '@/components/PaletteSwitcher/PaletteSwitcher'
import { Popover } from '@/components/Popover/Popover'
import { SettingsPopover } from '@/components/SettingsPopover/SettingsPopover'
import { Tooltip } from '@/components/Tooltip/Tooltip'
import { useTemporalStore } from '@/store'
import styles from './Header.css'

export function Header() {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const undo = useTemporalStore((s) => s.undo)
  const redo = useTemporalStore((s) => s.redo)
  const canUndo = useTemporalStore((s) => s.pastStates.length > 0)
  const canRedo = useTemporalStore((s) => s.futureStates.length > 0)

  return (
    <header class={styles.header}>
      <PaletteSwitcher />

      <div class={styles.actions}>
        <Tooltip content="Undo">
          <IconButton onClick={() => undo()} disabled={canUndo === false}>
            <IconNavigateBack24 />
          </IconButton>
        </Tooltip>
        <Tooltip content="Redo">
          <IconButton onClick={() => redo()} disabled={canRedo === false}>
            <IconNavigateForward24 />
          </IconButton>
        </Tooltip>

        <div class={styles.settingsAnchor} ref={anchorRef}>
          <Tooltip content="Settings">
            <IconButton onClick={() => setSettingsOpen((open) => !open)}>
              <IconSettings24 />
            </IconButton>
          </Tooltip>
          <Popover
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            containerRef={anchorRef}
          >
            <SettingsPopover />
          </Popover>
        </div>
      </div>
    </header>
  )
}
