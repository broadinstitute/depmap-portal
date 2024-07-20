// This creates a custom plotly.js bundle to reduce its size.
// See https://github.com/plotly/plotly.js/blob/49ea59f/README.md#modules
import plotlyCore from "plotly.js/lib/core";

// See also the /lib directory for all the modules that can be imported.
// https://github.com/plotly/plotly.js/tree/master/lib
import scattergl from "plotly.js/lib/scattergl";
import violin from "plotly.js/lib/violin";
import groupby from "plotly.js/lib/groupby";

plotlyCore.register([scattergl, violin, groupby]);

export default plotlyCore;
