import { PlotHTMLElement } from "../models/plotlyPlot";

type PlotlyType = typeof import("plotly.js");

export const downloadImage = (
  Plotly: PlotlyType,
  graphDiv: PlotHTMLElement,
  downloadFilename: string,
  format: "png" | "svg"
) => {
  Plotly.downloadImage(graphDiv, {
    format,
    width: 800, // we can make this configurable later
    height: 600,
    filename: downloadFilename, // plotly will append the format (e.g. png) to the name
  });
};
