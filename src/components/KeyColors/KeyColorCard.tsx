import { IconButton, IconTrash24, Textbox, TextboxNumeric } from '@create-figma-plugin/ui'
import { ColorSample } from '@/components/ColorSample/ColorSample'
import { channelsToHex, MODELS } from '@/color/models'
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
  const setKeyColorFromHex = usePaletteStore((s) => s.setKeyColorFromHex)

  const channelDefs = MODELS[inputColorModel].channels
  const hex = channelsToHex(keyColor.channels, inputColorModel)

  return (
    <div class={styles.card}>
      <div class={styles.sampleRow}>
        <ColorSample hex={hex} onChange={(value) => setKeyColorFromHex(keyColor.id, value)} />
        <div class={styles.deleteButton}>
          <IconButton onClick={() => removeKeyColor(keyColor.id)}>
            <IconTrash24 />
          </IconButton>
        </div>
      </div>

      <Textbox
        value={keyColor.name}
        placeholder="Name"
        onValueInput={(value) => renameKeyColor(keyColor.id, value)}
      />

      <div class={styles.channels}>
        {channelDefs.map((channel) => (
          <div key={channel.id} class={styles.channelRow}>
            <span class={styles.channelLabel}>{channel.label}</span>
            <TextboxNumeric
              value={keyColor.channels[channel.id] ?? ''}
              minimum={channel.minimum}
              maximum={channel.maximum}
              onValueInput={(value) => setKeyColorChannel(keyColor.id, channel.id, value)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
