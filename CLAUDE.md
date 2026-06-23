# Palette Editor — Figma plugin

Color palette generator plugin for Figma. Preact UI built on the
`create-figma-plugin` toolkit, with custom color tooling on top of `culori`.

This file is a **router**: where things live and how we work in this repo.
Detail lives in `.doc/` — keep this file thin, don't duplicate.

## Docs

- [.doc/product.md](.doc/product.md) — what the plugin does, why, UX intentions
- [.doc/architecture.md](.doc/architecture.md) — data model, module map, threads, build specifics
- [.doc/tasks.md](.doc/tasks.md) — active work + status (volatile)
- [.doc/backlog.md](.doc/backlog.md) — deferred / potential tasks (no owner or deadline)
- [.doc/decisions.md](.doc/decisions.md) — decision log (ADR; strategic only — see below)
- [.doc/changelog.md](.doc/changelog.md) — user-facing release notes (version / date / what changed)

**Keeping `decisions.md` minimal:** it records *strategic* decisions and
implementation forks only — the **why** behind a non-obvious choice (incl.
rejected alternatives) and constraints future work must respect. Before adding an
entry, ask "does this change an architecture/feature decision later?" If it's a
detail readable from the code or `architecture.md` (helper names, exact values,
step-by-step mechanics, one-off bug fixes), leave it out. Keep each entry to
context → decision → consequence/constraint; no `Date`/`Status: accepted` lines.
Numbers are **stable** (referenced across docs) — never renumber; collapse a
superseded/removed entry to a one-line tombstone instead of deleting it.

## Module map

- `src/main.ts` — plugin (main) thread: `showUI`, per-file load, save handler
- `src/ui.tsx` → `src/app/App.tsx` — UI root; hydrate + debounced save subscription
- `src/components/<Name>/` — one component + its `.css` (CSS Module) per folder
- `src/color/models.ts` — input-color-model registry + culori conversions
- `src/color/naming.ts` (+ `colorNames.data.ts`) — auto color naming (vendored ntc, nearest sRGB)
- `src/color/harmony.ts` — generate a new color harmonious with a set (max-min in OKLab)
- `src/color/gradient.ts` — per-PaletteColor shade gradient (key stop, default stops, sampler)
- `src/color/shades.ts` — 0..1000 shade scale (resolve auto steps, clamp, constants)
- `src/color/export.ts` — resolve palette → flat `ExportPalette` for canvas/variables/styles export (ADR-024)
- `src/color/extract.ts` — k-means++ (OKLab) image color extraction, best-of-N restarts (ADR-025)
- `src/components/ColorExtractor/` — image→palette UI: intake modal + full-area workspace (ADR-025)
- `src/store/index.ts` — zustand + zundo store (the active palette body)
- `src/store/library.ts` — palette library + active ref + debounced save router (ADR-026)
- `src/store/prefs.ts` — user-global `inputColorModel` holder (ADR-027)
- `src/store/selection.ts` — ephemeral canvas-selection fills (out of undo/persist)
- `src/store/extractor.ts` — ephemeral image-extractor stage machine (out of undo/persist)
- `src/components/PaletteSwitcher/` — header palette switcher + delete-confirm modal (ADR-026)
- `src/utils/storage.ts` — `clientStorage` (user library) / `sharedPluginData` (document) wrappers
- `src/utils/image.ts` — decode + downsample File/Blob/URL → pixels for extraction (ADR-025)
- `src/utils/clipboard.ts` — copy text (Clipboard API + textarea fallback) for shade-pick copy (ADR-030)
- `src/hooks/useOverlayScrollbars.ts` — Figma-themed overlay scrollbars hook (ADR-029)
- `src/styles/scrollbars.css` — global OverlayScrollbars theme (`!`-prefixed global import)
- `src/types/` — domain types + ambient `*.svg` / `*.css` declarations

## Commands

- `npm run watch` — dev build (then Figma → Plugins → Development → Import plugin from manifest)
- `npm run build` — typecheck + minified build
- `npm run lint` · `npm run format`
- After any code change, run **build + lint + prettier** before considering it done.

## Project-specific rules (learned the hard way)

- **Threads:** `figma.*` exists ONLY in `main.ts`. The UI iframe reaches it via
  `emit` / `on` from `@create-figma-plugin/utilities`. Storage helpers in
  `utils/storage.ts` must be called from the main thread.
- **Styling = CSS Modules, NOT Tailwind.** Tailwind needs a custom esbuild
  plugin here — rejected as overkill (ADR-004). Use Figma CSS vars
  (`--figma-color-*`) for native look; they ship via `@create-figma-plugin/ui`.
- **Global / vendored CSS = `!`-prefixed import** (e.g. `import '!pkg/foo.css'`):
  the toolkit injects it un-hashed and resolves bare `node_modules` paths. That's
  how the OverlayScrollbars stylesheet + our theme load (in `ui.tsx`).
- **Scrollbars = OverlayScrollbars (ADR-029).** Its host is forced to
  `flex-direction: row`, so it can't be your flex/grid container — put the layout on
  an inner wrapper and attach the scroll ref to the element that actually overflows.
  Its viewport's `z-index:0` traps `position:fixed` popovers → portal floating
  popovers to `<body>` (the shared `Popover` already does this).
- **Preact, not React.** `tsconfig` aliases `react` / `react-dom` /
  `react/jsx-runtime` → preact equivalents so DnD Kit's React-typed props fit.
  Do NOT add `@types/react` (it breaks `DndContext` children typing). Preserve this.
- **Verify DS component props by reading their `.d.ts`** before use — they differ
  from React conventions (e.g. `onValueInput`, `onValueChange`, icons are `Icon…24`).
- **`sharedPluginData` namespace** must be alphanumeric / `_` only (no `-`).
  Currently `mycolors` (ADR-009).
- **`clientStorage` needs a non-empty manifest `id`** — `figma.clientStorage`
  throws "Cannot access client storage without a plugin ID" if `figma-plugin.id`
  in `package.json` is `""`. Dev id is `my-colors-dev`; replace with the real id
  on publish (clientStorage data is keyed by id, so it won't carry over).
  `sharedPluginData` (the document palette) does NOT need an id — that's why only
  the user library broke. Re-import the manifest in Figma after changing the id.
- Do **not** run `npm audit fix --force` — it downgrades esbuild and breaks the
  build. The flagged esbuild Deno-RCE advisory doesn't apply (we don't use Deno).
- Generated `*.css.d.ts` are git/lint/prettier-ignored — don't edit or commit them.
