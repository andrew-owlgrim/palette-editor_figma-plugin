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

**Date:** 2026-06-16 · **Status:** accepted

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
