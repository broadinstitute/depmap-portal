// This creates a custom plotly.js bundle to reduce its size.
// See https://github.com/plotly/plotly.js/blob/49ea59f/README.md#modules
import plotlyCore from "plotly.js/lib/core";

// See also the /lib directory for all the modules that can be imported.
// https://github.com/plotly/plotly.js/tree/master/lib
import scattergl from "plotly.js/lib/scattergl";

import box from "plotly.js/lib/box";
import bar from "plotly.js/lib/bar";
// import histogram from 'plotly.js/lib/histogram';
// import scatter from 'plotly.js/lib/scatter';
import violin from "plotly.js/lib/violin";
import heatmap from "plotly.js/lib/heatmap";

plotlyCore.register([scattergl, violin, heatmap, box, bar]);

export default plotlyCore;
