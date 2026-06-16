import { ChannelInput } from '@/components/ChannelInput/ChannelInput'
import { GhostInput } from '@/components/GhostInput/GhostInput'
import { Gradient } from '@/components/Gradient/Gradient'
import { HueWheel } from '@/components/HueWheel/HueWheel'
import type { WheelDot } from '@/components/HueWheel/HueWheel'
import {
  axisToChannel,
  buildAxisGradient,
  buildHueWheelConic,
  channelsToAxis,
  channelsToWheel,
  wheelToChannels,
} from '@/color/picker'
import { colorToHex, MODELS } from '@/color/models'
import { usePaletteStore } from '@/store'
import { beginLiveEdit, endLiveEdit } from '@/store/history'
import styles from './ColorPicker.css'

interface ColorPickerProps {
  keyColorId: string
}

// Closed via outside-click or a re-click on the swatch (handled by the Popover /
// KeyColorCard) — no explicit close button.
export function ColorPicker({ keyColorId }: ColorPickerProps) {
  const model = usePaletteStore((s) => s.settings.inputColorModel)
  const keyColors = usePaletteStore((s) => s.keyColors)
  const setKeyColorChannel = usePaletteStore((s) => s.setKeyColorChannel)
  const setKeyColorChannels = usePaletteStore((s) => s.setKeyColorChannels)
  const setKeyColorFromHex = usePaletteStore((s) => s.setKeyColorFromHex)

  const keyColor = keyColors.find((k) => k.id === keyColorId)
  if (keyColor === undefined) return null

  const { channels } = keyColor
  const hex = colorToHex(keyColor.color)
  const { hue, radius01 } = channelsToWheel(channels, model)
  const axis = channelsToAxis(channels, model)
  const gradient = buildAxisGradient(channels, model)
  const conic = buildHueWheelConic(model)
  const channelDefs = MODELS[model].channels

  const dots: WheelDot[] = keyColors
    .filter((k) => k.id !== keyColorId)
    .map((k) => {
      const wheel = channelsToWheel(k.channels, model)
      return {
        id: k.id,
        hue: wheel.hue,
        radius01: wheel.radius01,
        color: colorToHex(k.color),
      }
    })

  return (
    <div class={styles.picker}>
      <HueWheel
        hue={hue}
        radius01={radius01}
        color={hex}
        conic={conic}
        dots={dots}
        onChange={(nextHue, nextRadius) =>
          setKeyColorChannels(keyColorId, wheelToChannels(nextHue, nextRadius, model))
        }
        onDragStart={beginLiveEdit}
        onDragEnd={endLiveEdit}
      />

      <Gradient
        value={axis}
        gradient={gradient}
        color={hex}
        onChange={(t) => {
          const { id, value } = axisToChannel(t, model)
          setKeyColorChannel(keyColorId, id, value)
        }}
        onDragStart={beginLiveEdit}
        onDragEnd={endLiveEdit}
      />

      <GhostInput value={hex} onChange={(value) => setKeyColorFromHex(keyColorId, value)} />

      <div class={styles.channels}>
        {channelDefs.map((channel) => (
          <ChannelInput
            key={channel.id}
            channel={channel}
            value={channels[channel.id] ?? ''}
            onValueInput={(value) => setKeyColorChannel(keyColorId, channel.id, value)}
          />
        ))}
      </div>
    </div>
  )
}
