import React from "react";
import ReactDOM from "react-dom";
import { ApiContext, ApiContextInterface } from "@depmap/api";

const CellLineSelectorModal = React.lazy(
  () =>
    import(
      /* webpackChunkName: "CellLineSelector" */
      "../components/CellLineSelector"
    )
);

const getVectorCatalogApi = () => {
  throw new Error("Vector Catalog API is no longer supported!");
};

export default function renderCellLineSelectorModal(
  getApi: ApiContextInterface["getApi"],
  container: HTMLElement | null
) {
  if (!container) {
    throw new Error(
      "Could not launch Cell Line Selector modal: " +
        'no element with id "cell_line_selector_modal"'
    );
  }

  const dapi = getApi();

  // Unmount a previous instance if any (otherwise this is a no-op).
  ReactDOM.unmountComponentAtNode(container);

  ReactDOM.render(
    <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
      <React.Suspense fallback={null}>
        <CellLineSelectorModal
          getCellLineSelectorLines={() => dapi.getCellLineSelectorLines()}
          getCellLineUrlRoot={() => dapi.getCellLineUrlRoot()}
          getCellignerColors={() => dapi.getCellignerColorMap()}
          getFeedbackUrl={() => dapi.getFeedbackUrl()}
        />
      </React.Suspense>
    </ApiContext.Provider>,
    container
  );
}

export function renderCellLineSelectorModalUsingBBApi(
  getApi: ApiContextInterface["getApi"],
  container: HTMLElement | null
) {
  if (!container) {
    throw new Error(
      "Could not launch Cell Line Selector modal: " +
        'no element with id "cell_line_selector_modal"'
    );
  }

  const bbapi = getApi();

  // Unmount a previous instance if any (otherwise this is a no-op).
  ReactDOM.unmountComponentAtNode(container);

  ReactDOM.render(
    <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
      <React.Suspense fallback={null}>
        <CellLineSelectorModal
          getCellLineSelectorLines={() => bbapi.getCellLineSelectorLines()}
          getCellLineUrlRoot={() => bbapi.getCellLineUrlRoot()}
          getCellignerColors={() => bbapi.getCellignerColorMap()}
          getFeedbackUrl={() => bbapi.getFeedbackUrl()}
        />
      </React.Suspense>
    </ApiContext.Provider>,
    container
  );
}
