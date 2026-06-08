import plotlyCore from "plotly.js/lib/core";
import scattergl from "plotly.js/lib/scattergl";
import violin from "plotly.js/lib/violin";
import bar from "plotly.js/lib/bar";

plotlyCore.register([scattergl, violin, bar]);

export default plotlyCore;
