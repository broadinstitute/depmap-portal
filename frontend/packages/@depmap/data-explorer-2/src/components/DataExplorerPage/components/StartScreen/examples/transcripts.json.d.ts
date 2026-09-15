import { DataExplorerPlotConfig } from "@depmap/types";

declare module "./transcripts.json" {
  const value: Record<string, DataExplorerPlotConfig>;
  export default value;
}
