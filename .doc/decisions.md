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
- **Consequence:** no canvas; DnD Kit stays unused. (Wheel color fidelity & hue
  axis amended by ADR-014.)

## ADR-012 — Coalesce live edits into one undo step

- **Context:** a drag or per-keystroke edit fired dozens of zundo entries.
- **Decision:** `store/history.ts` `beginLiveEdit`/`endLiveEdit` snapshot the
  pre-edit document and pause zundo, committing one snapshot on release/blur;
  drags and channel fields call them.

## ADR-013 — Canonical float-rgb color as the source of truth

Supersedes ADR-005; persistence later amended by ADR-015 (`name` → `customName`).

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
- **Decision:** `customName: string | null`; effective name
  `customName ?? autoName(color)` derived on read (auto name never stored). Match
  nearest sRGB over a vendored ~1.5k *Name that Color* list (CC BY 2.5) — chosen
  over a larger list / online API. Persist `customName` only; migrate legacy
  `name`.
- **Consequence:** names can't drift from the color; ~40 KB list in the bundle;
  duplicate auto names possible (export-time dedupe deferred).

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
  Constrain **only lightness** (OKLCH L ∈ [0.2, 0.8], central ~60%) so colors
  keep tonal-scale headroom; hue/chroma stay free (out-of-gamut chroma reduced
  via `toGamut`). Reroll excludes the rerolled color and reverts it to auto-name.
- **Consequence:** works at any count (empty → random, one → a distant partner);
  intentionally non-deterministic; envelope is tunable. Rejected hue-template
  schemes and a "matched L/C + hue-gap" hybrid as too rigid/boring.
