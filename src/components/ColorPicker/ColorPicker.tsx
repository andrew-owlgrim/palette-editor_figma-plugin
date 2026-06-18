import { ChannelInput } from '@/components/ChannelInput/ChannelInput'
import { GhostInput } from '@/components/GhostInput/GhostInput'
import { Gradient } from '@/components/Gradient/Gradient'
import { HueWheel } from '@/components/HueWheel/HueWheel'
import type { WheelDot } from '@/components/HueWheel/HueWheel'
import { SquareField } from '@/components/SquareField/SquareField'
import type { SquareDot } from '@/components/SquareField/SquareField'
import {
  axisToChannel,
  buildAxisGradient,
  buildHueSliderGradient,
  buildHueWheelConic,
  channelsToAxis,
  channelsToHue01,
  channelsToSquare,
  channelsToWheel,
  hue01ToChannel,
  squareToChannels,
  wheelToChannels,
} from '@/color/picker'
import { colorToHex, MODELS } from '@/color/models'
import { keyColorOf, keyStopOf } from '@/color/gradient'
import { usePaletteStore } from '@/store'
import { beginLiveEdit, endLiveEdit } from '@/store/history'
import type { ColorChannels, InputColorModel, PaletteColor } from '@/types'
import styles from './ColorPicker.css'

// Which 2D surface to show. `wheel` (hue ring + lightness slider) suits a single
// key color and marks the OTHER key colors as reference dots. `square` (S/L ·
// S/V · C/L field + hue slider) suits a gradient stop and marks the OTHER stops
// of the same color, so the lightness/saturation dynamics along the ramp show.
type PickerSurface = 'wheel' | 'square'

interface ColorPickerProps {
  // The palette color and the specific stop being edited (the key stop, or any
  // gradient stop from the gradient editor).
  paletteColorId: string
  stopId: string
  surface?: PickerSurface
}

// Closed via outside-click or a re-click on the swatch (handled by the Popover /
// host card) — no explicit close button.
export function ColorPicker({ paletteColorId, stopId, surface = 'wheel' }: ColorPickerProps) {
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
  const channelDefs = MODELS[model].channels

  return (
    <div class={styles.picker}>
      {surface === 'square' ? (
        <SquareSurface
          paletteColor={paletteColor}
          stopId={stopId}
          channels={channels}
          hex={hex}
          model={model}
          onChannels={(patch) => setStopChannels(paletteColorId, stopId, patch)}
          onChannel={(id, value) => setStopChannel(paletteColorId, stopId, id, value)}
        />
      ) : (
        <WheelSurface
          paletteColorId={paletteColorId}
          keyColors={keyColors}
          channels={channels}
          hex={hex}
          model={model}
          onChannels={(patch) => setStopChannels(paletteColorId, stopId, patch)}
          onChannel={(id, value) => setStopChannel(paletteColorId, stopId, id, value)}
        />
      )}

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

interface SurfaceProps {
  channels: ColorChannels
  hex: string
  model: InputColorModel
  onChannels: (patch: ColorChannels) => void
  onChannel: (id: string, value: string) => void
}

// Hue ring (angle + radius) + lightness/value slider. Other key colors mark the
// ring so a new color can be placed relative to the existing palette.
function WheelSurface({
  paletteColorId,
  keyColors,
  channels,
  hex,
  model,
  onChannels,
  onChannel,
}: SurfaceProps & { paletteColorId: string; keyColors: PaletteColor[] }) {
  const { hue, radius01 } = channelsToWheel(channels, model)
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
    <>
      <HueWheel
        hue={hue}
        radius01={radius01}
        color={hex}
        conic={buildHueWheelConic(model)}
        dots={dots}
        onChange={(nextHue, nextRadius) => onChannels(wheelToChannels(nextHue, nextRadius, model))}
        onDragStart={beginLiveEdit}
        onDragEnd={endLiveEdit}
      />
      <Gradient
        value={channelsToAxis(channels, model)}
        gradient={buildAxisGradient(channels, model)}
        color={hex}
        onChange={(t) => {
          const { id, value } = axisToChannel(t, model)
          onChannel(id, value)
        }}
        onDragStart={beginLiveEdit}
        onDragEnd={endLiveEdit}
      />
    </>
  )
}

// Saturation/chroma × lightness/value square (hue held fixed) + hue slider. The
// other stops of THIS color mark the square, exposing the ramp's S/L dynamics.
function SquareSurface({
  paletteColor,
  stopId,
  channels,
  hex,
  model,
  onChannels,
  onChannel,
}: SurfaceProps & { paletteColor: PaletteColor; stopId: string }) {
  const square = channelsToSquare(channels, model)
  const dots: SquareDot[] = paletteColor.stops
    .filter((s) => s.id !== stopId)
    .map((s) => {
      const pos = channelsToSquare(s.channels, model)
      return { id: s.id, x: pos.x, y: pos.y }
    })

  return (
    <>
      <SquareField
        x={square.x}
        y={square.y}
        color={hex}
        channels={channels}
        model={model}
        dots={dots}
        onChange={(nx, ny) => onChannels(squareToChannels(nx, ny, model))}
        onDragStart={beginLiveEdit}
        onDragEnd={endLiveEdit}
      />
      <Gradient
        value={channelsToHue01(channels, model)}
        gradient={buildHueSliderGradient(model)}
        color={hex}
        onChange={(t) => {
          const { id, value } = hue01ToChannel(t, model)
          onChannel(id, value)
        }}
        onDragStart={beginLiveEdit}
        onDragEnd={endLiveEdit}
      />
    </>
  )
}
