# Product

## What it is

**My Colors** ("Palette Editor") is a Figma plugin for generating and editing
color palettes. It runs in a 720×640 window and aims to feel native inside
Figma by using the Figma design-system components and color tokens.

## Why

Designers need a fast, in-Figma way to define a set of seed ("key") colors and,
from them, generate full palettes — working in perceptually meaningful color
spaces and keeping the result available to everyone editing the same file.

## Who sees what

- **Per-file palette.** The palette is stored in the Figma file. Anyone who
  opens the plugin in that file sees the same palette. (Persisted via
  `sharedPluginData`; loaded when the plugin opens.)
- Per-user palettes (across files, via `clientStorage`) are a possible future
  addition — not built yet.

## Current features

- **Key colors** — a horizontally scrolling list of color cards. Each card has:
  - a square color sample — click opens a **custom color picker** in a popover
    (hue wheel, lightness slider, hex field, and per-channel inputs in the
    current **input color model**),
  - a **reroll** button — replaces the color with a fresh one that's harmonious
    with the rest of the palette,
  - an **eyedropper** button — appears when the canvas selection has a fill; sets
    the card to that color,
  - a delete button,
  - a name field — **auto-named** from the color (e.g. "Lavender") unless you pin
    a custom name; the auto name follows the color as it changes.
  - The "+" button adds a new color chosen to be harmonious with the existing
    ones (auto-named); on an empty list it's a random color.
- **Pull colors from the canvas** — selecting layers exposes their solid fills to
  the plugin: the per-card eyedropper sets a card to the first selected fill, and
  an **add-matching** button (next to "+") appends every selected fill as new key
  colors. (Figma's native eyedropper isn't available to plugins, so this works off
  the selection instead.)
- **Settings popover** (gear icon, top-right):
  - **Input color model** — `HSL` / `HSV` / `LCH`. Switching it recomputes every
    key color's channel values into the new model.
  - **Blending color model** — `RGB` / `HSL` / `OKLCH` (stored now; used by future
    blending/interpolation features).
- **Undo / redo** (top-left) — covers the whole palette document, including color
  edits and color-model switches.
- **Per-file persistence** — changes are saved to the file automatically.

## UX intentions

- **Native Figma feel** — reuse `@create-figma-plugin/ui` components and
  `--figma-color-*` tokens rather than bespoke chrome.
- **Color correctness** — work through `culori`; map out-of-gamut colors sensibly
  so channel values never show nonsense (e.g. saturation > 100%).
- **Raw, forgiving inputs** — channel fields keep exactly what the user typed; the
  model is recomputed losslessly through `culori` on model switch.

## Planned / not yet built

- Gradient editor.
- Drag-and-drop reordering of swatches (DnD Kit is already a dependency).
- Palette generation from key colors (scales/harmonies) — the "first block"
  framing implies more blocks to come.
- Blending using the configured blending color model.

See [tasks.md](tasks.md) for status and [architecture.md](architecture.md) for how it's built.
