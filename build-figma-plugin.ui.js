// Switches the UI bundle from classic JSX (h/Fragment) to the automatic runtime
// so tsx files don't need to manually import { h } from 'preact'.
module.exports = async function (options) {
  const { jsxFactory, jsxFragment, ...rest } = options
  return {
    ...rest,
    jsx: 'automatic',
    jsxImportSource: 'preact',
  }
}
