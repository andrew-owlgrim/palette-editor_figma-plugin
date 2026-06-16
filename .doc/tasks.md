# Tasks

Volatile working state. Last updated: 2026-06-16.

## Done

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

- **Custom color picker** to replace the native `<input type="color">` placeholder
  (oklch/hsv canvas). The `ColorSample` component is the integration point.
- **Gradient editor** (stops editor).
- **Drag-and-drop reordering** of key colors (DnD Kit already installed).

## Backlog / ideas

- Palette generation from key colors (scales / harmonies) — additional body blocks.
- Blending using the configured blending color model.
- Per-user palettes across files (via `clientStorage`; wrappers already exist).
- Possibly: live concurrent multi-user sync (currently load-on-open only).
