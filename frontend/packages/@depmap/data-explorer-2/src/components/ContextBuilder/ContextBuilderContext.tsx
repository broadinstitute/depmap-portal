import React, { createContext, useContext, useEffect, useState } from "react";
import { DataExplorerDatasetDescriptor } from "@depmap/types";
import { dataExplorerAPI } from "../../services/dataExplorerAPI";
import { deprecatedDataExplorerAPI } from "../../services/deprecatedDataExplorerAPI";
import type { DeprecatedDataExplorerApiResponse } from "../../services/deprecatedDataExplorerAPI";

type MetadataSlices = DeprecatedDataExplorerApiResponse["fetchMetadataSlices"];

const ContextBuilderContext = createContext({
  metadataSlices: {} as MetadataSlices,
  datasets: null as DataExplorerDatasetDescriptor[] | null,
  isLoading: false,
});

export const useContextBuilderContext = () => {
  return useContext(ContextBuilderContext);
};

export const ContextBuilderContextProvider = ({
  dimension_type,
  children,
}: {
  dimension_type: string | undefined;
  children: React.ReactNode;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [metadataSlices, setMetadataSlices] = useState<MetadataSlices>({});
  const [datasets, setDatasets] = useState<
    DataExplorerDatasetDescriptor[] | null
  >(null);

  useEffect(() => {
    (async () => {
      if (dimension_type) {
        setIsLoading(true);

        const slices = await deprecatedDataExplorerAPI.fetchMetadataSlices(
          dimension_type
        );
        setMetadataSlices(slices);

        const datasetsByIndexType = await dataExplorerAPI.fetchDatasetsByIndexType();
        const fetchedDatasets = datasetsByIndexType?.[dimension_type] || [];
        setDatasets(fetchedDatasets);

        setIsLoading(false);
      }
    })();
  }, [dimension_type]);

  return (
    <ContextBuilderContext.Provider
      value={{
        isLoading,
        datasets,
        metadataSlices,
      }}
    >
      {children}
    </ContextBuilderContext.Provider>
  );
};
