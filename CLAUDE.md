# My Colors — Figma plugin

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
- `src/store/index.ts` — zustand + zundo store (the palette document)
- `src/store/selection.ts` — ephemeral canvas-selection fills (out of undo/persist)
- `src/utils/storage.ts` — `clientStorage` / `sharedPluginData` wrappers
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
- **Preact, not React.** `tsconfig` aliases `react` / `react-dom` /
  `react/jsx-runtime` → preact equivalents so DnD Kit's React-typed props fit.
  Do NOT add `@types/react` (it breaks `DndContext` children typing). Preserve this.
- **Verify DS component props by reading their `.d.ts`** before use — they differ
  from React conventions (e.g. `onValueInput`, `onValueChange`, icons are `Icon…24`).
- **`sharedPluginData` namespace** must be alphanumeric / `_` only (no `-`).
  Currently `mycolors` (ADR-009).
- Do **not** run `npm audit fix --force` — it downgrades esbuild and breaks the
  build. The flagged esbuild Deno-RCE advisory doesn't apply (we don't use Deno).
- Generated `*.css.d.ts` are git/lint/prettier-ignored — don't edit or commit them.
