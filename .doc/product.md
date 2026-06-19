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

The editor always edits exactly one **active** palette, picked in the header
switcher. There are two kinds:

- **Document palette** — stored in the Figma file (`sharedPluginData`). Anyone who
  opens the plugin in that file sees it, and it's the source for Create
  variables/styles. Its name is the file name (read-only). Exactly one per file.
- **User palettes** — a private library stored per user (`clientStorage`),
  available in every file — a sandbox for experiments that others don't see. You
  can create, rename, duplicate, and delete them.

The **input color model** is a single per-user preference (it applies to every
palette and isn't part of any palette's data or undo history).

## Current features

- **Palette switcher** (header, top-left) — a chevron + the active palette's name.
  Opening it lists the **Current file** palette (the document palette, labelled by
  the file name) and your **Saved palettes** library, with a "+" to create a new
  (empty) palette; each saved row reveals duplicate and delete on hover. Selecting a
  row switches the editor to that palette. The active user palette's name is
  editable in the header (the document palette's is read-only). Deleting a saved
  palette asks to confirm (it bypasses undo); deleting the active one falls back to
  the document palette. Switching palettes is instant and never loses a pending
  edit, but it does reset that palette's undo history.
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
  - **Reorder by drag** — drag a card to reposition it in the row; a floating
    copy follows the cursor while the others shift to open a slot. The list
    auto-scrolls when you drag near an edge, and a reorder is one undo step.
- **Pull colors from the canvas** — selecting layers exposes their solid fills to
  the plugin: the per-card eyedropper sets a card to the first selected fill, and
  an **add-matching** button (next to "+") appends every selected fill as new key
  colors. (Figma's native eyedropper isn't available to plugins, so this works off
  the selection instead.)
- **Extract colors from an image** — an image button in the Key colors header
  opens a window where you drop, paste, upload, or link an image; the plugin pulls
  its dominant colors (k-means clustering). A full-area view shows the image beside
  a grid of the extracted swatches — choose how many to pull (a stepper), click
  swatches to include/exclude them, and add the selected ones as key colors. Pasted
  or linked URLs are best-effort (some image hosts block off-site reads — drop or
  upload the file instead).
- **Shades** — a tonal scale generated for every key color. Each key color is a
  gradient (near-black & white ends with the key color placed by its lightness);
  shades are sampled along it in the **blending color model**. A row of step inputs uses
  the tailwind 1/1000 scale (0…1000): a count stepper (2–26, default 11), values
  evenly distributed by default, each editable — unset steps show their auto value
  as a placeholder, and a custom value re-distributes the unset steps around it.
  The grid shows one row of swatches per key color.
- **Gradient editor** — clicking a key color's swatch row expands an inline editor:
  a gradient track with a draggable handle per stop (drag to move, press empty
  track to add a stop, up to 7 total), and a card per stop to recolor it, pin or
  auto-place its position, or delete it. A stop's color picker shows a
  **saturation/lightness square + hue slider**, with the gradient's other stops
  marked on the square so the tonal progression is visible.
- **Settings popover** (gear icon, top-right):
  - **Input color model** — `HSL` / `HSV` / `LCH`, labelled *all palettes*. A
    user-global preference: switching it recomputes every key color's channel
    values into the new model (across all palettes) without touching any color and
    without an undo entry.
  - **Blending color model** — `RGB` / `HSL` / `OKLCH` / `LCH`. The model the shade
    gradient is interpolated in (palette-scoped).
  - **Tone axis direction** — `Dark → Light` / `Light → Dark`. Which end of the
    shade scale (step 0) is light; flipping it mirrors every gradient.
  - **Variable collection** — name of the Figma variable collection that **Create
    variables** writes into (default "Palette").
- **Export** (footer bar). Each button briefly confirms with a "… created" label
  after a press, then reverts; all are repeatable:
  - **Create variables** — writes every shade into the file's variables, named
    `{name}/{step}`, in the collection from settings (created if missing; existing
    same-named variables are updated in place).
  - **Create styles** — same, as paint styles named `{name}/{step}` (no
    collection).
  - **Create swatches** — drops the palette on the canvas as a grid of 40×40
    rectangles (8px gap, one row per key color), named `{name}/{step}`, wrapped in
    a frame.
- **Undo / redo** (top-right) — covers the whole active palette body, including
  color edits and the blending-model switch (the input-model switch and
  library actions like switching palettes are not undoable).
- **Automatic persistence** — edits to the document palette save to the file; edits
  to a user palette save to your private library. Reopening a file restores the
  palette that was active there.

## UX intentions

- **Native Figma feel** — reuse `@create-figma-plugin/ui` components and
  `--figma-color-*` tokens rather than bespoke chrome.
- **Color correctness** — work through `culori`; map out-of-gamut colors sensibly
  so channel values never show nonsense (e.g. saturation > 100%).
- **Raw, forgiving inputs** — channel fields keep exactly what the user typed; the
  model is recomputed losslessly through `culori` on model switch.

## Planned / not yet built

- Copy CSS: the shade grid as CSS custom properties on the clipboard (the
  variables/styles canvas exports already ship).

See [tasks.md](tasks.md) for status and [architecture.md](architecture.md) for how it's built.
