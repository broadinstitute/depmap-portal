import React, { createContext, useContext, useEffect, useState } from "react";
import {
  DeprecatedDataExplorerApiResponse,
  useDeprecatedDataExplorerApi,
} from "../../contexts/DeprecatedDataExplorerApiContext";

type MetadataSlices = DeprecatedDataExplorerApiResponse["fetchMetadataSlices"];

const ContextBuilderContext = createContext({
  metadataSlices: {} as MetadataSlices,
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
  const api = useDeprecatedDataExplorerApi();
  const [isLoading, setIsLoading] = useState(true);
  const [metadataSlices, setMetadataSlices] = useState<MetadataSlices>({});

  useEffect(() => {
    (async () => {
      if (dimension_type) {
        setIsLoading(true);

        const slices = await api.fetchMetadataSlices(dimension_type);
        setMetadataSlices(slices);

        setIsLoading(false);
      }
    })();
  }, [api, dimension_type]);

  return (
    <ContextBuilderContext.Provider
      value={{
        isLoading,
        metadataSlices,
      }}
    >
      {children}
    </ContextBuilderContext.Provider>
  );
};
