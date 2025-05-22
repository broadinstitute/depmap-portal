export type Subgroup = "CNS/Brain" | "Heme" | "Solid";

export type BarSubplotData = {
  xAxisLabels: string[];
  labels: string[];
  values: number[];
  name: Subgroup;
  color: string;
  lineColor: string;
};

export type SubgroupSubtypes = {
  [key in Subgroup]: string[];
};
