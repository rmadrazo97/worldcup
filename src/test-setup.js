import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement scrollIntoView, used by DateStrip on mount.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
