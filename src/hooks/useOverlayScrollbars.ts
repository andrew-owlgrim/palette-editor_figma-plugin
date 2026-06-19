import { useCallback, useRef } from 'preact/hooks'
import { OverlayScrollbars } from 'overlayscrollbars'
import type { PartialOptions } from 'overlayscrollbars'

// Shared OverlayScrollbars defaults: Figma-themed, floating, auto-hiding bars
// (backlog "rework scrollbars"). Overlay scrollbars never occupy layout, so a
// region becoming scrollable no longer shifts content; `autoHide: 'leave'` keeps
// the bar hidden until the pointer is over the scroll area (Figma-like). The
// theme class is wired to `--figma-color-*` in src/styles/scrollbars.css.
const DEFAULT_OPTIONS: PartialOptions = {
  scrollbars: {
    theme: 'os-theme-figma',
    autoHide: 'leave',
    autoHideDelay: 600,
  },
}

// Attach Figma-styled overlay scrollbars to a scroll container. Returns a callback
// `ref` to put on the element — initializing whenever the node mounts (including
// conditionally-rendered modals) and destroying on unmount — plus an `instance`
// ref for imperative access (e.g. scrolling the managed viewport). Pass `options`
// (typically `overflow`) to constrain the scroll axis per container.
export function useOverlayScrollbars<T extends HTMLElement = HTMLDivElement>(
  options?: PartialOptions,
): { ref: (node: T | null) => void; instance: { current: OverlayScrollbars | null } } {
  const instance = useRef<OverlayScrollbars | null>(null)
  // Keep the latest options without re-creating the (stable) callback ref.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const ref = useCallback((node: T | null) => {
    if (node === null) {
      instance.current?.destroy()
      instance.current = null
      return
    }
    instance.current = OverlayScrollbars(node, { ...DEFAULT_OPTIONS, ...optionsRef.current })
  }, [])

  return { ref, instance }
}
