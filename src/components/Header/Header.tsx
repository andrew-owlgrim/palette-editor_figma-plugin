import {
  IconButton,
  IconNavigateBack24,
  IconNavigateForward24,
  IconSettings24,
} from '@create-figma-plugin/ui'
import { useRef, useState } from 'preact/hooks'
import logo from '@/assets/logo.svg'
import { Popover } from '@/components/Popover/Popover'
import { SettingsPopover } from '@/components/SettingsPopover/SettingsPopover'
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
      <div class={styles.brand}>
        <img class={styles.logo} src={logo} alt="" />
        <span class={styles.name}>Palette Editor</span>
      </div>

      <div class={styles.actions}>
        <IconButton onClick={() => undo()} disabled={canUndo === false}>
          <IconNavigateBack24 />
        </IconButton>
        <IconButton onClick={() => redo()} disabled={canRedo === false}>
          <IconNavigateForward24 />
        </IconButton>
        <div class={styles.settingsAnchor} ref={anchorRef}>
          <IconButton onClick={() => setSettingsOpen((open) => !open)}>
            <IconSettings24 />
          </IconButton>
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
