# Tasks

Volatile working state. Last updated: 2026-06-19.

## Done

- **Multiple palettes — document palette + per-user library** (ADR-026/027): the
  editor now edits one *active* palette, switched in a header `PaletteSwitcher`
  (chevron + name; Current file / Saved palettes popover; delete-confirm Modal).
  Identity (`id`/`name`/`updatedAt`) wraps the body. Document palette unchanged in
  `sharedPluginData` (id = `figma.root.id`, name = file name, read-only, passed as
  props → no schema migration); user palettes + prefs + per-file active pointers in
  one `clientStorage` `UserLibrary` (async, `loading`, version-gated, mutex'd
  writes + quota guard). New `store/library.ts` (plain zustand: library state +
  debounced save router that routes by `activeRef.kind` and dedupes on the
  serialized body) and `store/prefs.ts` (user-global `inputColorModel` holder,
  split from `Settings`, re-derives channels under temporal pause → not undoable).
  `selectPalette` flushes pending save, hydrates, `temporal.clear()`s, re-baselines.
- **Image color extraction** (ADR-025): an image button in the Key colors header
  opens an intake modal (drag / click-upload / paste / direct URL), then a
  full-area workspace (image + count stepper + 2-col swatch grid + submit/cancel)
  that **replaces** the normal UI. `color/extract.ts` = k-means++ in OKLab with
  best-of-N restarts (`RESTARTS`) for stability; `utils/image.ts` decodes +
  downsamples (`DOWNSAMPLE_MAX`); `store/extractor.ts` = ephemeral stage machine.
  Selected colors → `addKeyColors`. All UI-thread (no `main.ts` change); only
  config touch is `networkAccess` for URL fetch (best-effort, CORS-bound).

- **Export — swatches / variables / styles** (ADR-024): `Footer` export bar.
  `color/export.ts` `buildExportPalette` resolves the palette (names + per-step
  hex, reusing the grid's samplers) and the UI `emit`s `EXPORT_SWATCHES` /
  `CREATE_VARIABLES` / `CREATE_STYLES`; `main.ts` materializes them. Swatches = a
  native GRID-layout frame of 40px FILL cells (8px gap); names unified `{name}/{step}`
  across swatches/variables/styles; variables go in the settings collection, styles
  are flat; both update in place by name. New `Settings.collectionName` (default
  "Palette") + a Textbox in Settings. After a press each button flashes a "✔ Done"
  label + success fill for a moment (local `Footer` state), then reverts —
  repeatable, not disabled.
- **Square picker for gradient stops** (ADR-023): `ColorPicker` gains a `surface`
  prop. `StopCard` uses `surface="square"` — a canvas-sampled saturation/chroma ×
  lightness/value `SquareField` + a hue `Gradient` slider, with the color's other
  stops shown as reference dots (S/L dynamics along the ramp). Key-color cards keep
  the hue wheel. Same model-agnostic `picker` axes, regrouped; field gamut-mapped
  for all models incl. LCH. Plus a **`MAX_STOPS` = 7 cap** (`canAddStop`) — at the
  cap an empty-track press no longer adds a stop.
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

- **Copy CSS** — shade grid → CSS custom properties on the clipboard (the
  variables/styles/swatch canvas exports already ship — ADR-024).

## Backlog / ideas

- Palette generation from key colors (scales / harmonies) — additional body blocks.
- "Publish to document" cross-action + a variables-only-from-document invariant
  (deferred from ADR-026; export currently runs on the active palette).
- Possibly: live concurrent multi-user sync (currently load-on-open only).
