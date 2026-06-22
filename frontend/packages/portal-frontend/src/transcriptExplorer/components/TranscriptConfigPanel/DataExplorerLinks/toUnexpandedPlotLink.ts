import omit from "lodash.omit";
import { toPortalLink } from "@depmap/globals";
import { DataExplorerPlotConfig } from "@depmap/types";

function toUnexpandedPlotLink(
  plot: DataExplorerPlotConfig,
  expansionAxis: "x" | "y",
  transcriptId: string,
  transcriptLabel: string
) {
  let nextPlot = omit(plot, "expand_by", "group_by");

  if (nextPlot.color_by === "expansion") {
    nextPlot = omit(nextPlot, "color_by");
  }

  nextPlot.dimensions = (() => {
    const out: DataExplorerPlotConfig["dimensions"] = {};

    for (const [key, dim] of Object.entries(plot.dimensions)) {
      let nextDim = dim;

      if (key === expansionAxis) {
        nextDim = {
          ...nextDim,
          axis_type: "raw_slice",
          aggregation: "first",
          context: {
            name: transcriptLabel,
            dimension_type: "transcript",
            expr: { "==": [{ var: "given_id" }, transcriptId] },
            vars: {},
          },
        };
      }

      out[key as "x" | "y"] = nextDim;
    }

    return out;
  })();

  const json = JSON.stringify(nextPlot);
  const base64 = btoa(json);

  return toPortalLink(`/data_explorer_2?plot=${base64}`);
}

export default toUnexpandedPlotLink;
