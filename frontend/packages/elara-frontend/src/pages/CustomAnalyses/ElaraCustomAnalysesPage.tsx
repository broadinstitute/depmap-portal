import * as React from "react";
import { useContext } from "react";
import { renderCellLineSelectorModal } from "@depmap/cell-line-selector";
import { ApiContext } from "@depmap/api";
import { CustomAnalysesPage } from "@depmap/custom-analyses";

const cellLineSelectorContainer = document.getElementById(
  "cell_line_selector_modal"
);

export default function ElaraCustomAnalysesPage() {
  const apiContext = useContext(ApiContext);

  const launchCellLineSelectorModal = () =>
    renderCellLineSelectorModal(
      apiContext.getApi,
      apiContext.getVectorCatalogApi,
      cellLineSelectorContainer
    );

  return (
    <CustomAnalysesPage
      launchCellLineSelectorModal={launchCellLineSelectorModal}
    />
  );
}
