import { IconButton, IconTrash24, Textbox } from '@create-figma-plugin/ui'
import { useRef, useState } from 'preact/hooks'
import { ChannelInput } from '@/components/ChannelInput/ChannelInput'
import { ColorPicker } from '@/components/ColorPicker/ColorPicker'
import { ColorSample } from '@/components/ColorSample/ColorSample'
import { Popover } from '@/components/Popover/Popover'
import { colorToHex, MODELS } from '@/color/models'
import { usePaletteStore } from '@/store'
import type { KeyColor } from '@/types'
import styles from './KeyColorCard.css'

interface KeyColorCardProps {
  keyColor: KeyColor
}

export function KeyColorCard({ keyColor }: KeyColorCardProps) {
  const inputColorModel = usePaletteStore((s) => s.settings.inputColorModel)
  const removeKeyColor = usePaletteStore((s) => s.removeKeyColor)
  const renameKeyColor = usePaletteStore((s) => s.renameKeyColor)
  const setKeyColorChannel = usePaletteStore((s) => s.setKeyColorChannel)

  const containerRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const channelDefs = MODELS[inputColorModel].channels
  const hex = colorToHex(keyColor.color)

  return (
    <div class={styles.card}>
      <div class={styles.sampleRow} ref={containerRef}>
        <div ref={anchorRef}>
          <ColorSample hex={hex} onClick={() => setPickerOpen((open) => !open)} />
        </div>
        <div class={styles.deleteButton}>
          <IconButton onClick={() => removeKeyColor(keyColor.id)}>
            <IconTrash24 />
          </IconButton>
        </div>
        <Popover
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          containerRef={containerRef}
          anchorRef={anchorRef}
          placement="right-top"
        >
          <ColorPicker keyColorId={keyColor.id} onClose={() => setPickerOpen(false)} />
        </Popover>
      </div>

      <Textbox
        value={keyColor.name}
        placeholder="Name"
        onValueInput={(value) => renameKeyColor(keyColor.id, value)}
      />

      <div class={styles.channels}>
        {channelDefs.map((channel) => (
          <ChannelInput
            key={channel.id}
            channel={channel}
            value={keyColor.channels[channel.id] ?? ''}
            onValueInput={(value) => setKeyColorChannel(keyColor.id, channel.id, value)}
          />
        ))}
      </div>
    </div>
  )
}
