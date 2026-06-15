// Fallback declaration for CSS-module imports. The build tool generates exact
// `*.css.d.ts` typings next to each file (which take precedence); this keeps a
// standalone `tsc` happy before the first build and for the `!`-prefixed global
// CSS imports the create-figma-plugin build tool understands.
declare module '*.css' {
  const styles: { readonly [className: string]: string }
  export default styles
}
