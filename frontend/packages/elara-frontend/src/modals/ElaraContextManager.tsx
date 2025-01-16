import React, { useState } from "react";
import { ApiContext } from "@depmap/api";
import {
  ContextManager,
  DataExplorerApiProvider,
} from "@depmap/data-explorer-2";
import { ElaraApi } from "src/api";
import {
  evaluateContext,
  fetchVariableDomain,
} from "src/pages/DataExplorer/api";

interface Props {
  onHide: () => void;
}

function ElaraContextManager({ onHide }: Props) {
  let basename = "";
  //  hack for setting urlPrefix when Elara is served behind Depmap portal proxy
  if (window.location.pathname.includes("/breadbox/elara")) {
    basename = window.location.pathname.replace(/\/elara\/.*$/, "");
  }
  const [bbapi] = useState(
    () => new ElaraApi(basename === "" ? "/" : basename)
  );

  const getApi = () => bbapi;
  const getVectorCatalogApi = () => {
    throw new Error("Vector Catalog API is no longer supported!");
  };

  return (
    <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
      <DataExplorerApiProvider
        evaluateContext={evaluateContext}
        fetchVariableDomain={fetchVariableDomain}
      >
        <ContextManager
          onHide={onHide}
          initialContextType="depmap_model"
          useContextBuilderV2
          showHelpText={false}
        />
      </DataExplorerApiProvider>
    </ApiContext.Provider>
  );
}

export default ElaraContextManager;
