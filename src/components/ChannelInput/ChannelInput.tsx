import { TextboxNumeric } from '@create-figma-plugin/ui'
import type { ChannelDef } from '@/color/models'
import { beginLiveEdit, endLiveEdit } from '@/store/history'
import { blurOnEnter } from '@/utils/keyboard'
import styles from './ChannelInput.css'

interface ChannelInputProps {
  channel: ChannelDef
  value: string
  onValueInput: (value: string) => void
}

// A single channel field with its label rendered inside the input (as the DS
// `icon` slot) — e.g. an "H" tag glued to the left edge of the value. Per-
// keystroke edits are coalesced into one undo step via the focus/blur window.
export function ChannelInput({ channel, value, onValueInput }: ChannelInputProps) {
  return (
    <TextboxNumeric
      icon={<span class={styles.tag}>{channel.label}</span>}
      value={value}
      minimum={channel.minimum}
      maximum={channel.maximum}
      onValueInput={onValueInput}
      onFocus={beginLiveEdit}
      onBlur={endLiveEdit}
      onKeyDown={blurOnEnter}
    />
  )
}
