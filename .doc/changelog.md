# Changelog

User-facing release notes for Palette Editor. Newest first. Dates are `YYYY-MM-DD`.
Versions follow [Semantic Versioning](https://semver.org/): MAJOR.MINOR.PATCH.

## [1.0.1] — 2026-06-23

### Added

- **Grab a shade with Ctrl/Cmd + click.** Hold Ctrl (Cmd on Mac) and the shade
  grid turns into a picker — a tooltip shows each swatch's hex:
  - With **nothing selected** on the canvas, clicking a swatch **copies its hex**
    to the clipboard.
  - With **layers selected**, clicking a swatch **applies that color** to each
    selected layer's top fill — just like Figma's native eyedropper (the color
    fully replaces the fill, so any transparency resets to 100%). If you've already
    exported that shade as a **variable**, the fill is linked to that variable
    instead of a plain color, so the layer stays in sync with your token.
  - A small notification confirms either action.

### Changed

- **Default tone direction is now Dark → Light** (was Light → Dark). Existing
  palettes keep whatever direction they were saved with; only new palettes start
  Dark → Light. You can still switch it in Settings.
- **Importing from another palette keeps each ramp's light/dark orientation.** When
  the source palette uses the opposite tone direction, imported colors are now
  mirrored to match your active palette instead of coming in reversed.

### Removed

- **LCH is no longer offered as a blending color model** (RGB / HSL / OKLCH remain).
  Palettes already saved with LCH continue to render correctly.

[1.0.1]: #101--2026-06-23
