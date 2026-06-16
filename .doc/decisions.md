# Decisions (ADR log)

Append-only. Newest entries at the bottom. Each: context → decision → consequences.

---

## ADR-001 — Use `create-figma-plugin` toolkit (Preact)

**Date:** 2026-06-15 · **Status:** accepted

**Context:** Need a Figma-plugin scaffold with the two-thread build, typed
messaging, and native-looking UI components.

**Decision:** Use `create-figma-plugin` v4. Its `@create-figma-plugin/ui`
provides Figma design-system components, which is the main reason it's built on
Preact.

**Consequences:** UI runtime is Preact, not React. Build is esbuild via the
toolkit (custom esbuild config only through `build-figma-plugin.*.js` overrides).

---

## ADR-002 — Preact with `react` → `preact/compat` type aliasing

**Date:** 2026-06-15 · **Status:** accepted

**Context:** DnD Kit (and other libs) are typed against React; their props (e.g.
`children: React.ReactNode`) clashed with Preact's JSX types.

**Decision:** Alias `react` / `react-dom` / `react/jsx-runtime` to the preact
equivalents in `tsconfig` `paths`; rely on the toolkit's built-in react→preact
esbuild alias at bundle time. Do **not** install `@types/react`. Enable
`skipLibCheck`.

**Consequences:** Libraries expecting React work under Preact. Adding
`@types/react` re-breaks `DndContext` children typing — must not be reintroduced.

---

## ADR-003 — `zustand` + `zundo` for state and undo/redo

**Date:** 2026-06-15 · **Status:** accepted

**Context:** Need a small store plus undo/redo.

**Decision:** `zustand` v5 for state, `zundo` v2 `temporal` middleware for
history. `partialize` to the document (exclude action fns); `equality` via
`JSON.stringify`; `limit: 100`.

**Consequences:** `useTemporalStore` selector hook over `temporal`. History is
the document only.

---

## ADR-004 — CSS Modules, not Tailwind

**Date:** 2026-06-16 · **Status:** accepted

**Context:** Considered Tailwind v4. The toolkit's esbuild pipeline intercepts
all `.css` as CSS Modules; integrating Tailwind required a custom esbuild plugin
to run `@tailwindcss/postcss` and inject the result.

**Decision:** Drop Tailwind. Use CSS Modules (built into the toolkit), one `.css`
per component, plus Figma `--figma-color-*` variables for native look. The custom
plugin was judged overkill.

**Consequences:** No utility classes; component-scoped CSS. Don't reintroduce
Tailwind without revisiting the esbuild-plugin tradeoff.

---

## ADR-005 — Raw channel strings as the source of truth

**Date:** 2026-06-16 · **Status:** superseded by [ADR-013](#adr-013--canonical-float-rgb-color-as-the-source-of-truth)

**Context:** Color inputs are edited in a user-chosen model (hsl/hsv/lch) and
must persist exactly what was typed; conversions are lossy.

**Decision:** A key color stores `channels: Record<string,string>` — raw input
strings in the *current* `inputColorModel` — and nothing else. The displayable
color is derived via culori on demand. Switching the input model recomputes all
channels (`old → culori color → new`).

**Consequences:** Minimal, save-ready model. No stored canonical color. Parsing
happens at conversion/render time.

---

## ADR-006 — Undo covers the whole document, including model switches

**Date:** 2026-06-16 · **Status:** accepted

**Context:** Should changing the input/blending color model be undoable?

**Decision:** Yes — undo/redo tracks the entire `PaletteDocument`
(`keyColors` + `settings`). A model switch (which rewrites all channels) is a
normal, undoable action.

**Consequences:** Predictable history; simplest mental model. zundo `partialize`
to `{ keyColors, settings }`.

---

## ADR-007 — Gamut-map hsl/hsv via `toGamut('rgb','oklch')`

**Date:** 2026-06-16 · **Status:** accepted

**Context:** Converting wide-gamut/near-white colors (esp. from LCH) to HSL/HSV
produced channel values out of range — white showed `s ≈ 100` (HSL saturation is
unstable as lightness → 100%, amplified by floating-point dust in lch→rgb).
`clampChroma` / `clampRgb` didn't fix near-white (left unequal ~1.0 channels).

**Decision:** In `hsl`/`hsv` `toChannels`, map into sRGB with
`toGamut('rgb','oklch')` (CSS Color 4) before reading channels; it snaps
near-white/black to exact RGB. `lch` keeps wide gamut. `fmt()` also hard-clamps
to `[min,max]`.

**Consequences:** Channels stay in range; white→`s 0`; wide-gamut colors map with
hue preserved.

---

## ADR-008 — Per-file persistence; load-on-open + save-on-change

**Date:** 2026-06-16 · **Status:** accepted

**Context:** The palette must be shared with everyone editing the file.

**Decision:** Persist `PaletteDocument` in `figma.root` `sharedPluginData`. Load
synchronously at startup and pass to the UI as `initialDocument`; save on store
changes, debounced 400 ms, over the `emit`/`on` bridge. Hydrate-then-clear-history
before subscribing to avoid save echo and keep load out of undo. No live
concurrent multi-user sync (loads on (re)open). `clientStorage` (per-user) not used.

**Consequences:** Simple and robust. Two simultaneously-open sessions won't
live-update each other until reopened.

---

## ADR-009 — `sharedPluginData` namespace `mycolors` (no hyphen)

**Date:** 2026-06-16 · **Status:** accepted

**Context:** `getSharedPluginData` threw: namespace must be alphanumeric / `_`.
The original `my-colors` contained a hyphen.

**Decision:** Namespace is `mycolors`.

**Consequences:** No data lost (reads/writes never succeeded before). Keep
namespaces hyphen-free.

---

## ADR-010 — No `suffix` on numeric channel inputs

**Date:** 2026-06-16 · **Status:** accepted

**Context:** `TextboxNumeric`'s `suffix="%"` bakes the suffix into the value
string (on blur/arrow), so `"50%"` leaked into the raw channel values.

**Decision:** Don't use `suffix`; channel inputs are plain numbers. A unit
indicator, if wanted, should be static text outside the input.

**Consequences:** Clean numeric raw values; the `%` artifact is gone.

---

## ADR-011 — Custom color picker; raw pointer drag (not DnD Kit)

**Date:** 2026-06-16 · **Status:** accepted (wheel color fidelity & hue axis amended by [ADR-014](#adr-014--model-aware-hue-ring-gamut-mapped-rendering-hue-0-at-right))

> Note: the "Wheel tint is sRGB-approximate for LCH" and "hue 225° at top
> (`ANGLE_OFFSET_DEG`)" details below are superseded by ADR-014 — the ring is now
> painted in each model's own hue scale (gamut-mapped) and hue 0° sits at the right.

**Context:** Needed a custom color picker (hue wheel + lightness gradient +
channel inputs) in a popover. The DS has no popover and no draggable
wheel/slider; DnD Kit (already a dependency, "planned use") is list/sortable-
oriented and awkward for constrained radial/linear dragging.

**Decision:** Build it from small pieces, all CSS-rendered (no canvas):
- `HueWheel` — `conic-gradient` hue + radial-white saturation overlay; polar
  geometry in `color/picker.ts`. Hue 225° sits at top (`ANGLE_OFFSET_DEG`,
  cosmetic; shared by background + handle math).
- `Gradient` — universal controlled 1D slider; the consumer supplies the CSS
  track background (`buildAxisGradient` samples the model's lightness/value axis
  to hex), the component owns the handle.
- `Handle` — presentational dot; `draggable` shows a color sample, otherwise a
  plain white dot (used to mark other key colors on the wheel).
- `usePointerDrag` — pointer-capture drag on the track element; constraints
  (clamp into circle / onto line) live in each consumer. Chosen over DnD Kit.
- `GhostInput` — borderless hex field that reveals a border on hover/focus
  (mirrors `Textbox` states); validates/normalizes via culori on blur/Escape.
- `ChannelInput` — `TextboxNumeric` with the channel label in the DS `icon`
  slot (label-inside-input), reused by the picker and `KeyColorCard`.
- Model-agnostic via `picker: { angle, radius, axis }` on each `ColorModelDef`.

The `Popover` gained a `right-top` placement: when given an `anchorRef` it
positions `fixed` from the trigger's bounding rect (escapes card overflow),
measuring its own size to flip to the left side (right-top → left-top) and clamp
when it would overflow the window; without one it keeps the original
CSS-anchored behavior.

**Consequences:** No canvas, cheap per-frame work (trig + a transform). Wheel
tint is sRGB-approximate for LCH (handle value stays correct). LCH chroma radius
is linear `c / 150`; out-of-gamut points clamp on conversion (same behavior as
the numeric input). New store action `setKeyColorChannels` writes hue+saturation
together so a wheel drag is one undo step / one save. DnD Kit remains unused.

---

## ADR-012 — Coalesce live edits into one undo step

**Date:** 2026-06-16 · **Status:** accepted

**Context:** A wheel/gradient drag and per-keystroke channel edits each fire many
store updates; zundo records every change, so a single drag or field edit
produced dozens of undo entries. Desired checkpoints: the state *between* a
completed drag and an input blur. Pausing zundo around the interaction alone
loses the pre-edit state (it was the "present" and gets overwritten while
paused, never pushed to `pastStates`).

**Decision:** `src/store/history.ts` exposes `beginLiveEdit` / `endLiveEdit`.
Begin snapshots `{ keyColors, settings }` and `pause()`s tracking; end `resume()`s
and, if the doc changed, pushes that one snapshot directly onto the temporal
store (`usePaletteStore.temporal.setState`, appending `pastStates` + clearing
`futureStates`), mirroring zundo's own `_handleSet`. Drags call them via
`onDragStart`/`onDragEnd` (forwarded through `HueWheel`/`Gradient`); channel
fields call them on focus/blur. Re-entrant calls keep the first snapshot.

**Consequences:** One undo step per drag / per field edit. The hex `GhostInput`
needs no wrapping (it commits once on blur). Pointer-drag listeners live on
`window` (in `usePointerDrag`) so a drag keeps tracking outside the element and
never sticks on an out-of-bounds release.

---

## ADR-013 — Canonical float-rgb color as the source of truth

**Date:** 2026-06-16 · **Status:** accepted (supersedes ADR-005)

**Context:** Channels-as-source-of-truth (ADR-005) is lossy: every input-model
switch round-trips `channels → culori → channels` (rounded/clamped), so
hsl→lch→hsl degrades the color and wide-gamut LCH chroma is lost. We also need a
stable canonical color to compute tints from later. A **16-bit hex** source was
considered for precision, but culori (and CSS) cap hex at 8 bits/channel
(`formatHex`/`formatHex8`); a 12-digit hex would be a hand-rolled format culori
can't parse — rejected as a hack.

**Decision:** Store a **canonical culori color in float `rgb` mode** on each key
color (`KeyColor.color`), left **unclamped** so wide-gamut colors persist as
extended sRGB. This is culori-native and the honest version of the "16-bit hex"
idea — rgb floats are hex without 8-bit quantization. `channels` become a
**derived editable buffer** in the current `inputColorModel`; hex is derived for
display. Update rules (in the store):

- **channel edit** → keep the typed strings, recompute `color` from the full
  channel set (`channelsToColor`).
- **hex edit** → set `color` (`hexToColor`), then re-derive `channels`.
- **input-model switch** → `color` untouched; only re-derive `channels` into the
  new model (`colorToChannels`). Now fully reversible.

Helpers in `color/models.ts`: `channelsToColor` (`fromChannels` → `converter('rgb')`,
no clamp), `colorToChannels` (`toChannels`, hsl/hsv still gamut-map per ADR-007),
`colorToHex` (`formatHex`, sRGB-clamped for display), `hexToColor`. Removed
`hexToChannels` and `recomputeChannels`; `channelsToHex` stays (picker gradient).

**Persistence:** only `color` is written to `sharedPluginData`; `channels` are
re-derived on load (`PersistedDocument`/`PersistedKeyColor` are loose types).
`hydrate` migrates older files (no `color`) by reconstructing it from their
stored `channels` + `inputColorModel`, then re-deriving `channels`. Undo history
keeps the full runtime doc (incl. the channel buffer).

**Consequences:** Lossless precision and reversible model switching; wide-gamut
LCH survives a round-trip. Tints (future) read `color`. Tradeoff: "ghost" channel
values not encoded in the color — a hue set on a fully desaturated color, etc. —
don't survive a hex edit / model switch / reload (the canonical color has no hue
at `s=0`). Same class of issue as ADR-007 gamut handling; accepted.

---

## ADR-014 — Model-aware hue ring, gamut-mapped rendering, hue 0 at right

**Date:** 2026-06-16 · **Status:** accepted (amends ADR-011)

**Context:** Two LCH picker defects. (1) The hue wheel painted a **static HSL**
conic, but LCH hue ≠ HSL hue (e.g. HSL 0° = red, but that pixel's LCH hue is 41),
so the color under the cursor didn't match the color being selected. (2) All
display hex went through `formatHex`, a **naive per-channel clamp**: an out-of-sRGB
LCH color (high C at extreme L) clamped to a vivid color instead of darkening —
e.g. `lch(5 120 30)` showed `#760000` instead of near-black `#2c0900`, and
`lch(97 120 30)` showed pink `#ff818b` instead of `#ffffff`. The wheel's hue
origin was also at an arbitrary angle (hue 225° at top).

**Decision:**
- **Gamut-mapped rendering:** `colorToHex` / `channelsToHex` map through
  `toGamut('rgb','oklch')` before `formatHex`, so unreachable chroma reduces
  toward the L-appropriate gray (dark stays dark, light → white). In-gamut
  hsl/hsv colors are unchanged (toGamut is identity there). Extends ADR-007 from
  channel-reading to all hex output (track gradient, swatches, handles).
- **Model-aware hue ring:** each `ColorModelDef` gains `hueRingColor(hue)` (its
  fully-saturated color at the rim: hsl `s1 l.5`, hsv `s1 v1`, lch `l55 c150`).
  `buildHueWheelConic(model)` samples it every 15° (gamut-mapped) into the conic;
  `HueWheel` takes the ring as a `conic` prop (mirrors `Gradient`'s `gradient`).
- **Hue axis:** `ANGLE_OFFSET_DEG = 90` → hue 0° strictly at the right (east),
  increasing clockwise; one constant drives both handle geometry and the conic.

**Scope (deliberately partial):** the wheel keeps the **white** center overlay
and stays **L-independent** (LCH ring fixed at L=55), so under the handle the
*hue* is truthful but not the lightness, and the disc doesn't darken with L. A
full model+L-aware disc (gray-at-current-L overlay, ring at live L) was deferred
as a later increment.

**Consequences:** LCH picking is truthful in hue and no longer shows over-bright
ends. Geometry/channel writes were already correct — only rendering changed.
`channelsToHex` retained (axis gradient); `formatHex` direct use removed from the
display path.
