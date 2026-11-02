import * as identifiers from "./identifiers";
import * as variables from "./variables";
import * as labels from "./labels";
import * as standardPlot from "./standardPlot";
import * as expandedPlot from "./expandedPlot";
import * as fetchPlotData from "./fetchPlotData";

export const dataExplorerAPI = {
  ...identifiers,
  ...variables,
  ...labels,
  ...standardPlot,
  ...expandedPlot,
  ...fetchPlotData,
};

export type { DataExplorerExpandBy } from "@depmap/types";

type Api = typeof dataExplorerAPI;

export type DataExplorerApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};
