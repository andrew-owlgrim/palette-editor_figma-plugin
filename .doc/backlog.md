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
