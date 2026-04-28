import plotlyCore from "plotly.js/lib/core";
import scattergl from "plotly.js/lib/scattergl";
import violin from "plotly.js/lib/violin";

plotlyCore.register([scattergl, violin]);

export default plotlyCore;
