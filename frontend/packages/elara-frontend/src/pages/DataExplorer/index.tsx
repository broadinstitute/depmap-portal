import React from "react";
import {
  DataExplorerPage,
  DataExplorerSettingsProvider,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

export default function DataExplorer() {
  return (
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <DataExplorerSettingsProvider>
        <DataExplorerPage
          // FIXME: Read this from the build environment
          feedbackUrl="https://form.asana.com/?k=V7otztH5fkOhtBqkchS48w&d=9513920295503"
          contactEmail="depmap@broadinstitute.org"
          tutorialLink="https://sites.google.com/broadinstitute.org/depmap-de2-tutorial/home"
        />
      </DataExplorerSettingsProvider>
    </PlotlyLoaderProvider>
  );
}
