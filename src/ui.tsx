import { render } from '@create-figma-plugin/ui'
import { App } from '@/app/App'
// Global CSS (the `!` prefix ships it verbatim instead of as a CSS Module): the
// OverlayScrollbars base stylesheet, then our Figma theme overriding its vars.
import '!overlayscrollbars/styles/overlayscrollbars.css'
import '!./styles/scrollbars.css'

export default render(App)
