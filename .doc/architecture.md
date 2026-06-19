# Architecture

## Stack

- **Toolkit:** `create-figma-plugin` v4 (`@create-figma-plugin/build`, `…/ui`,
  `…/utilities`, `…/tsconfig`). esbuild under the hood.
- **UI:** Preact 10 (React aliased to `preact/compat` for libraries that expect React).
- **Language:** TypeScript 5.
- **Color:** `culori` v4 (+ `@types/culori`).
- **State:** `zustand` v5 + `zundo` v2 (undo/redo).
- **DnD:** `@dnd-kit/core` / `…/sortable` / `…/utilities` — key-color card
  reordering (ADR-019). React-typed; fits via the preact aliasing (ADR-002).
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
main.ts  ──showUI(opts,{initialDocument, documentId, documentName})──▶  App (props)
   ▲                                            │
   ├──── on('SAVE_DOCUMENT') ◀── emit('SAVE_DOCUMENT', doc)        (debounced, active=document)
   ├──── on('REQUEST_USER_LIBRARY') ◀── emit(...)                 (once, on UI mount)
   ├──── emit('USER_LIBRARY', { library }) ──▶ on(...)            (reply: clientStorage)
   ├──── on('SAVE_USER_PALETTE') ◀── emit(..., { palette })       (debounced, active=user)
   ├──── on('DELETE_USER_PALETTE') ◀── emit(..., { id })          (delete-confirm)
   ├──── on('SAVE_USER_PREFS') ◀── emit(..., { prefs })           (input-model change)
   ├──── on('SET_ACTIVE_PALETTE') ◀── emit(..., { documentId, ref }) (palette switch)
   ├──── on('REQUEST_SELECTION_FILLS') ◀── emit(...)               (once, on UI mount)
   ├──── emit('SELECTION_FILLS', { fills }) ──▶ on(...)            (selection / page change)
   ├──── on('EXPORT_SWATCHES') ◀── emit('EXPORT_SWATCHES', palette)    (Footer button)
   ├──── on('CREATE_VARIABLES') ◀── emit('CREATE_VARIABLES', palette)  (Footer button)
   └──── on('CREATE_STYLES') ◀── emit('CREATE_STYLES', palette)        (Footer button)
```

**Two palettes (ADR-026/027):** the editor edits exactly one *active* palette —
either the single **document palette** (`sharedPluginData`, shared, the only source
for variables/styles) or one **user palette** (a private library in
`clientStorage`, available across files). Identity (`id`/`name`/`updatedAt`) wraps
the body. The document palette's id is `figma.root.id` and its name is the file
name (read-only) — passed as synchronous props, so the shared schema is unchanged.
The library is async (fetched after mount, `loading` flag). `inputColorModel` is a
**user-global pref**, not palette data and not undoable (ADR-027).

## Data model

`src/types/index.ts`:

```ts
type InputColorModel = 'hsl' | 'hsv' | 'lch'
type BlendingColorModel = 'rgb' | 'hsl' | 'oklch' | 'lch'  // also = auto-position lightness metric
type ToneAxisDirection = 'light-dark' | 'dark-light'   // which scale end is light

type ColorChannels = Record<string, string>            // raw input strings by channel id

// A gradient key point: canonical unclamped rgb color at a 0..1 axis position.
// `autoPosition` (default true) = position follows the color's lightness;
// `channels` is a runtime-only edit buffer for THIS stop. (ADR-020/022)
interface GradientStop {
  id: string; position: number; color: Color
  autoPosition: boolean; channels: ColorChannels
}

// A named color "ramp": a shade gradient whose `keyStopId` stop is the seed the
// user picks/names ("the key color"). `autoName` mirrors a stop's `autoPosition`:
// true = name derived from the color, false = use `customName`. (ADR-020, ADR-015)
interface PaletteColor {
  id: string; customName: string; autoName: boolean
  stops: GradientStop[]; keyStopId: string
}
// Palette-scoped only (ADR-027): these change generated colors/export, so they
// travel with the palette + stay under undo. `inputColorModel` moved OUT — it is
// now a user-global pref (see below).
interface Settings {
  blendingColorModel: BlendingColorModel
  toneAxisDirection: ToneAxisDirection
  collectionName: string   // target Figma variable collection (default "Palette")
}
// Shade scale: per-step target on the 0..1000 axis, null = auto. (ADR-021)
interface ShadeScale { steps: Array<number | null> }
interface PaletteDocument { keyColors: PaletteColor[]; settings: Settings; shades: ShadeScale }

// Palette identity + library (ADR-026). A `Palette` = identity + a persisted body
// (the body mirrors `PersistedDocument`, fed to the store's `hydrate`).
type PaletteKind = 'document' | 'user'
interface Palette { id: string; name: string; updatedAt: number
  keyColors: PersistedPaletteColor[]; settings: Settings; shades?: ShadeScale }
interface ActivePaletteRef { kind: PaletteKind; id: string }   // doc id = figma.root.id
interface UserPrefs { inputColorModel: InputColorModel }       // user-global (ADR-027)
// One clientStorage entry; `activeByDocument` keyed by figma.root.id.
interface UserLibrary { version: number; palettes: Palette[]; prefs: UserPrefs
  activeByDocument: Record<string, ActivePaletteRef> }

// Persisted shape: gradient `stops` (incl. `autoPosition`) + `keyStopId` +
// `customName`/`autoName` + `shades`; per-stop `channels`/auto names re-derived on
// load. Loose to tolerate older files (pre-gradient carry a single `color`/
// `channels`; pre-`customName` carry `name`; pre-`autoName` → auto iff no name set;
// pre-editor omit `autoPosition` → defaults true).
interface PersistedPaletteColor {
  id: string; customName?: string | null; autoName?: boolean; name?: string
  keyStopId?: string
  stops?: { id: string; position: number; color: Color; autoPosition?: boolean }[]
  color?: Color; channels?: ColorChannels   // legacy single-color form
}
interface PersistedDocument {
  keyColors: PersistedPaletteColor[]; settings: Settings; shades?: ShadeScale
}
```

**Source of truth for a color** is each `GradientStop.color` — a canonical culori
color in float `rgb` mode, left **unclamped** so wide-gamut colors persist as
extended sRGB (ADR-013). The "key color" of a `PaletteColor` is its key stop's
color (`keyColorOf(pc)`). **Each stop** carries its own `channels` edit buffer
(ADR-022), so the picker can edit any stop, not just the key one; the hex in the
UI and `channels` derive from the stop's color. `channels` are strings (not
numbers) on purpose: they keep exactly what the user typed and tolerate mid-edit
states.

**Name** is `customName` (user-pinned) or, when `autoName`, an auto name derived
from the key stop's color — effective name = `resolveName(pc)` (see Auto color
naming). The card surfaces this with the same auto/manual "A" toggle as a stop's
position (read-only + muted when auto).

**Shade gradient (ADR-020/021/022):** a `PaletteColor` *is* its gradient — the key
color is one stop. By default the gradient runs from a **near-black**
(`DARK_ENDPOINT_L` ≈ OKLab L 0.15, not pure black — cuts the indistinguishable
dark zone) to white, with the key color placed between them at its lightness; the
two endpoints are **pinned** at the scale ends (manual), only the key stop is
auto. `toneAxisDirection` sets which endpoint is at position 0. Auto positions are
normalized to the gradient's real lightness span `[DARK_ENDPOINT_L, 1]`, so a
color as dark as the dark endpoint lands at the end rather than leaving a gap. A stop's `position` is auto-derived from its
color's lightness **in the active blending model** (`modelLightness`: rgb/hsl →
HSL L, oklch → OKLab L, lch → CIE L\*) while `autoPosition` is true (the default),
and frozen once the user drags it / toggles "A" off in the gradient editor
(ADR-022). Switching the blending model re-positions every auto stop.

Update rules: a **channel/hex edit** targets a specific stop (`setStop*`) — a
channel edit keeps the typed strings and recomputes that stop's `color`, a hex
edit sets `color` then re-derives its `channels`; both reposition the stop only
when it's auto. An **input-model switch** leaves every `color` untouched and only
re-derives all stops' `channels` into the new model — so a switch is fully
reversible (no lossy channel→channel round-trip).

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
- **Effective name:** `resolveName(keyColor)` = the auto name when `autoName` (or
  the custom name is blank), else `customName` — derive-on-read; the auto name is
  never stored, so it follows the color for free and a model switch leaves it
  untouched.
- **`NameInput`** (`components/NameInput`) is always editable; it commits on
  blur/Enter ONLY if the text changed — so blurring an auto name untouched leaves
  it auto, while editing it pins a custom name (empty → reverts to auto; non-empty
  → manual). Escape cancels. Name fields do NOT select-on-focus (unlike the numeric
  position field). The `AutoToggle` ("A") beside it calls `setKeyColorNameAuto`
  (on→off seeds `customName` from the current auto name). While not focused it shows
  `value`, so the auto name updates live. The position field works the same way
  (edit-to-pin on change); auto values aren't muted — the "A" toggle is the cue.

## Shade gradient + scale — `src/color/gradient.ts` + `src/color/shades.ts`

`gradient.ts` owns the per-`PaletteColor` gradient (ADR-020/022): `keyStopOf` /
`keyColorOf` accessors, `modelLightness(color, blending)` + `keyStopPosition`
(auto-stop placement by the blending model's lightness), `makeStop` /
`buildDefaultStops` (pinned near-black + white ends + auto key at its lightness), the stop-edit
helpers `setStopColor` (recolor + reposition if auto), `addStop` (sample a color
at a position, returns the new id), `removeStop`, `setStopPosition` (pin =
manual), `setStopAutoPosition`, `repositionAutoStops` (on a blending-model
change), `canDeleteStop` (endpoints + key stop are protected), `rederiveChannels`
(on an input-model switch), `mirrorStops` (on a tone-direction flip),
`buildGradientCss` (sampled CSS gradient for the editor track), and
`buildGradientSampler(stops, blending)` — a `u→Color` sampler via culori
`interpolate` over the stops' `[color, position]` tuples in the blending mode
(build once per row, sample per step); it drops the hue of near-gray stops
(`isAchromatic`) so a phantom micro-chroma hue can't tint the ramp. `shades.ts` owns the 0..1000 scale
(ADR-021): `resolveSteps` (fill `null`
autos by even index-distribution between set anchors / the 0&1000 edges),
`clampStepValue` (keep a typed value between its set neighbors), and the
count/`SHADE_MAX` constants.

## Shades section UI — `src/components/Shades`

`ShadesSection` renders the header (title + `CountStepper`) and, inside one
horizontal `scroller`, the step row plus **one grid per key color** that all
**share the same inline `grid-template-columns`** (`repeat(count, minmax(28px,
1fr))`) so they stay column-aligned and scroll together. Swatch colors are
memoized per row: one `buildGradientSampler` per `PaletteColor`, sampled at every
resolved step (`value / 1000`). Swatches are display-only, fixed 40px tall, with
the hairline border drawn **inside** via `::before` (`inset: 0`, `border-radius:
inherit`, `color-mix(... var(--figma-color-text) 15% ...)`) so it never shifts the
grid. `CountStepper` is −/+ `IconButton`s around a directly-editable field
(clamped `[2, 26]`).

- **Gradient editor (ADR-022):** each swatch row is a clickable `role="button"`
  (hover `--figma-color-bg-hover`, active `--figma-color-bg-secondary`); clicking
  toggles `editingId` and injects a full-width `GradientEditor` as the next
  scroller child. `GradientEditor` paints the track via `buildGradientCss`, lays a
  draggable `Handle` per stop, and shares one `usePointerDrag` for the whole track:
  the first move decides whether it grabbed a stop (within `GRAB_PX`), hit a fixed
  endpoint (no-op), or landed on empty track (`addStop` then drag the new id —
  unless the gradient is at the `MAX_STOPS` = 7 cap, where `canAddStop` makes it a
  no-op); `begin/endLiveEdit` make the gesture one undo step. Below the track, one
  `StopCard` per stop (`flex: 1`, full-width) — swatch opens the shared
  `ColorPicker` for `(paletteColorId, stopId)`, a hover delete tile (hidden for
  endpoints/key via `canDeleteStop`), a position field, and an **"A"** button
  toggling `autoPosition` (brand-filled when auto). The position is a static `%`
  label while auto, and an editable numeric `%` `TextboxNumeric` when manual.

- **`StopInput` is a controlled-input gotcha (learned the hard way):** the DS
  `RawTextboxNumeric` renders `value` verbatim and reports edits as an already-
  evaluated *number* (`onNumericValueInput`). Feeding a re-stringified number back
  as `value` made the controlled value disagree with the typed text mid-keystroke,
  so Preact reset the field — typing did nothing while the ±arrows (which write the
  DOM imperatively) appeared to work. Fix: keep a **local string draft** as the
  controlled `value` while focused (`onValueInput={setDraft}`, mirroring
  `ChannelInput`), and commit the parsed number to the store on blur (empty =
  `null` = auto). See [backlog](backlog.md) — the broader input/Ctrl+Z model is up
  for review.

## Harmonious color generation — `src/color/harmony.ts` (ADR-018)

`harmoniousColor(existing)` returns a color that fits an arbitrary existing set:
best-candidate / farthest-point sampling — draw random candidates and keep the
one whose nearest existing color is most distant in OKLab. Candidates are bounded
in lightness to a generous mid-range (so colors keep tonal headroom) and in
chroma to a moderate cap (avoids neon); hue is free. Out-of-gamut samples are
reduced via `toGamut`. Tuning constants (lightness range, chroma cap, candidate
count) live in the module. Random by design (empty set → random). Used by
`addKeyColor` and the per-card reroll (`rerollKeyColor`, which excludes the
rerolled color and reverts it to auto-name).

## Store — `src/store/index.ts`

`zustand` store wrapped in `zundo`'s `temporal`. State = `PaletteDocument`
+ actions:

- `hydrate(document)` — normalize a `PersistedDocument` into runtime palette
  colors (re-derive `channels` from the key stop; migrate pre-gradient files to a
  default gradient; default missing settings/shades).
- `addKeyColor` (harmonious, at end — see ADR-018), `addKeyColors(hexes)` (bulk
  add in one update = one undo step; used by "add matching"),
  `rerollKeyColor(id)` (rebuild a fresh harmonious default gradient; the name is
  kept — auto names re-derive, manual names are the user's),
  `importPaletteColors(colors)` (append whole PaletteColors from another palette,
  deep-cloned with fresh ids; one undo step; ADR-028 — `toRuntimeColors(body)`
  converts a persisted body for preview/import without mutating the store),
  `removeKeyColor`, `moveKeyColor(fromId, toId)` (reorder via `arrayMove`, used
  by drag-and-drop — one update = one undo step),
  `setKeyColorName(id, name)` (pin a custom name; empty reverts to auto),
  `setKeyColorNameAuto(id, auto)` (toggle auto-naming; seeds the custom name when
  going manual),
  `setKeyColorChannel` / `setKeyColorChannels` / `setKeyColorFromHex` (all set the
  key stop's color + reposition it by lightness; channels/hex re-derived).
- `rederiveAllChannels(model)` (re-derives every stop's channel buffer into the
  new input model — see ADR-027; invoked by the library store wrapped in temporal
  pause/resume so it is NOT undoable), `setBlendingColorModel`,
  `setToneAxisDirection` (mirrors every gradient's stops),
  `setCollectionName(name)` (empty reverts to the `"Palette"` default).
- `setShadeCount(n)` (resize `shades.steps`, clamp `[2,26]`, grow/trim at the end),
  `setShadeStep(i, value | null)` (pin, clamped between set neighbors; null = auto).

zundo options: `partialize` to `{ keyColors, settings, shades }` (don't track action
functions), `equality` via `JSON.stringify` (skip identical history entries),
`limit: 100`. **Undo/redo covers the whole active palette body** (incl. the
blending-model switch); the **input**-model switch is NOT undoable (ADR-027), and
switching palettes clears history (ADR-026).

`useTemporalStore(selector)` = `useStore(usePaletteStore.temporal, selector)`,
typed over `TemporalState<PaletteDocument>`.

**Palette library — `src/store/library.ts` (ADR-026):** a plain zustand store (no
temporal) holding `palettes`, the document identity + a cached `documentBody`,
`activeRef`, `prefs`, and a `loading` flag. Actions `selectPalette`/`createPalette`
(empty body)/`duplicatePalette` (deep-copy + " copy")/`renamePalette`/
`deletePalette`/`setInputColorModel` are **outside undo**. `selectPalette` flushes
the pending save, hydrates the target body, `temporal.clear()`s, re-baselines the
save dedupe, then persists the per-file active pointer. This module also owns the
**save controller**: `currentPersistedBody` (the shared serialization for both
tiers), a debounced `scheduleSave` (App subscribes), `flushSave` (force a write
before a switch), `cancelPendingSave` (drop a deleted palette's pending write), and
`resetSaveBaseline`. `commitSave` routes by `activeRef.kind` and **dedupes on the
serialized body**, so a channels-only re-derivation (model switch) never writes.

**Input-model holder — `src/store/prefs.ts` (ADR-027):** a tiny zustand store
(`usePrefsStore { inputColorModel }`) the palette store reads when deriving channel
buffers — split from the library store only to avoid an import cycle. The library
store owns the change action + persistence; `applyInputColorModel` sets the holder
and calls `rederiveAllChannels` under temporal pause.

**Live-edit batching — `src/store/history.ts`:** `beginLiveEdit`/`endLiveEdit`
pause zundo during a drag or field edit and commit a single pre-edit snapshot on
release/blur, so each interaction is one undo step (ADR-012).

**Undo/redo hotkeys:** a `window` `keydown` listener in `App` maps
**Ctrl/Cmd+Z** → `temporal.undo()` and **Ctrl/Cmd+Shift+Z** → `temporal.redo()`
(same temporal store as the Header buttons). It always `preventDefault`s the
browser's native textbox undo (which would desync a focused field from the
store); if a field is focused it `blur()`s it first so the pending edit commits
as a normal history entry, then undo runs on a clean state.

## Persistence — `src/utils/storage.ts` + `main.ts` + `App.tsx`

Per-file, **load-on-open + save-on-change** (no live concurrent multi-user sync).

- Storage key `document`, namespace `mycolors` (alphanumeric/`_` only — ADR-009).
- **Load:** `main.ts` reads `figma.root.getSharedPluginData` synchronously at
  startup and passes it via `showUI(opts, { initialDocument })`.
- **Hydrate:** `App` (in a one-shot `useEffect`) seeds the library store identity,
  hydrates the palette store, then calls `usePaletteStore.temporal.getState()
  .clear()` so the loaded state is the undo baseline, and `resetSaveBaseline()`
  before subscribing — so the hydration is neither saved back (no echo) nor added
  to history.
- **Save:** `App` subscribes to the store, calling the library save controller's
  debounced `scheduleSave` (400 ms). `commitSave` serializes the body (key colors
  stripped to `{ id, customName, autoName, keyStopId, stops }`; channels + auto
  names re-derived on load) and routes by `activeRef.kind`: `SAVE_DOCUMENT` →
  `figma.root.setSharedPluginData`, or `SAVE_USER_PALETTE` → the library upsert.

**User palette library (ADR-026), `storage.ts` `clientStorage`:** one `library`
entry holds `UserLibrary { version, palettes, prefs, activeByDocument }`. It's
**async**, so `App` requests it on mount (`REQUEST_USER_LIBRARY` → `USER_LIBRARY`)
and applies it via the library store (`receiveLibrary`: apply prefs + re-derive
channels, resolve the active pointer, select it if it's a valid user palette).
Reads tolerate a missing/older entry (`emptyUserLibrary`, `version`-gated); writes
go through a serialized **mutex** (`mutateUserLibrary`) so overlapping
upsert/prefs/active writes can't clobber, with a soft `LIBRARY_MAX_BYTES` quota
guard (friendly `figma.notify` on overflow). `getUserData`/`setUserData` generic
wrappers remain for ad-hoc per-user keys.

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
  `fills` is non-empty) sets the key stop's color to `fills[0]` via `setStopFromHex`;
  an **add-matching** button by "+" (disabled when no fills) appends every fill
  via `addKeyColors`.
- Notes: assumes an sRGB document; paint opacity is ignored; fills don't refresh
  if a selected layer's fill changes without a selection change.

> Reading Figma's native eyedropper/color-picker from a plugin is **not possible**
> (no such API); the browser `EyeDropper` API was rejected for runtime/iframe
> uncertainty, so this selection-based flow replaced it.

## Export — swatches / variables / styles (ADR-024)

Three exports in the `Footer` bar. The split mirrors the thread model: the UI
does all the color math, the main thread does all the `figma.*`.

- **Resolve (UI):** `color/export.ts` `buildExportPalette(keyColors, shades,
  blending, collectionName)` produces a flat `ExportPalette`
  (`{ collectionName, colors: [{ name, shades: [{ step, hex }] }] }`), reusing the
  *same* `resolveSteps` + per-color `buildGradientSampler` + `colorToHex` +
  `resolveName` as the swatch grid — so an export equals what's on screen.
- **Dispatch (UI):** `Footer` builds the payload on click and `emit`s one of
  `EXPORT_SWATCHES` / `CREATE_VARIABLES` / `CREATE_STYLES`.
- **Materialize (main):** `main.ts` converts each `hex` → `RGB` (`hexToRgb`) and:
  - *swatches* — a frame (named after the collection) in **native GRID auto-layout**
    (40px cells, 8px gap, row = key color, col = shade), each rectangle `FILL`×`FILL`
    so it tracks its cell, named `{name}/{step}` (unified with variables/styles);
    placed at the viewport center, selected + zoomed.
  - *variables* — color variables named `{name}/{step}` in the settings collection
    (`getLocalVariableCollectionsAsync`, created if missing); **updated in place by
    name** (else created) so re-export is idempotent.
  - *styles* — paint styles named `{name}/{step}` (no collection), same
    update-in-place. Async APIs (`get*Async`) throughout, so it's correct under a
    future `documentAccess: dynamic-page`.
- **Button feedback:** after a press the button briefly swaps its label to a
  "✔ Done" confirmation + a success-fill `.flash` class (`FEEDBACK_MS`), then
  reverts — local `Footer` state (one active flash + a timeout ref), no store.
  Export is repeatable, so the buttons aren't disabled by it; they disable only
  with no key colors. Optimistic — no main→UI ack.

## Image color extraction (ADR-025)

Seed a palette from an image — **entirely UI-thread** (decode → cluster → select →
add). `figma.*` isn't needed, so there are **no bridge messages** and `main.ts` is
untouched; the only non-UI change is `networkAccess.allowedDomains: ["*"]` (so the
iframe may `fetch` an image URL).

- **Open:** an image `IconButton` in the **Key colors** header sets the extractor
  store to `intake`.
- **Cluster (`src/color/extract.ts`, pure):** `extractColors(pixels, count)` —
  k-means++ in **OKLab** (`distanceSq`, `seedCenters`), Lloyd to `MAX_ITERATIONS`
  in `runKmeans`, repeated `RESTARTS` times keeping the lowest-`inertia` run; result
  ordered by cluster weight (dominance). Seeding uses `Math.random` (restarts, not a
  fixed seed, are the stability lever — ADR-025), so results are steady but not
  bit-for-bit reproducible. `count` is clamped to the available pixels.
  `MIN/MAX/DEFAULT_COLOR_COUNT` (stepper bounds + default) and `RESTARTS` live here.
- **Decode (`src/utils/image.ts`):** `imageFromFile` / `imageFromUrl` → a `<canvas>`
  downsampled to `DOWNSAMPLE_MAX` (longest side) → `{ imageData, previewUrl }`.
  Bytes (drag/upload/paste) never hit CORS; a URL is best-effort `fetch` (variant A,
  no proxy) and throws a clear message if the host blocks it. `previewUrl` is an
  object URL of the original bytes for the on-screen preview (revoked on close).
- **State (`src/store/extractor.ts`):** an **ephemeral** zustand stage machine
  (`closed → intake → loading → workspace`, + the decoded `source` + an `error`),
  out of undo/persistence like `store/selection.ts`.
- **UI (`src/components/ColorExtractor/`):**
  - `IntakeModal` — DS `Modal` (rounded via inline `style`) with a
    `FileUploadDropzone` (drag + click-to-upload; `acceptedFileTypes` omitted — it
    doubles as an exact-MIME filter that would drop every file) and a `window`
    `paste` listener (image bytes or a text URL) while mounted.
  - `ExtractWorkspace` — **replaces** the normal UI render while `stage ===
    'workspace'` (image left; count stepper + 2-column `Swatch` grid + submit/cancel
    right). Re-clusters via `useMemo([source, count])`; selection (`Set` of hexes,
    all-on by default) is reset **during render** by comparing the memoized `colors`
    ref — not in an effect — to avoid a one-frame all-dimmed flash. Submit →
    `addKeyColors(selected)`.
  - `Swatch` — a square color button (styling mirrors ShadesSection's `.swatch`:
    `aspect-ratio: 1`, inset `::before` border); click toggles inclusion, deselected
    dims to 0.4 opacity. The grid's column count lives on `.grid`
    (`grid-template-columns`) in `ExtractWorkspace.css`.

## Component tree

```
App (app/App.tsx)
├── Header                 PaletteSwitcher (left) · undo/redo + settings gear (right)
│   ├── PaletteSwitcher    chevron + active palette name; Popover (Current file / Saved palettes); delete-confirm Modal (ADR-026)
│   │                       document name read-only; user palettes renameable inline; create/duplicate/delete
│   └── Popover            custom anchored popover (outside-click + Esc)
│       └── SettingsPopover  input model (global, ADR-027) · blending model · tone axis · collection-name Textbox
├── KeyColorsSection       header: import-from-palette · extract-from-image · add-matching (from selection) · "+" add · card list
│   └── PaletteImport      dark inverted dropdown of other palettes → Modal w/ all-on Swatch grid; imports whole PaletteColors (ADR-028)
    │                       (auto-scrolls to reveal new card(s) on add)
    │                       wraps the list in DndContext + SortableContext
    │                       (horizontal) for drag-reorder; DragOverlay → KeyColorCardPreview
    └── KeyColorCard        swatch (top) · action row (hover) · NameInput (footer)
        │                   sortable: whole card is the drag source (ADR-019)
        ├── ColorSample     fills the card top → opens the color picker popover
        ├── action row      reroll · eyedropper (when selection has a fill) · trash
        ├── NameInput       ghost field; auto name unless a custom one is pinned
        └── Popover         (right-top, anchored to the swatch)
            └── ColorPicker  edits one stop (paletteColorId, stopId); `surface` picks the 2D control (ADR-023)
                ├── HueWheel   surface=wheel (key colors): conic hue + radial saturation; Gradient slider = lightness/value; dots = other key colors
                ├── SquareField surface=square (stops): canvas-sampled S/L·S/V·C/L field; Gradient slider = hue; dots = other stops of this color
                ├── Gradient   universal 1D slider (axis OR hue, per surface); Handle
                ├── Handle     white dot, optional color sample (draggable)
                ├── GhostInput hex field — '#' as the icon-slot label, value without '#'
                └── ChannelInput  TextboxNumeric w/ label in the DS `icon` slot
└── ShadesSection          header: "Shades" + CountStepper (− [n] +); step row + one row per key color
    │                       all share one grid-template (aligned columns), scroll together
    ├── CountStepper        −/+ IconButtons around a directly-editable count field [2,26]
    ├── StopInput           DS TextboxNumeric (no icon); local string draft, commits parsed value on blur (empty = auto)
    ├── (swatch row)        clickable; display-only cells = sampleGradient(pc.stops, step/1000, blending)
    └── GradientEditor      injected under the active row (ADR-022): track w/ Handles + StopCards
        ├── Handle          one per stop on the track (drag to move; press empty = add)
        └── StopCard        full-width per stop: ColorSample → ColorPicker (surface=square) · "A" auto toggle · trash (hover)
├── Footer                 export bar: Create variables · Create styles · Create swatches (ADR-024)
└── ColorExtractor (ADR-025)  image→palette; renders at App level
    ├── IntakeModal       overlay while intake/loading: dropzone + paste/URL listener
    └── ExtractWorkspace  full-area (replaces normal UI) while stage=workspace
        └── Swatch        square color toggle (2-col grid); deselected = opacity 0.4
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
- **Two picker surfaces (ADR-023):** `ColorPicker`'s `surface` prop swaps the 2D
  control. `wheel` (key colors) = polar `angle`+`radius` ring + a `Gradient` slider
  on the `axis`, dots = other key colors. `square` (gradient stops, `StopCard`
  passes it) = the inverse pairing: a cartesian `radius`×`axis` `SquareField` + a
  `Gradient` slider on the hue, dots = other stops of the same color. Same three
  `picker` roles, regrouped — helpers `channelsToSquare`/`squareToChannels`/
  `squareColorAt`/`channelsToHue01`/`hue01ToChannel`/`buildHueSliderGradient` in
  `picker.ts`. `SquareField` sample-paints a 32×32 `<canvas>` (`squareColorAt` per
  cell, gamut-mapped, CSS-smoothed; repaints only on hue/model change), so the
  field is truthful for every model incl. LCH (its out-of-gamut C×L region
  saturates out to the nearest in-gamut color).
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
- `components/Tooltip` wraps every icon button (ADR-017): a custom hover/focus
  tooltip on `@floating-ui/dom` (offset/flip/shift/arrow, `fixed` strategy so it
  escapes card overflow, 400 ms dwell delay). Figma-style dark bubble with
  hard-coded colors (Figma tooltips are dark in both themes). The trigger is
  wrapped in an `inline-flex` span so tooltips also show on disabled buttons.
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
- **Network access:** `figma-plugin.networkAccess.allowedDomains: ["*"]` — required
  only so the UI may `fetch` an arbitrary image URL for color extraction (ADR-025).
