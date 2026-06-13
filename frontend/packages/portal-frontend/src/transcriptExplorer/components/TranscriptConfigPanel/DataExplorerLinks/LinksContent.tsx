import React from "react";
import {
  DataExplorerContextV2,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { isCompletePlot } from "@depmap/data-explorer-2/src/components/DataExplorerPage/validation";
import useContextResult from "../useContextResult";
import useAvailableTranscriptIds from "../useAvailableTranscriptIds";
import toUnexpandedPlotLink from "./toUnexpandedPlotLink";

interface Props {
  plot: PartialDataExplorerPlotConfig;
  expansionAxis: "x" | "y";
}

function LinksContent({ plot, expansionAxis }: Props) {
  const expansionDim = plot.dimensions?.[expansionAxis];

  const { result, isLoading } = useContextResult(
    expansionDim?.context as DataExplorerContextV2 | undefined
  );

  // Availability: the expansion context resolves against transcript_metadata —
  // every transcript of the gene — but the chosen dataset may not measure all
  // of them. A transcript with no data shows as "(no data)" text instead of a
  // link that would open an empty plot.
  const availableIds = useAvailableTranscriptIds(plot, expansionAxis);

  if (isLoading) {
    return <div>Loading ...</div>;
  }

  if (!isCompletePlot(plot)) {
    return (
      <div>
        Choose a gene and links to individual transcript will appear here.
      </div>
    );
  }

  return (
    <div>
      <p>Click a transcript to see its individual plot in Data Explorer.</p>
      <ul>
        {result &&
          result.ids.map((id, index) => {
            const label = result.labels[index];
            // While the feature list is still loading (availableIds === null)
            // assume available, so links don't flash to "(no data)" and back.
            const hasData = !availableIds || availableIds.has(id);

            return (
              <li key={id}>
                {hasData ? (
                  <a
                    href={toUnexpandedPlotLink(plot, expansionAxis, id, label)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                  </a>
                ) : (
                  <span style={{ color: "#999" }}>{label} (no data)</span>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}

export default LinksContent;
