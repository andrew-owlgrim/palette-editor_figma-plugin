# Decisions (ADR log)

Strategic decisions and implementation forks — the *why* behind non-obvious
choices and the constraints future work must respect. Implementation detail
lives in the code and `architecture.md`; superseded entries are collapsed to one
line. Newest at the bottom; numbers are stable (referenced elsewhere).

---

## ADR-001 — `create-figma-plugin` toolkit (Preact)

- **Context:** need a Figma-plugin scaffold (two-thread build, typed messaging,
  native-looking components).
- **Decision:** `create-figma-plugin` v4 — its `@create-figma-plugin/ui`
  design-system components are why the UI is Preact, not React.
- **Consequence:** esbuild via the toolkit; custom config only through
  `build-figma-plugin.*.js` overrides.

## ADR-002 — `react` → `preact/compat` type aliasing

- **Context:** React-typed libraries (DnD Kit) clash with Preact's JSX types.
- **Decision:** alias `react`/`react-dom`/`react/jsx-runtime` → preact in tsconfig
  `paths` (+ the toolkit's bundle-time alias), `skipLibCheck`. Do **not** install
  `@types/react`.
- **Consequence:** React-typed libs work under Preact. Adding `@types/react`
  re-breaks `DndContext` children typing — never reintroduce.

## ADR-003 — `zustand` + `zundo` for state and undo/redo

- **Decision:** zustand v5 store; zundo `temporal` for history, `partialize`d to
  the document (`{ keyColors, settings }`), `limit: 100`.

## ADR-004 — CSS Modules, not Tailwind

- **Context:** Tailwind v4 would need a custom esbuild plugin (the toolkit treats
  every `.css` as a CSS Module).
- **Decision:** CSS Modules + Figma `--figma-color-*` vars, one `.css` per
  component. The plugin was judged overkill.
- **Consequence:** component-scoped CSS, no utilities. Don't reintroduce Tailwind
  without revisiting the esbuild tradeoff.

## ADR-005 — Raw channel strings as source of truth

Superseded by ADR-013: channel→channel model switches are lossy.

## ADR-006 — Undo covers the whole document

History tracks the entire `PaletteDocument`, so an input/blending model switch is
a normal, undoable action.

## ADR-007 — Gamut-map hsl/hsv via `toGamut('rgb','oklch')`

- **Context:** wide-gamut / near-white colors gave out-of-range HSL/HSV channels
  (white showed `s ≈ 100`; HSL saturation is unstable near L 0/100).
- **Decision:** hsl/hsv map into sRGB with `toGamut('rgb','oklch')` before reading
  channels; lch keeps wide gamut. (Extended to *all* hex output in ADR-014.)

## ADR-008 — Per-file persistence: load-on-open + save-on-change

- **Decision:** store the document in `figma.root` `sharedPluginData`; load
  synchronously at startup → UI `initialDocument`; save debounced over the
  emit/on bridge; hydrate-then-clear-history before subscribing (no save echo,
  load stays out of undo). No live multi-user sync.
- **Consequence:** two simultaneously-open sessions don't live-update until reopen.

## ADR-009 — `sharedPluginData` namespace `mycolors`

`getSharedPluginData` requires alphanumeric/`_`; the hyphen in `my-colors` threw.
Keep namespaces hyphen-free.

## ADR-010 — No `suffix` on numeric inputs

Removed: implementation detail (`TextboxNumeric` `suffix` baked `%` into the
value) — see `ChannelInput`.

## ADR-011 — Custom color picker; raw pointer drag (not DnD Kit)

- **Context:** need a hue wheel + lightness slider + channel inputs in a popover;
  the DS has none, and DnD Kit is sortable-oriented (awkward for radial/linear
  drag).
- **Decision:** build from small, CSS-rendered pieces, model-agnostic via
  `picker: { angle, radius, axis }` on each `ColorModelDef`; drag via
  `usePointerDrag` (window-level pointer capture). A custom `Popover` adds a
  `fixed` `right-top` placement that flips/clamps to the window.
- **Consequence:** no canvas; the picker doesn't use DnD Kit. (DnD Kit was later
  adopted for key-color reordering — ADR-019. Wheel color fidelity & hue axis
  amended by ADR-014.)

## ADR-012 — Coalesce live edits into one undo step

- **Context:** a drag or per-keystroke edit fired dozens of zundo entries.
- **Decision:** `store/history.ts` `beginLiveEdit`/`endLiveEdit` snapshot the
  pre-edit document and pause zundo, committing one snapshot on release/blur;
  drags and channel fields call them.

## ADR-013 — Canonical float-rgb color as the source of truth

Supersedes ADR-005; persistence later amended by ADR-015 (`name` → `customName`)
and ADR-020 (a key color is now the key *stop* of a gradient; the canonical color
lives on each `GradientStop` instead of a single `KeyColor.color`).

- **Context:** channels-as-truth round-trips lossily on every model switch and
  can't hold wide-gamut LCH; we also need a stable canonical color for future
  tints. (A 16-bit-hex source was rejected — culori/CSS cap hex at 8-bit.)
- **Decision:** each key color stores an **unclamped culori `rgb`-mode `color`**;
  `channels` become a derived editable buffer in the current model, hex derived
  for display. Channel edit recomputes `color`; hex edit re-derives channels;
  model switch leaves `color` untouched (reversible). Persist `color` only;
  re-derive channels on load; migrate older files.
- **Consequence:** lossless, reversible model switching; wide-gamut LCH survives.
  Tradeoff: "ghost" channel values not encoded in the color (e.g. a hue at `s=0`)
  don't survive a hex edit / reload — accepted.

## ADR-014 — Model-aware hue ring + gamut-mapped rendering

Amends ADR-011.

- **Context:** the wheel painted a static HSL conic (LCH hue ≠ HSL hue, so the
  color under the cursor was wrong), and naive per-channel hex clamping made
  out-of-sRGB LCH ends over-bright instead of dark/white.
- **Decision:** map all display hex through `toGamut('rgb','oklch')`; paint the
  conic per model via `hueRingColor(hue)` / `buildHueWheelConic`; hue 0° at the
  right (`ANGLE_OFFSET_DEG = 90`).
- **Scope (deliberately partial):** the wheel keeps a white center overlay and is
  L-independent (ring fixed at L=55); a full L-aware disc was deferred.

## ADR-015 — Auto color naming (derive-on-read)

Amends the persistence note in ADR-013.

- **Context:** "new color N" is noise; names should follow the color yet stay put
  once a user renames.
- **Decision:** effective name derived on read via `resolveName` (auto name never
  stored). Match nearest sRGB over a vendored ~1.5k *Name that Color* list
  (CC BY 2.5) — chosen over a larger list / online API. Migrate legacy `name`.
- **Consequence:** names can't drift from the color; ~40 KB list in the bundle;
  duplicate auto names possible (export-time dedupe deferred).
- **Amended:** the implicit `customName: string | null` (null = auto) became an
  explicit `{ customName: string, autoName: boolean }` pair — mirroring a stop's
  `{ position, autoPosition }` so the UI shows the same auto/manual toggle ("A").
  `autoName` is persisted (migrated: auto iff no name was set). Both the name and
  position fields are always editable and pin (→ manual) only when the value
  actually changes on blur — like dragging a gradient handle; empty manual name
  reverts to auto. Toggling auto→manual via "A" seeds the field with the current
  auto value, so the toggle itself never changes the value. Reroll keeps the name.

## ADR-016 — Canvas selection fills (eyedropper, add-matching)

- **Context:** Figma's native eyedropper isn't exposed to plugins; the browser
  `EyeDropper` API was rejected (iframe-runtime uncertainty). Read fills of
  selected nodes instead.
- **Decision:** the main thread collects the top-level selection's visible SOLID
  fills (deduped) → an **ephemeral** UI store (out of undo/persistence); a
  per-card eyedropper uses `fills[0]`, add-matching appends all.
- **Consequence:** offline, no manifest/network change. Assumes an sRGB document,
  ignores paint opacity, won't refresh without a selection change.

## ADR-017 — Icon-button tooltips via `@floating-ui/dom`

- **Context:** icon buttons need hover tooltips (dwell delay, arrow, smart
  positioning) matching Figma; the DS ships none.
- **Decision:** `@floating-ui/dom` (framework-agnostic, no React types — fits
  ADR-002) + a custom `components/Tooltip` (offset/flip/shift/arrow, `fixed` to
  escape card overflow; colors hard-coded dark since Figma tooltips are
  theme-independent).
- **Constraint (non-obvious, affects future pointer UI):** in the plugin iframe
  `pointerleave` and `element.matches(':hover')` are **unreliable**. Hover is
  therefore tracked via a global `pointermove` (target-containment) as the trusted
  signal for both show and hide; tooltips must also work on disabled buttons
  (`.trigger :disabled { pointer-events: none }`).

## ADR-018 — Harmonious color generation (max-min in OKLab)

- **Context:** "add key color" and per-card "reroll" need a new color that fits
  an *arbitrary* existing set. Fixed schemes (analogous/triad/tetrad) don't
  generalize to a random array, and the goal is pleasant, non-garish **variety**
  — not a deterministic "correct" color (which risks being boring).
- **Decision:** `color/harmony.ts` `harmoniousColor(existing)` — best-candidate /
  farthest-point: draw N random candidates, keep the one whose nearest existing
  color is farthest in OKLab (ΔEok). Random by design (reroll differs each time).
  Bound candidates in lightness (a generous mid-range, so colors keep tonal-scale
  headroom) and chroma (a moderate cap, to avoid neon); hue is free, out-of-gamut
  samples reduced via `toGamut`. Exact bounds are tuning constants in
  `harmony.ts`. Reroll excludes the rerolled color and reverts it to auto-name.
- **Consequence:** works at any count (empty → random, one → a distant partner);
  intentionally non-deterministic; envelope is tunable. Rejected hue-template
  schemes and a "matched L/C + hue-gap" hybrid as too rigid/boring.

## ADR-019 — Drag-and-drop key-color reordering (DnD Kit, whole-card source)

- **Context:** users need to reorder key colors. DnD Kit was already a dependency
  (ADR-002 aliasing makes its React types fit Preact); the card list is a
  horizontal scroller. The card is full of interactive controls (swatch→picker,
  reroll/eyedropper/trash, name field), so the drag trigger must not steal clicks.
- **Decision:** `@dnd-kit/sortable` with `horizontalListSortingStrategy`. The
  **whole card** is the drag source (no separate handle), with a `PointerSensor`
  `activationConstraint: { distance: 1 }` — a click never moves, so it falls
  through to the controls; the slightest drag starts a reorder. Use a
  `DragOverlay` clone (`KeyColorCardPreview`) and hide the original
  (`visibility: hidden`) so the dragged card floats above the scroll container and
  leaves a clean hole. Reorder commits via the store's `moveKeyColor` (`arrayMove`)
  as one undo step. The name field stops `pointerdown` propagation so text
  selection/typing stays native despite `distance: 1`.
- **Consequence:** "grab anywhere" with no extra chrome; correct hole + float in an
  `overflow` scroller. Tradeoff: the tiny activation distance means in-card pointer
  gestures need an explicit escape hatch (the name field has one). Whole-card vs.
  a swatch/handle trigger is parked for revisiting (see backlog).

## ADR-020 — A key color is the key *stop* of a gradient (`PaletteColor`)

Amends ADR-013 (canonical color now lives per gradient stop, not on a single
`KeyColor.color`). Renames the entity `KeyColor` → `PaletteColor`.

- **Context:** shades are generated from a gradient, and a future editor must let
  the user move/add/recolor that gradient's key points. Storing the key color and
  its gradient as two separate things (and keeping them in sync) is fragile; the
  key color is conceptually *one point of* the gradient.
- **Decision:** one entity `PaletteColor { id, customName, stops: GradientStop[],
  keyStopId, channels }`. The gradient `stops` (each `{ id, position 0..1, color }`,
  canonical unclamped rgb per ADR-013) are persisted as the source of truth; the
  "key color" is the stop pointed to by `keyStopId` (`keyColorOf(pc)`). A single
  `keyStopId` (vs. an `isKey` flag per stop) structurally enforces "exactly one
  key stop". `channels` stays a runtime-only editing buffer for the key stop.
  Adding a key color builds a default gradient (black & white endpoints + key at
  its OKLch lightness; see ADR-021). **Persisted now** (not derived) so the next
  task — the gradient editor — only adds edit actions, not a storage change.
- **Position as a rewritable default:** until the editor exists, every key-color
  edit recomputes the key stop's `position` from the new color's lightness (like
  `customName`/shade steps: an auto value the user can later override). The editor
  will stop auto-recomputing once positions become user-owned.
- **Consequence:** clean forward path to the editor; one named ramp = one gradient.
  Migration builds a default gradient for pre-gradient files. Tradeoff: persisted
  payload grows (stops + colors) and the key-color edit path now addresses a stop
  inside `stops` rather than a flat `color` field.

## ADR-021 — Shade generation: 1/1000 scale sampled from the gradient

- **Context:** each key color needs a tonal scale (shades). The values should read
  like tailwind (0…1000), default evenly, but allow custom per-step values; and
  the ramp must blend in the user's chosen **blending color model** (the first use
  of that setting, stored-only until now).
- **Decision:** a document-level `shades.steps: (number | null)[]` (`null` = auto),
  count = length (stepper, `[2, 26]`, default 11). `resolveSteps` fills autos by
  even distribution **by index** between set anchors, with the 0/1000 edges as
  implicit anchors; a user value is clamped between its set neighbors (monotonic).
  Each shade = `sampleGradient(pc.stops, step/1000, blending)` — culori
  `interpolate` over the stops' `[color, position]` tuples in the blending mode.
  A new **Tone axis direction** setting (`light-dark` default | `dark-light`)
  decides which scale end is light; flipping it mirrors every gradient
  (`position → 1 - position`). Grid cells are display-only for now.
- **Consequence:** blending model finally drives output; scale is tailwind-like and
  fully customizable with auto placeholders. The 0…1000 *scale steps* are distinct
  from a gradient's *key stops* — kept separate in code (`shades.steps` vs.
  `GradientStop`).

## ADR-022 — Inline gradient editor (move/add/recolor stops)

Delivers the editor ADR-020 was built toward. Amends ADR-020: the runtime
`channels` buffer moves from `PaletteColor` onto each `GradientStop`.

- **Context:** users need to edit a `PaletteColor`'s gradient — drag stops, add new
  ones, recolor any stop, and detach a stop's position from its color (until now
  every stop's position auto-followed lightness). The shades grid already renders
  one row per key color, so the editor belongs there.
- **Where / interaction:** the **Shades** rows become individually clickable
  (`--figma-color-bg-hover`); a click injects a full-width `GradientEditor` under
  the active row. It paints the gradient on a track (sampled in the blending model
  via `buildGradientCss`), with a draggable `Handle` per stop; pressing empty track
  **adds** a stop there and drags it (capped at `MAX_STOPS` = 7 total incl.
  endpoints + key stop, via `canAddStop`; at the cap an empty-track press is a
  no-op); pressing within `GRAB_PX` of an endpoint is a no-op (endpoints are fixed). Below, one full-width `StopCard` per stop (swatch →
  the **same `ColorPicker`**, now targeting `(paletteColorId, stopId)`; a delete
  tile on hover; a position-% label + an **"A"** auto toggle).
- **Auto vs. manual position:** `GradientStop.autoPosition` (default `true`,
  persisted). Auto = position derived from the color's lightness **in the active
  blending model** (`modelLightness` → `keyStopPosition`) and re-followed on every
  color edit / tone-direction flip — the established key-stop behavior, now per
  stop. Manual = pinned by a drag; the "A" toggle flips it (turning auto back on
  re-snaps to lightness). This is the "detach" ADR-020 anticipated; `setStopColor`
  only repositions auto stops.
- **Position lightness metric = the blending model's lightness** (so the axis
  matches the space shades blend in): rgb/hsl → HSL L `(max+min)/2`, oklch → OKLab
  L, lch → CIE L\*. OKLab lifts the dark range hard (near-black → ~13% vs ~2% for
  CIE/HSL), which read as a mismatch against the picker's L; tying position to the
  blending model removes the surprise. **`lch` added as a 4th blending model** for
  exactly this: it interpolates *and* positions in CIE LCH (even darks, no OKLab
  lift) — the tradeoff is CIELAB's blue/purple→lilac hue drift on light tints, so
  OKLCH stays the default (hue integrity matters for a palette tool) and the user
  A/Bs per palette. Switching the blending model re-positions all auto stops
  (`repositionAutoStops`), mirroring how a tone-direction flip mirrors them.
- **`channels` per stop:** to let the picker edit *any* stop with the same typed-
  string fidelity (mid-edit raw strings live in the buffer, not local draft),
  `channels` is a runtime-only field on `GradientStop` (re-derived on load / model
  switch via `rederiveChannels`), replacing the single `PaletteColor.channels`.
- **Reuse decision:** the picker's single-handle `Gradient` slider is left alone;
  the multi-stop track is a separate `GradientEditor` reusing the lower-level
  `Handle` + `usePointerDrag` primitives (overloading `Gradient` with N handles +
  add/select would bloat the picker path for no gain).
- **Default dark endpoint:** generated gradients start from a near-black neutral
  at `DARK_ENDPOINT_L` (OKLab L ≈ 0.15, ~#0b0b0b — tunable) instead of pure black,
  to cut the perceptually-indistinguishable bottom OKLab range off the ramp. The
  two endpoints are **pinned** (manual) at the scale ends so the dark one anchors
  at 0/1 rather than drifting to its own lightness; only the key stop is auto.
  Auto positions are normalized to the gradient's real span `[DARK_ENDPOINT_L, 1]`
  (not `[0, 1]`), so a color as dark as the dark endpoint maps to the end, not a gap.
- **Phantom-hue guard:** a near-gray stop's leftover micro-chroma (a saturation
  that rounds to 0 in the UI) still carries a definite hue, which culori would
  interpolate *toward* — tinting the dark shades. `buildGradientSampler` drops the
  hue (sets it undefined) of any stop that is achromatic in rgb (`max−min <
  ACHROMATIC_EPS`), so the adjacent chromatic stop's hue carries across it instead.
- **Delete guard:** `canDeleteStop` blocks the two endpoints and the key stop.
- **Consequence:** the gradient is now fully editable; persisted payload gains
  `autoPosition` per stop (defaults to `true` for older files). Tradeoff: the
  color-edit store path is now stop-addressed (`setStop*(pcId, stopId, …)`) rather
  than key-color-addressed.

## ADR-023 — Two picker surfaces (wheel for key colors, square for stops)

Amends ADR-011/ADR-014.

- **Context:** the gradient editor reused the key-color picker verbatim (hue wheel
  + lightness slider, dots = other key colors). For a single stop on one ramp the
  relevant view is the classic S/L square + hue slider, with the *other stops of
  the same color* shown so the ramp's saturation/lightness dynamics are visible.
- **Decision:** `ColorPicker` gains a `surface: 'wheel' | 'square'` prop (default
  `wheel`; `StopCard` passes `square`). The square is the **inverse pairing of the
  same three `picker` roles** (ADR-011): wheel = polar(angle+radius) 2D + axis 1D;
  square = cartesian(radius=X, axis=Y) 2D + angle(hue) 1D. So no new per-model
  logic — all three models work via their existing `PickerAxes`. New pure helpers
  in `picker.ts` (`channelsToSquare`/`squareToChannels`/`squareColorAt`,
  `channelsToHue01`/`hue01ToChannel`/`buildHueSliderGradient`); the hue slider
  **reuses `Gradient`** (it's a generic 1D track).
- **Square painting = canvas sampling, not CSS layers.** Layered CSS gradients are
  truthful only for HSV; to stay correct for hsl/hsv/lch — and gamut-correct for
  LCH — `SquareField` sample-paints a small `<canvas>` (RES×RES, `squareColorAt`
  per cell, gamut-mapped) and lets CSS scale it with smoothing. Same "sample, don't
  trust sRGB interpolation" rule as `buildGradientCss`. Repaints only on hue/model
  change (radius/axis drags move the handle, not the field).
- **Consequence/constraint:** LCH's C×L square has a large out-of-gamut region
  (the right side "saturates out" to its nearest in-gamut color) — the honest
  best-effort; the handle still reflects true C/L. RES (32) trades crispness for
  repaint cost (RES² culori conversions per hue tick); bump only if profiling allows.

## ADR-024 — Export (swatches / variables / styles): UI resolves, main materializes

- **Context:** the palette must leave the plugin three ways — a swatch grid on the
  canvas, file **variables**, and file **paint styles**. All the color math
  (gradient sampling, gamut mapping, name resolution) lives in the UI thread;
  `figma.*` (nodes, variables, styles) lives only in `main.ts` (ADR-005/threads).
- **Decision:** the UI computes a flat **`ExportPalette`** (`{ collectionName,
  colors: [{ name, shades: [{ step, hex }] }] }`) via `color/export.ts`
  `buildExportPalette`, reusing the *same* `resolveSteps` + per-color
  `buildGradientSampler` + `colorToHex` + `resolveName` the swatch grid uses — so an
  export always matches what's on screen. It `emit`s one of three handlers
  (`EXPORT_SWATCHES` / `CREATE_VARIABLES` / `CREATE_STYLES`); `main.ts` turns the
  payload into Figma objects (hex → `RGB` via `hexToRgb`). Names are **unified
  `{name}/{step}`** across all three (the slash groups variables/styles into Figma
  folders, and keeps swatch layers consistent). Variables go in the settings
  **collection** (`Settings.collectionName`, default `"Palette"`, created if
  missing); styles are flat (no collection). Variables/styles are **updated in
  place by name** (look up existing, else create) so re-export is idempotent, not
  duplicating. Swatches are wrapped in a frame (named after the collection) using
  Figma's **native GRID auto-layout** (`SWATCH_SIZE` 40, `SWATCH_GAP` 8; row = key
  color, col = shade), each rectangle set to `FILL`×`FILL` (after append) so it
  tracks its cell; placed at the viewport center and selected.
- **Button feedback:** after a press the button briefly swaps its label to a
  "✔ Done" confirmation for `FEEDBACK_MS`, then reverts — local `Footer` state (one
  active flash + a timeout ref, + a success-fill `.flash` class), no store. The
  buttons are **not** disabled by export (export is repeatable);
  they're disabled only when there are no key colors. Optimistic — no main→UI ack.
  (Earlier draft disabled variables/styles until the palette next changed via an
  ephemeral `store/export.ts`; replaced by the transient label so re-export stays
  available.)
- **Consequence/constraint:** export is a pure UI→main hand-off with no new color
  logic on the main side, and stateless on the UI side beyond the transient flash.
  Async variable/style APIs (`get*Async`) are used so the code is correct regardless
  of a future `documentAccess: dynamic-page` switch.

## ADR-025 — Image color extraction (k-means++, UI-only)

- **Context:** seed a palette from an image — drop/paste/upload a picture (or a
  link), pull its dominant colors, pick which to keep, and add them as key colors.
- **Decision — entirely UI-thread.** All of it (decode → cluster → select → add)
  runs in the iframe: pixels come from a `<canvas>`, results go through the
  existing `addKeyColors(hexes)`. `figma.*` isn't needed, so there are **no new
  bridge messages** and `main.ts` is untouched. The only non-UI change is a
  `networkAccess.allowedDomains: ["*"]` in the plugin config, required just so the
  iframe may `fetch` an arbitrary image URL.
- **Clustering — k-means++ in OKLab, best-of-N restarts** (`color/extract.ts`,
  pure/testable): convert sampled pixels to OKLab, k-means++ seed, Lloyd to
  `MAX_ITERATIONS`, repeat `RESTARTS` times and keep the lowest-inertia run.
  Restarts (not a fixed PRNG seed) were the chosen predictability lever — they
  collapse most run-to-run variance toward the same near-optimal colors **without
  freezing** output to one result; full bit-for-bit determinism (a seeded PRNG) was
  considered and declined. Colors are returned ordered by cluster weight
  (dominance). `RESTARTS` (extract.ts) and `DOWNSAMPLE_MAX` (image.ts, longest-side
  cap before clustering) are the two quality/speed knobs; clustering is synchronous
  on the UI thread (a worker was judged overkill at current sizes).
- **Intake — drag / upload / paste / URL** (`ColorExtractor/IntakeModal`). Bytes
  from drag/upload/paste-image never hit CORS; a pasted/typed **URL is best-effort
  (variant A): direct `fetch`, no proxy** — a host without permissive CORS headers
  fails with a clear message (a proxy was rejected: privacy + extra dependency).
  Decode + downsample live in `utils/image.ts`. The DS `FileUploadDropzone`'s
  `acceptedFileTypes` is **not** used — it doubles as an exact-MIME filter
  (`'image/*'` matches nothing, silently dropping every file), so we accept all
  files and let the decoder reject non-images.
- **Full-area workspace, no window resize** (`ColorExtractor/ExtractWorkspace`):
  once an image decodes, the workspace (image left, count stepper + 2-col swatch
  grid + submit/cancel right) **replaces** the normal UI render (`App` swaps the
  tree on stage), rather than resizing the plugin window. Selection state is a
  `Set` reset **during render** (comparing the memoized `colors` ref), not in an
  effect, to avoid a one-frame flash where new swatches paint before selection
  catches up.
- **Ephemeral state** (`store/extractor.ts`): a small zustand stage machine
  (`closed → intake → loading → workspace` + the decoded image), kept out of undo
  history and persistence — same rationale as `store/selection.ts`. The preview
  object URL is revoked on close.
- **Consequence/constraint:** no new color logic or messaging on the main side;
  URL extraction depends on the host's CORS policy (drag/upload/paste are the
  reliable paths); results are stable but not bit-for-bit reproducible.

## ADR-026 — Palette identity + user library (document palette + per-user library)

- **Context:** the file had exactly one palette in `sharedPluginData`, shared by
  everyone. Users want a private library of palettes (a sandbox), available across
  files, while the file's palette stays the single shared source for
  variables/styles. The editor must always edit exactly one *active* palette.
- **Decision:** wrap the existing palette body (`{ keyColors, settings, shades }`)
  in **identity** (`id`, `name`, `updatedAt`) and split storage into two tiers:
  - **Document palette** — one per file, in `sharedPluginData` (unchanged
    behaviour; still the only source for Create variables/styles). Its identity is
    **not persisted in the body**: id = `figma.root.id` (stable, no migration), name
    = `figma.root.name` (read-only — the file name communicates "the file's
    palette", §8.3). Both are passed as synchronous `showUI` props. So the shared
    document schema is **unchanged** — maximally backward-compatible.
  - **User library** — N palettes + global prefs + per-file active pointers, in one
    `clientStorage` entry (`UserLibrary { version, palettes, prefs,
    activeByDocument }`, keyed by `figma.root.id`). Private, async, fetched over the
    bridge after mount (it can't ride the synchronous props), with a `loading` flag.
  - **Two runtime stores:** `usePaletteStore` (existing zustand + zundo temporal)
    holds the active body; `useLibraryStore` (plain zustand, no temporal) holds the
    library, document identity + a cached document body, the active ref, and prefs.
    Library mutations (create/duplicate/rename/delete/switch) are **outside undo**;
    switching palettes `temporal.clear()`s history by design. `createPalette` makes
    an **empty** body (chosen default); `duplicate` deep-copies + appends " copy".
  - **Save routing + dedupe:** the save controller (in `store/library.ts`) routes
    each debounced commit to `SAVE_DOCUMENT` (shared data) or `SAVE_USER_PALETTE`
    (clientStorage) by `activeRef.kind`, and **dedupes on the serialized body** so a
    channels-only re-derivation (model switch, ADR-027) never writes / bumps
    `updatedAt`. `selectPalette` **flushes** the pending save first so no write lands
    on the wrong target, then hydrates + clears history + re-baselines the dedupe.
    Deleting the active palette **cancels** (not flushes) its pending save to avoid a
    resurrection race, then falls back to the document palette.
  - **clientStorage writes are serialized** through a promise chain (mutex) so
    overlapping upsert/prefs/active writes can't clobber, with a soft `LIBRARY_MAX_
    BYTES` quota guard (friendly notify on overflow). `UserLibrary.version` gates a
    future migration switch.
- **Consequence/constraint:** the document palette is unchanged for existing files
  (no data migration); the library is greenfield. Out of scope (deferred): a
  "publish to document" cross-action + a variables-only-from-document invariant
  (export still runs on the active palette); cross-user/library sync; carrying
  `collectionName` on publish. Switching palettes always clears undo (intentional).

## ADR-027 — Settings scope split (palette-scoped vs user-global `inputColorModel`)

Amends ADR-006 (undo no longer covers the input-model switch).

- **Context:** `inputColorModel` lived in the palette `Settings` and was a normal
  undoable action (ADR-006). But it's a pure **display/editing** concern — it never
  changes a stop's canonical `color` — so making it palette data (and undoable, and
  shared via the document) is wrong once palettes multiply.
- **Decision:** split `Settings`. `blendingColorModel` / `toneAxisDirection` stay
  **palette-scoped** (they change generated colors → travel with the palette, stay
  under undo); `collectionName` stays too (MVP simplification). `inputColorModel`
  becomes a **user-global pref** in `UserLibrary.prefs`, surfaced through a tiny
  `store/prefs.ts` holder (`usePrefsStore`) that the palette store reads when
  deriving channel buffers — kept separate from `useLibraryStore` purely to avoid an
  import cycle (the library store owns the change action + persistence). Switching
  the model: `applyInputColorModel` sets the holder and re-derives every stop's
  `channels` via the palette store's `rederiveAllChannels`, wrapped in
  `temporal.pause()/resume()` so it creates **no undo entry**; the persisted body is
  unchanged so the save dedupe skips it (ADR-026). Channels stay **derive-on-read**
  from `color` at the model's display precision (`models.ts` `fmt`), so values don't
  drift on re-derivation. Migration: a legacy `inputColorModel` on a loaded document
  is dropped on hydrate; the pref seeds from the library, else the default `'hsl'`,
  else (first-run nicety) the legacy document value.
- **Consequence/constraint:** the model choice persists across palettes and files,
  never touches color data or undo history. The runtime per-stop `channels` buffer
  is **kept** (removing it is a separable refactor, explicitly out of scope).
