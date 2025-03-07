import React, { useState } from "react";
import { ApiContext } from "@depmap/api";
import {
  ContextManager,
  DataExplorerApiProvider,
} from "@depmap/data-explorer-2";
import { ElaraApi } from "src/api";
import {
  evaluateContext,
  fetchDatasets,
  fetchDatasetIdentifiers,
  fetchDimensionIdentifiers,
  fetchDimensionTypes,
  fetchVariableDomain,
} from "src/pages/DataExplorer/api";

interface Props {
  onHide: () => void;
  initialContextType?: string;
}

function ElaraContextManager({
  onHide,
  initialContextType = undefined,
}: Props) {
  let basename = "";
  //  hack for setting urlPrefix when Elara is served behind Depmap portal proxy
  if (window.location.pathname.includes("/breadbox/elara")) {
    basename = window.location.pathname.replace(/\/elara\/.*$/, "");
  }
  const [bbapi] = useState(
    () => new ElaraApi(basename === "" ? "/" : basename)
  );

  const getApi = () => bbapi;

  return (
    <ApiContext.Provider value={{ getApi }}>
      <DataExplorerApiProvider
        evaluateContext={evaluateContext}
        fetchVariableDomain={fetchVariableDomain}
        fetchDatasets={fetchDatasets}
        fetchDimensionTypes={fetchDimensionTypes}
        fetchDatasetIdentifiers={fetchDatasetIdentifiers}
        fetchDimensionIdentifiers={fetchDimensionIdentifiers}
      >
        <ContextManager
          onHide={onHide}
          initialContextType={initialContextType}
          useContextBuilderV2
          showHelpText={false}
        />
      </DataExplorerApiProvider>
    </ApiContext.Provider>
  );
}

export default ElaraContextManager;
