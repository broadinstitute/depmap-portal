import { PlotlyHTMLElement } from "plotly.js";

export type Subgroup = "CNS/Brain" | "Heme" | "Solid";

export type ModelDataWithSubgroup = {
  key: string;
  subgroup: Subgroup;
  subtype: string;
  subtypeFeature: string;
};

export type ExtendedPlotType = HTMLDivElement &
  PlotlyHTMLElement & {
    // This is built into Plotly but not documented in its type definitions.
    // eslint-disable-next-line @typescript-eslint/ban-types
    removeListener: (eventName: string, callback: Function) => void;
  };
