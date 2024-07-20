/* eslint-disable */
import { PlotHTMLElement, PlotlyCallbacks } from "../models/plotlyPlot";

export const addPlotlyCallbacks = (
  el: PlotHTMLElement,
  callbacks: PlotlyCallbacks
) => {
  for (const key in callbacks) {
    if (Object.prototype.hasOwnProperty.call(callbacks, key)) {
      type PlotyOnParams = Parameters<Plotly.PlotlyHTMLElement["on"]>;
      const event = key as PlotyOnParams[0];
      const callback = callbacks[event] as PlotyOnParams[1];
      el.on(event, callback);
    }
  }
};
