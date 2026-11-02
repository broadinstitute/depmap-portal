import { DataExplorerPlotConfig } from "@depmap/types";

declare module "./public.json" {
  const value: Record<string, DataExplorerPlotConfig>;
  export default value;
}
