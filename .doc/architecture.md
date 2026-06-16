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
   └──────── on('SAVE_DOCUMENT') ◀── emit('SAVE_DOCUMENT', doc) (debounced)
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
// derived buffer in the current input model.
interface KeyColor { id: string; name: string; color: Color; channels: ColorChannels }
interface Settings { inputColorModel: InputColorModel; blendingColorModel: BlendingColorModel }
interface PaletteDocument { keyColors: KeyColor[]; settings: Settings }   // runtime

// Persisted shape: only `color` stored, `channels` re-derived on load. Loose to
// tolerate older files that predate `color` (carry `channels`) — migrated on load.
interface PersistedKeyColor { id: string; name: string; color?: Color; channels?: ColorChannels }
interface PersistedDocument { keyColors: PersistedKeyColor[]; settings: Settings }
```

**Source of truth for a color** is `KeyColor.color` — a canonical culori color in
float `rgb` mode, left **unclamped** so wide-gamut colors persist as extended
sRGB (ADR-013). The hex shown in the UI and the `channels` are both derived from
it. `channels` are strings (not numbers) on purpose: they keep exactly what the
user typed and tolerate mid-edit states.

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

## Store — `src/store/index.ts`

`zustand` store wrapped in `zundo`'s `temporal`. State = `PaletteDocument`
+ actions:

- `hydrate(document)` — normalize a `PersistedDocument` into runtime key colors
  (re-derive `channels` from `color`; migrate older files lacking `color`).
- `addKeyColor` (white "white" at end), `removeKeyColor`, `renameKeyColor`,
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
  `emit('SAVE_DOCUMENT', …)` with key colors stripped to `{ id, name, color }`
  (channels are re-derived on load). `main.ts` writes it with
  `figma.root.setSharedPluginData`.

`storage.ts` also has `clientStorage` (per-user) wrappers, currently unused —
kept for a possible future per-user feature.

## Component tree

```
App (app/App.tsx)
├── Header                 undo/redo (left) · settings gear (right)
│   └── Popover            custom anchored popover (outside-click + Esc)
│       └── SettingsPopover  two SegmentedControls (input / blending model)
└── KeyColorsSection       "Key colors" header + "+" · horizontal card list
    └── KeyColorCard        ColorSample · delete · name · ChannelInputs
        ├── ColorSample     square swatch → opens the color picker popover
        └── Popover         (right-top, anchored to the swatch)
            └── ColorPicker  GhostInput hex · HueWheel · Gradient · ChannelInputs
                ├── HueWheel   conic hue + radial saturation; Handles (active + dots)
                ├── Gradient   universal 1D slider (lightness/value axis); Handle
                ├── Handle     white dot, optional color sample (draggable)
                └── ChannelInput  TextboxNumeric w/ label in the DS `icon` slot
```

- Picker geometry + channel↔axis mapping: `src/color/picker.ts`. Drag binding:
  `src/hooks/usePointerDrag.ts` (pointer capture). Each `ColorModelDef` carries a
  `picker: { angle, radius, axis }` so the picker is model-agnostic. See ADR-011.
- DS components used: `IconButton`, `SegmentedControl`, `Textbox`,
  `TextboxNumeric` (its string `value` + `onValueInput` map directly to raw
  channels; its `icon` slot holds the channel label). Icons carry a numeric
  suffix: `IconSettings24`, `IconPlusSmall24`, `IconTrash24`, `IconClose24`,
  `IconNavigateBack24` / `…Forward24`.
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
