// Plotly's scattergl draws with regl, which compiles shaders into JavaScript
// via `new Function`. Hosts whose CSP forbids `unsafe-eval` (VS Code) make that
// throw, which leaves a blank plot, so we detect it up front.
export function codeGenerationBlocked() {
  try {
    // eslint-disable-next-line no-new-func
    return new Function("return true")() !== true;
  } catch (e) {
    return true;
  }
}
