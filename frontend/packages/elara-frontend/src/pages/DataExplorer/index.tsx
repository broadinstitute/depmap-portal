import React, { useState } from "react";
import { ApiContext } from "@depmap/api";
import {
  DataExplorerPage,
  DataExplorerSettingsProvider,
  DeprecatedDataExplorerApiProvider,
  PlotlyLoaderProvider,
} from "@depmap/data-explorer-2";
import { ElaraApi } from "src/api";
import PlotlyLoader from "src/plot/components/PlotlyLoader";

export default function DataExplorer() {
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
    <PlotlyLoaderProvider PlotlyLoader={PlotlyLoader}>
      <ApiContext.Provider value={{ getApi, getVectorCatalogApi }}>
        <DeprecatedDataExplorerApiProvider>
          <DataExplorerSettingsProvider>
            <DataExplorerPage
              feedbackUrl="FIXME"
              contactEmail="FIXME"
              tutorialLink="FIXME"
            />
          </DataExplorerSettingsProvider>
        </DeprecatedDataExplorerApiProvider>
      </ApiContext.Provider>
    </PlotlyLoaderProvider>
  );
}
