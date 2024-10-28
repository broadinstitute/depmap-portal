import React, { useState } from "react";
import { ApiContext } from "@depmap/api";
import {
  ContextManager,
  DataExplorerApiProvider,
} from "@depmap/data-explorer-2";
import { VectorCatalogApi } from "@depmap/interactive";
import { ElaraApi } from "src/api";
import { fetchVariableDomain } from "src/pages/DataExplorer/api";

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

  const vectorCatalogApi = new VectorCatalogApi(bbapi);
  const getApi = () => bbapi;
  const getVectorCatalogApi = () => vectorCatalogApi;

  return (
    <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
      <DataExplorerApiProvider fetchVariableDomain={fetchVariableDomain}>
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
