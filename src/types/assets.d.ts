// SVG files are loaded by esbuild with the `dataurl` loader -> a string URL.
declare module '*.svg' {
  const content: string
  export default content
}
