import React, { useContext } from "react";
import qs from "qs";
import PlotlyLoader from "src/plot/components/PlotlyLoader";
import { ApiContext } from "@depmap/api";
import { InteractivePage } from "@depmap/interactive";
import { getQueryParams } from "@depmap/utils";
import { renderCellLineSelectorModal } from "@depmap/cell-line-selector";

const params = qs.parse(window.location.search.substr(1));
const query: Record<string, string> = {};

Object.entries(params).forEach(([key, value]) => {
  if (typeof value === "string") {
    query[key] = value;
  }
});

const container = document.getElementById("root");
const cellLineSelectorContainer = document.getElementById(
  "cell_line_selector_modal"
);

export default function DataExplorer() {
  const apiContext = useContext(ApiContext);

  const launchCellLineSelectorModal = () =>
    renderCellLineSelectorModal(
      apiContext.getApi,
      apiContext.getVectorCatalogApi,
      cellLineSelectorContainer
    );

  return (
    <PlotlyLoader>
      {(Plotly) => (
        <InteractivePage
          Plotly={Plotly}
          launchCellLineSelectorModal={launchCellLineSelectorModal}
          query={getQueryParams() as { [key: string]: string }}
          showCustomAnalysis
          updateReactLoadStatus={() => {
            if (container) {
              container.setAttribute(
                "data-react-component-loaded-for-selenium",
                "true"
              );
            }
          }}
        />
      )}
    </PlotlyLoader>
  );
}
