export type VolcanoPlotData = {
  x: Array<number>;
  y: Array<number>;
  label: Array<string>;
  color: string;
  name: string;
};

export type VolcanoPlotPoint = {
  x: number;
  y: number;
  text: string;
  pointIndex: number;
};
