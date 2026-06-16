# Architecture

## Stack

- **Toolkit:** `create-figma-plugin` v4 (`@create-figma-plugin/build`, `…/ui`,
  `…/utilities`, `…/tsconfig`). esbuild under the hood.
- **UI:** Preact 10 (React aliased to `preact/compat` for libraries that expect React).
- **Language:** TypeScript 5.
- **Color:** `culori` v4 (+ `@types/culori`).
- **State:** `zustand` v5 + `zundo` v2 (undo/redo).
- **DnD (planned use):** `@dnd-kit/core` / `…/sortable` / `…/utilities`.
- **Styling:** CSS Modules (built into the toolkit) + Figma CSS variables.

## Two threads + the bridge

Figma plugins run in two contexts:

- **Main thread** (`src/main.ts`) — has the `figma.*` API. Owns persistence.
- **UI thread** (the iframe, `src/ui.tsx` → `src/app/App.tsx`) — Preact app +
  the zustand store. No access to `figma.*`.

They communicate via `emit` / `on` from `@create-figma-plugin/utilities`
(a typed wrapper over `postMessage`). `showUI(options, data)` also passes `data`
straight through as **props** to the root component (the toolkit's `render`
spreads them onto the component).

```
main.ts  ──showUI(opts,{initialDocument})──▶  App (props)
   ▲                                            │
   ├──── on('SAVE_DOCUMENT') ◀── emit('SAVE_DOCUMENT', doc)        (debounced)
   ├──── on('REQUEST_SELECTION_FILLS') ◀── emit(...)               (once, on UI mount)
   └──── emit('SELECTION_FILLS', { fills }) ──▶ on(...)            (selection / page change)
```

## Data model

`src/types/index.ts`:

```ts
type InputColorModel = 'hsl' | 'hsv' | 'lch'
type BlendingColorModel = 'rgb' | 'hsl' | 'oklch'

// Raw input-field strings keyed by channel id, in the CURRENT input model.
// e.g. hsl -> { h: '210', s: '50', l: '50' }
type ColorChannels = Record<string, string>

// `color` (culori Color, float rgb) is the source of truth; `channels` is a
// derived buffer in the current input model. `customName` null = auto-named.
interface KeyColor { id: string; customName: string | null; color: Color; channels: ColorChannels }
interface Settings { inputColorModel: InputColorModel; blendingColorModel: BlendingColorModel }
interface PaletteDocument { keyColors: KeyColor[]; settings: Settings }   // runtime

// Persisted shape: `color` + `customName`; `channels`/auto names re-derived on
// load. Loose to tolerate older files (pre-`color` carry `channels`; pre-
// `customName` carry a plain `name`) — both migrated on load.
interface PersistedKeyColor {
  id: string; customName?: string | null; name?: string; color?: Color; channels?: ColorChannels
}
interface PersistedDocument { keyColors: PersistedKeyColor[]; settings: Settings }
```

**Source of truth for a color** is `KeyColor.color` — a canonical culori color in
float `rgb` mode, left **unclamped** so wide-gamut colors persist as extended
sRGB (ADR-013). The hex shown in the UI and the `channels` are both derived from
it. `channels` are strings (not numbers) on purpose: they keep exactly what the
user typed and tolerate mid-edit states.

**Name** is `customName` (user-pinned) or, when `null`, an auto name derived from
the color — effective name = `resolveName(keyColor)` (see Auto color naming).

Update rules: a **channel edit** keeps the typed strings and recomputes `color`;
a **hex edit** sets `color` then re-derives `channels`; an **input-model switch**
leaves `color` untouched and only re-derives `channels` into the new model — so a
switch is fully reversible (no lossy channel→channel round-trip).

## Color models — `src/color/models.ts`

A `MODELS` registry, one `ColorModelDef` per `InputColorModel`, each with:

- `channels: ChannelDef[]` — id, label, `minimum`, `maximum`, `integer?`.
- `toChannels(color)` — culori color → display strings (clamped to range).
- `fromChannels(channels)` — display strings → culori color.

Canonical-color helpers: `channelsToColor` (channels → float rgb, unclamped),
`colorToChannels` (color → channels for a model), `colorToHex` (display hex),
`hexToColor` (parse). `channelsToHex` remains for the picker's axis gradient.

**Gamut handling (important):** HSL/HSV are sRGB-based and can't represent
wide-gamut colors, and HSL saturation is numerically unstable near
lightness 0/100. So `hsl`/`hsv` `toChannels` first map the color into sRGB with
`toGamut('rgb', 'oklch')` (CSS Color 4 algorithm) — this also snaps near-white /
near-black to exact RGB and kills floating-point dust, so e.g. white never shows
`s = 100`. `lch` keeps wide gamut (no chroma clamp). `fmt()` hard-clamps every
channel to `[min, max]` as a final guard. (See ADR-007.)

## Auto color naming — `src/color/naming.ts` (ADR-015)

So a new color reads as "Lavender" rather than "new color 1", and the palette is
export-ready by default.

- **Source:** `src/color/colorNames.data.ts` — a vendored, normalized
  `{ name, hex }[]` (~1.5k entries from *Name that Color*, CC BY 2.5 — attribution
  in the file header). No npm dependency.
- **Match:** `autoName(color)` — nearest entry by Euclidean distance in sRGB,
  compared against the **displayed** (gamut-mapped) hex so the name agrees with
  the swatch. The list's RGB is precomputed once at module load.
- **Effective name:** `resolveName(keyColor) = customName ?? autoName(color)` —
  derive-on-read; the auto name is never stored, so it follows the color for free
  and a model switch leaves it untouched. `customName: null` = auto.
- **`NameInput`** (`components/NameInput`) edits a draft and commits on blur/Enter:
  empty → `setKeyColorName(id, null)` (back to auto, re-appears immediately);
  non-empty → pins it. Escape cancels. While not focused it shows `value`, so the
  auto name updates live.

## Store — `src/store/index.ts`

`zustand` store wrapped in `zundo`'s `temporal`. State = `PaletteDocument`
+ actions:

- `hydrate(document)` — normalize a `PersistedDocument` into runtime key colors
  (re-derive `channels` from `color`; migrate older files lacking `color`).
- `addKeyColor` (white, at end), `addKeyColors(hexes)` (bulk add in one update =
  one undo step; used by "add matching"), `removeKeyColor`,
  `setKeyColorName(id, name | null)` (pin a custom name, or null = auto),
  `setKeyColorChannel` / `setKeyColorChannels` (update buffer + recompute `color`),
  `setKeyColorFromHex` (set `color` + re-derive channels).
- `setInputColorModel` (re-derives channels from `color`, `color` untouched),
  `setBlendingColorModel`.

zundo options: `partialize` to `{ keyColors, settings }` (don't track action
functions), `equality` via `JSON.stringify` (skip identical history entries),
`limit: 100`. **Undo/redo covers the whole document, incl. both model switches.**

`useTemporalStore(selector)` = `useStore(usePaletteStore.temporal, selector)`,
typed over `TemporalState<PaletteDocument>`.

**Live-edit batching — `src/store/history.ts`:** `beginLiveEdit`/`endLiveEdit`
pause zundo during a drag or field edit and commit a single pre-edit snapshot on
release/blur, so each interaction is one undo step (ADR-012).

**Undo/redo hotkeys:** a `window` `keydown` listener in `App` maps
**Ctrl/Cmd+Z** → `temporal.undo()` and **Ctrl/Cmd+Shift+Z** → `temporal.redo()`
(same temporal store as the Header buttons). It no-ops while a text field is
focused (`input`/`textarea`/`select`/contenteditable) so the field's native undo
keeps working.

## Persistence — `src/utils/storage.ts` + `main.ts` + `App.tsx`

Per-file, **load-on-open + save-on-change** (no live concurrent multi-user sync).

- Storage key `document`, namespace `mycolors` (alphanumeric/`_` only — ADR-009).
- **Load:** `main.ts` reads `figma.root.getSharedPluginData` synchronously at
  startup and passes it via `showUI(opts, { initialDocument })`.
- **Hydrate:** `App` (in a one-shot `useEffect`) hydrates the store, then calls
  `usePaletteStore.temporal.getState().clear()` so the loaded state is the undo
  baseline. This happens **before** the save subscription is attached, so the
  hydration is neither saved back (no echo) nor added to history.
- **Save:** `App` subscribes to the store, debounced 400 ms, and
  `emit('SAVE_DOCUMENT', …)` with key colors stripped to `{ id, customName, color }`
  (channels and auto names are re-derived on load). `main.ts` writes it with
  `figma.root.setSharedPluginData`.

`storage.ts` also has `clientStorage` (per-user) wrappers, currently unused —
kept for a possible future per-user feature.

## Canvas selection — fills, eyedropper, "add matching" (ADR-016)

Lets the user pull colors off the canvas into the palette.

- **Collect (main):** on `selectionchange` / `currentpagechange` (and on a
  `REQUEST_SELECTION_FILLS` ping the UI sends on mount, to avoid racing its
  listener), `main.ts` reads the **top-level** selection (`figma.currentPage.selection`,
  not nested layers), takes each node's visible `SOLID` fills, converts to hex,
  **dedupes** (order-preserving), and `emit('SELECTION_FILLS', { fills })`.
- **Hold (UI):** a separate **ephemeral** store `src/store/selection.ts`
  (`{ fills }`, plain zustand) — deliberately outside the palette store so it
  never enters undo history or persistence.
- **Use:** a per-card **eyedropper** (in the card's action row, shown only when
  `fills` is non-empty) sets that color to `fills[0]` via `setKeyColorFromHex`;
  an **add-matching** button by "+" (disabled when no fills) appends every fill
  via `addKeyColors`.
- Notes: assumes an sRGB document; paint opacity is ignored; fills don't refresh
  if a selected layer's fill changes without a selection change.

> Reading Figma's native eyedropper/color-picker from a plugin is **not possible**
> (no such API); the browser `EyeDropper` API was rejected for runtime/iframe
> uncertainty, so this selection-based flow replaced it.

## Component tree

```
App (app/App.tsx)
├── Header                 undo/redo (left) · settings gear (right)
│   └── Popover            custom anchored popover (outside-click + Esc)
│       └── SettingsPopover  two SegmentedControls (input / blending model)
└── KeyColorsSection       header: "+" add · add-matching (from selection) · card list
    │                       (auto-scrolls to reveal new card(s) on add)
    └── KeyColorCard        swatch (top) · action row (hover) · NameInput (footer)
        ├── ColorSample     fills the card top → opens the color picker popover
        ├── action row      eyedropper (when selection has a fill) · trash
        ├── NameInput       ghost field; auto name unless a custom one is pinned
        └── Popover         (right-top, anchored to the swatch)
            └── ColorPicker  HueWheel · Gradient · GhostInput hex · ChannelInputs
                ├── HueWheel   model-aware conic hue + radial saturation, hairline ring; Handles (active + dots)
                ├── Gradient   universal 1D slider (lightness/value axis); Handle
                ├── Handle     white dot, optional color sample (draggable)
                ├── GhostInput hex field — '#' as the icon-slot label, value without '#'
                └── ChannelInput  TextboxNumeric w/ label in the DS `icon` slot
```

- Picker geometry + channel↔axis mapping: `src/color/picker.ts`. Drag binding:
  `src/hooks/usePointerDrag.ts` (pointer capture). Each `ColorModelDef` carries a
  `picker: { angle, radius, axis }` so the picker is model-agnostic. See ADR-011.
- **Wheel hue axis:** `ANGLE_OFFSET_DEG = 90` places hue 0 strictly to the right
  (east), hue increasing clockwise; the same constant drives both the handle math
  and the conic `from` angle, so they always agree.
- **Model-aware hue ring (ADR-014):** the wheel's conic is built per model by
  `buildHueWheelConic`, sampling each `ColorModelDef.hueRingColor(hue)` (the
  model's own hue scale — LCH hue ≠ HSL hue). All display hex goes through
  gamut mapping (`colorToHex`/`channelsToHex` → `toGamut('rgb','oklch')`), so
  out-of-sRGB colors reduce chroma toward gray instead of clamping to over-bright.
- **Card vs picker:** the card shows only the swatch + a borderless ("ghost")
  name field (`NameInput`); the action row (white bordered tiles: eyedropper when
  the selection has a fill, trash) is revealed on card hover. All channel editing
  lives in the picker, not the card. The picker has **no close button** — it
  closes via outside-click or a re-click on the swatch (toggled in `KeyColorCard`).
  `GhostInput` is the hex field, styled like a DS Textbox (filled, `#` in the icon
  slot); it edits bare digits and re-adds `#` for parsing.
- DS components used: `IconButton`, `SegmentedControl`, `TextboxNumeric` (its
  string `value` + `onValueInput` map directly to raw channels; its `icon` slot
  holds the channel label). Name and hex fields are plain `<input>`s (ghost /
  DS-look) rather than DS `Textbox`. Icons carry a numeric suffix:
  `IconSettings24`, `IconPlusSmall24`, `IconTrash24`, `IconEyedropperSmall24`,
  `IconSelectMatchingSmall24`, `IconNavigateBack24` / `…Forward24`.
- There is **no** native Popover in the DS, so `components/Popover` is a small
  custom one (plain `useEffect`: outside-click via `containerRef.contains` +
  Escape). With an `anchorRef` it positions `fixed` from the trigger rect
  (`placement="right-top"`); without one it keeps the CSS-anchored default.
- Transient UI state (popover open, etc.) lives in component `useState`, never in
  the store — so it stays out of undo history and persistence.

## Build & config specifics

- **Preact/React aliasing:** `tsconfig` `paths` map `react` / `react-dom` →
  `preact/compat`, `react/jsx-runtime` → `preact/jsx-runtime`. The build tool's
  esbuild also aliases react→preact/compat at bundle time (built-in). No
  `@types/react`. `skipLibCheck: true`.
- **JSX:** automatic runtime. `tsconfig` uses `jsx: react-jsx` +
  `jsxImportSource: preact`; `build-figma-plugin.ui.js` switches esbuild to the
  automatic runtime too (so `.tsx` files don't import `h`).
- **CSS Modules:** `import styles from './X.css'` → scoped class map; the toolkit
  auto-generates `*.css.d.ts` (gitignored) before typecheck. `:global(...)` works.
  Global CSS via a `!`-prefixed import.
- **SVG:** imported as a `dataurl` string (esbuild loader); declared in
  `types/assets.d.ts`.
- **Window:** fixed 720×640 via `showUI`.
- `manifest.json` is generated from the `figma-plugin` field in `package.json`
  (note: `ui` is a top-level key there, not nested under `main`).
