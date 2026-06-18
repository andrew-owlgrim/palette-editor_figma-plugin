# Tasks

Volatile working state. Last updated: 2026-06-17.

## Done

- **Gradient editor polish** (ADR-022): (1) **phantom-hue fix** — near-gray stops
  (micro-chroma that rounds to s=0 in the UI) had a definite hue that culori
  carried through the dark shades; `buildGradientSampler` now drops the hue of
  achromatic stops (rgb max−min < `ACHROMATIC_EPS`) so the chromatic neighbor's
  hue carries instead. (2) **auto position normalized** to the gradient's real
  span `[DARK_ENDPOINT_L, 1]` so a color as dark as the dark endpoint maps to the
  end, not a gap. (3) **manual position is an editable %** — `StopCard` swaps the
  static label for a numeric `TextboxNumeric` when `autoPosition` is false.
- **Gradient editor** (ADR-022): clickable Shades rows inject a full-width
  `GradientEditor` under the active row — track with a draggable `Handle` per
  stop (press empty = add, press near an endpoint = no-op), full-width `StopCard`
  per stop (shared `ColorPicker` now targets `(paletteColorId, stopId)`, hover
  delete via `canDeleteStop`, position-% label, **"A"** auto toggle).
  `GradientStop` gains `autoPosition` (persisted) + a per-stop `channels` buffer
  (replaces `PaletteColor.channels`); color-edit store path is stop-addressed.
- **Shades + gradient model** (ADR-020/021): unified `KeyColor` → `PaletteColor`
  (a gradient whose key stop is the seed); `color/gradient.ts` (default stops,
  sampler, mirror) + `color/shades.ts` (0..1000 scale, `resolveSteps`). New
  `components/Shades` (count stepper, per-step inputs, swatch grid). Tone axis
  direction setting. Gradients persisted; key-stop position is a rewritable
  default (recomputed from lightness on edit until the editor lands).
- **Drag-and-drop reordering** (ADR-019): `@dnd-kit/sortable`,
  `horizontalListSortingStrategy`; whole card is the drag source
  (`PointerSensor` `distance: 1`); `DragOverlay` clone (`KeyColorCardPreview`) +
  hidden original = hole; commits via `moveKeyColor` (`arrayMove`, one undo
  step); name field stops `pointerdown` so text-select stays native.
- **Harmonious color generation** (ADR-018): `color/harmony.ts`
  `harmoniousColor(existing)` — max-min (farthest-point) over random candidates
  in OKLab, lightness-bounded to the central ~60%. Used by `addKeyColor` (was
  white) and a per-card **reroll** button (`rerollKeyColor`, excludes self,
  reverts to auto-name).
- **Icon-button tooltips** (ADR-017): `components/Tooltip` on `@floating-ui/dom`
  (offset/flip/shift/arrow, `fixed` strategy, 400 ms hover delay, keyboard
  `:focus-visible`); Figma-style dark bubble; wraps every icon button incl.
  disabled ones (undo/redo).
- **Undo/redo hotkeys:** Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (global `keydown` in
  `App`), skipped while a text field is focused.
- **Canvas selection → palette** (ADR-016): main-thread tracks top-level
  selection's solid fills (deduped) → ephemeral `store/selection.ts`; per-card
  eyedropper sets from first fill; "add matching" button appends all fills.
- **Auto color naming** (ADR-015): `customName ?? autoName(color)`; nearest sRGB
  match over a vendored ~1.5k ntc list; `NameInput` (empty → revert to auto).
- **LCH picker fidelity** (ADR-014): hue wheel painted in each model's own hue
  scale (`hueRingColor` + `buildHueWheelConic`); all display hex gamut-mapped
  (`toGamut('rgb','oklch')`) so extreme-L/high-C ends darken/lighten instead of
  clamping over-bright; hue 0° moved to the right (`ANGLE_OFFSET_DEG = 90`).
  Partial by choice: white center overlay + L-independent ring (L=55) kept.
- **Canonical float-rgb color as source of truth** (ADR-013): `KeyColor.color`
  (unclamped culori rgb) drives hex + channels; channels are a derived buffer.
  Channel edit → recompute color; hex edit → re-derive channels; model switch →
  channels only (reversible). Persist `color` only; migrate older files on load.

- Project init: `create-figma-plugin` v4 + Preact + TS, toolchain (ESLint,
  Prettier), build verified.
- Stable dev setup: react→preact/compat type aliasing, culori/zustand/zundo/dnd-kit
  wired and building clean.
- Main window layout: 720×640, fixed Header + scrolling body.
- Header: undo/redo (left), settings gear (right). (Logo + name removed per review.)
- Key colors: section with "Key colors" + "+", horizontal card list; card with
  sample, delete, name, channel inputs in the current input model.
- Settings popover: input color model (HSL/HSV/LCH) + blending color model
  (RGB/HSL/OKLCH); full-width segmented controls.
- Color model conversions on `culori`; switching input model recomputes channels.
- Gamut fix: `toGamut('rgb','oklch')` for hsl/hsv so channels never exceed range
  (white no longer shows s≈100).
- Removed `%` suffix from channel inputs (was polluting raw values).
- Per-file persistence: load-on-open + save-on-change via `sharedPluginData`.
- Fixed `sharedPluginData` namespace (`mycolors`, no hyphen).
- Project documentation (`CLAUDE.md` + `.doc/`).

## Next up

- **Export** — shade grid → Figma variables / styles / Copy CSS.

## Backlog / ideas

- Palette generation from key colors (scales / harmonies) — additional body blocks.
- Per-user palettes across files (via `clientStorage`; wrappers already exist).
- Possibly: live concurrent multi-user sync (currently load-on-open only).
