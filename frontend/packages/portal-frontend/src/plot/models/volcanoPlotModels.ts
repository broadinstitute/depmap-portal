import * as Plotly from "plotly.js";

export interface VolcanoData {
  x: Array<number>;
  y: Array<number>;
  text: Array<string>;
  isSignificant: Array<boolean>; // this gives the possibility for plotting one thing on the y axis (e.g. p value), and determining significance with another (e.g. q value)
  color?: string | Array<string>;
  name?: string;
  // customdata?: Array<any>; // Used for filtering and to get individual trace point's data
  label: Array<string>; // This is only used in CelfiePage and ultimately is only used to set customdata in plotly trace. Keep for backwards compatibility
}

export type OnSelectedLabelChange = (selectedLabel: any) => void;
