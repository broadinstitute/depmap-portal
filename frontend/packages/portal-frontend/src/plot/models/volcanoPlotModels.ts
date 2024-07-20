import * as Plotly from "plotly.js";

export interface VolcanoData {
  x: Array<number>;
  y: Array<number>;
  label: Array<string>;
  text: Array<string>;
  isSignificant: Array<boolean>; // this gives the possibility for plotting one thing on the y axis (e.g. p value), and determining significance with another (e.g. q value)
  color?: string | Array<string>;
}

export type OnSelectedLabelChange = (selectedLabel: any) => void;
