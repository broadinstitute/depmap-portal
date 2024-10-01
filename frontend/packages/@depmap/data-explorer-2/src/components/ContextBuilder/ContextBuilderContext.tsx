import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchMetadataSlices, MetadataSlices } from "../../api";

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
  const [isLoading, setIsLoading] = useState(true);
  const [metadataSlices, setMetadataSlices] = useState<MetadataSlices>({});

  useEffect(() => {
    (async () => {
      if (dimension_type) {
        setIsLoading(true);

        const slices = await fetchMetadataSlices(dimension_type);
        setMetadataSlices(slices);

        setIsLoading(false);
      }
    })();
  }, [dimension_type]);

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
