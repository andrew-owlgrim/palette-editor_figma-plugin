# Backlog

Deferred / potential work — ideas parked for an indefinite future, not committed
to a milestone. Unlike [tasks.md](tasks.md) (active work + status), entries here
have no owner or deadline. Promote an item to `tasks.md` when it's picked up.

Each: short title → why it's here → what to consider.

---

## Revisit the undo-history update model

**Why:** Undo currently works by _tracking state_ — zundo's `temporal`
middleware snapshots the whole document on every change, and live edits are
coalesced by pausing tracking and pushing one manual snapshot on commit
(`src/store/history.ts`, ADR-011/ADR-012). It works, but the pause + manual
`temporal.setState` push leans on zundo internals and is easy to get subtly
wrong (lost pre-edit state, re-entrancy, limit/`futureStates` bookkeeping).

**Consider:** Moving to _manual history updates_ instead of automatic state
tracking — i.e. explicitly recording an undo entry at each semantic commit
point (drag end, input blur, add/remove/rename, model switch) rather than
diffing/snapshotting on every `set`. Possibly a command/patch-based history
(store deltas, not full-document snapshots). Evaluate whether this simplifies
`history.ts`, removes the dependency on zundo's pause/resume, and reduces memory
(deltas vs. full snapshots) — against the cost of annotating every mutation.

## Rework borders in layout

**Why:** borders change dimensions of elements and add micro shifts (particularly for color picker popover)

## Revisit the drag trigger on key-color cards

**Why:** the whole card is currently the drag source (`useSortable` listeners on
the card root, `distance: 1` activation). It works, but a tiny pointer move
anywhere on the card starts a reorder, which constrains in-card interactions
(the name field already needs a `stopPropagation` escape hatch).

**Consider:** making a **draggable color sample** (the swatch) the trigger
instead of the entire card — or a dedicated handle. Weigh the clearer
affordance and freed-up card surface against losing "grab anywhere" and the
extra wiring (separate handle node, hover reveal).

## Revisit input interaction & native Ctrl+Z behavior

**Why:** the text/number fields use a patchwork of patterns — `NameInput` and
`StopInput` keep a local draft and commit on blur, `ChannelInput` writes live via
`onValueInput`, and the DS `RawTextboxNumeric` is fully controlled (a number fed
back as `value` broke typing — see the Shades UI note in `architecture.md`).
Meanwhile the global Ctrl/Cmd+Z handler now `preventDefault`s the browser's native
textbox undo and blurs the focused field, so in-field undo no longer works at all.

**Consider:** a single, consistent input model — draft vs. live, where commits
happen, how Escape/blur behave — and a deliberate decision on native field undo:
either restore per-field undo while a field is focused (and keep it out of the
plugin history), or keep the unified plugin-history behavior but make it obvious.
Audit all fields (`NameInput`, `StopInput`, `CountStepper`, `ChannelInput`,
`GhostInput`) against whichever model is chosen.

## Consider making adjusted OKLCH color picker

**Why**

**Consider** making OKLCH instead of LCH input model but with adjusted color picker and input values in order to humanize inputs (particularly inconvenient saturation axis)

## lightness axis direction when import
