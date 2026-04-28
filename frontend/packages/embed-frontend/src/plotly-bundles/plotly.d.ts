declare module "plotly.js/lib/scattergl";
declare module "plotly.js/lib/violin";
declare module "plotly.js/lib/heatmap";
declare module "plotly.js/lib/bar";
declare module "plotly.js/lib/groupby";

declare module "plotly.js/lib/core" {
  import type * as Plotly from "plotly.js";
  const core: typeof Plotly & {
    register: (modules: unknown | unknown[]) => void;
  };
  export default core;
}
