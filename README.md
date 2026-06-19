# Palette Editor

A Figma plugin for generating and editing color palettes. Define a set of seed
("key") colors and build full tonal scales from them — working in perceptually
meaningful color spaces and keeping the result available to everyone editing the
same file.

Built with [`create-figma-plugin`](https://yuanqing.github.io/create-figma-plugin/),
Preact, and [`culori`](https://culorijs.org/).

## Features

- **Key colors** — a list of color cards with a custom picker (hue wheel,
  lightness, hex, per-channel inputs), auto color naming, reroll into a
  harmonious color, and drag-to-reorder.
- **Shades** — a tonal scale (0…1000) generated per key color from an editable
  gradient, interpolated in your chosen blending color space.
- **Gradient editor** — per-stop handles, saturation/lightness square + hue
  slider, manual or auto stop placement (up to 7 stops).
- **Pull colors from the canvas** — set a card from a selected layer's fill, or
  add every selected fill as new key colors.
- **Extract colors from an image** — drop, paste, upload, or link an image and
  pull its dominant colors via k-means clustering.
- **Import from another palette** — bring whole color ramps over from your other
  palettes.
- **Multiple palettes** — one shared **document palette** per file plus a private
  per-user **library** of saved palettes, with a header switcher.
- **Export** — write shades to Figma **variables** or **paint styles**, or drop
  them on the canvas as a **swatch grid**.

See [.doc/product.md](.doc/product.md) for the full feature tour.

## Install

Once published, install from the Figma Community. To run a local build, see
[Development](#development).

## Development

Prerequisites: Node.js (LTS) and the Figma desktop app.

```bash
npm install
npm run watch
```

Then in Figma desktop: **Plugins → Development → Import plugin from manifest…**
and select this project's `manifest.json`. Re-run the plugin to pick up rebuilds.

| Command          | What it does                          |
| ---------------- | ------------------------------------- |
| `npm run watch`  | Dev build, rebuilds on change         |
| `npm run build`  | Typecheck + minified production build |
| `npm run lint`   | ESLint                                |
| `npm run format` | Prettier                              |

`manifest.json` is generated from the `figma-plugin` field in
[package.json](package.json) — edit it there, not in the generated file. Don't run
`npm run build` while `npm run watch` is active (concurrent manifest writes can
corrupt it).

## Architecture

- Two threads: the plugin **main** thread (`src/main.ts`, the only place `figma.*`
  is available) and the **UI** iframe (Preact, `src/ui.tsx` → `src/app/App.tsx`),
  which talk over `emit` / `on`.
- State lives in a `zustand` + `zundo` store; color tooling (models, naming,
  harmony, gradients, shades, extraction, export) is under `src/color/`.

See [.doc/architecture.md](.doc/architecture.md) for the data model and build
specifics.

## License

[MIT](LICENSE) © Andrew Owlgrim
