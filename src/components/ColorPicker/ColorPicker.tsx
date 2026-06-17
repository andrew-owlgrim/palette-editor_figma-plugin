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
import { keyColorOf, keyStopOf } from '@/color/gradient'
import { usePaletteStore } from '@/store'
import { beginLiveEdit, endLiveEdit } from '@/store/history'
import styles from './ColorPicker.css'

interface ColorPickerProps {
  // The palette color and the specific stop being edited (the key stop, or any
  // gradient stop from the gradient editor).
  paletteColorId: string
  stopId: string
}

// Closed via outside-click or a re-click on the swatch (handled by the Popover /
// host card) — no explicit close button.
export function ColorPicker({ paletteColorId, stopId }: ColorPickerProps) {
  const model = usePaletteStore((s) => s.settings.inputColorModel)
  const keyColors = usePaletteStore((s) => s.keyColors)
  const setStopChannel = usePaletteStore((s) => s.setStopChannel)
  const setStopChannels = usePaletteStore((s) => s.setStopChannels)
  const setStopFromHex = usePaletteStore((s) => s.setStopFromHex)

  const paletteColor = keyColors.find((k) => k.id === paletteColorId)
  const stop = paletteColor?.stops.find((s) => s.id === stopId)
  if (paletteColor === undefined || stop === undefined) return null

  const { channels } = stop
  const hex = colorToHex(stop.color)
  const { hue, radius01 } = channelsToWheel(channels, model)
  const axis = channelsToAxis(channels, model)
  const gradient = buildAxisGradient(channels, model)
  const conic = buildHueWheelConic(model)
  const channelDefs = MODELS[model].channels

  // Other key colors shown as reference dots on the wheel.
  const dots: WheelDot[] = keyColors
    .filter((k) => k.id !== paletteColorId)
    .map((k) => {
      const wheel = channelsToWheel(keyStopOf(k).channels, model)
      return {
        id: k.id,
        hue: wheel.hue,
        radius01: wheel.radius01,
        color: colorToHex(keyColorOf(k)),
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
          setStopChannels(paletteColorId, stopId, wheelToChannels(nextHue, nextRadius, model))
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
          setStopChannel(paletteColorId, stopId, id, value)
        }}
        onDragStart={beginLiveEdit}
        onDragEnd={endLiveEdit}
      />

      <GhostInput value={hex} onChange={(value) => setStopFromHex(paletteColorId, stopId, value)} />

      <div class={styles.channels}>
        {channelDefs.map((channel) => (
          <ChannelInput
            key={channel.id}
            channel={channel}
            value={channels[channel.id] ?? ''}
            onValueInput={(value) => setStopChannel(paletteColorId, stopId, channel.id, value)}
          />
        ))}
      </div>
    </div>
  )
}
