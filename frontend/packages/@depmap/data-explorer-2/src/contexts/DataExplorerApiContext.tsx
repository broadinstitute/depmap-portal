import React, { createContext, useContext, useMemo } from "react";
import {
  DataExplorerContextV2,
  DataExplorerContextVariable,
  Dataset,
  DimensionType,
} from "@depmap/types";

const defaultValue = {
  evaluateContext: (
    context: Omit<DataExplorerContextV2, "name">
  ): Promise<{ ids: string[]; labels: string[]; num_candidates: number }> => {
    window.console.log("evaluateContext:", { context });
    throw new Error("Not implemented");
  },

  fetchVariableDomain: (
    variable: DataExplorerContextVariable
  ): Promise<
    | {
        value_type: "continuous";
        min: number;
        max: number;
      }
    | {
        value_type: "text" | "categorical" | "list_strings";
        unique_values: string[];
      }
  > => {
    window.console.log("fetchVariableDomain:", { variable });
    throw new Error("Not implemented");
  },

  fetchDatasets: (
    options?: Partial<{
      feature_id: string;
      feature_type: string;
      sample_id: string;
      sample_type: string;
    }>
  ): Promise<Dataset[]> => {
    window.console.log("fetchDatasets:", { options });
    throw new Error("Not implemented");
  },

  fetchDimensionTypes: (): Promise<DimensionType[]> => {
    window.console.log("fetchDimensionTypes()");
    throw new Error("Not implemented");
  },

  fetchDimensionIdentifiers: (
    dimensionTypeName: string,
    dataType?: string
  ): Promise<{ id: string; label: string }[]> => {
    window.console.log("fetchDimensionIdentifiers:", {
      dimensionTypeName,
      dataType,
    });
    throw new Error("Not implemented");
  },

  fetchDatasetIdentifiers: (
    dimensionTypeName: string,
    dataset_id: string
  ): Promise<{ id: string; label: string }[]> => {
    window.console.log("fetchDatasetIdentifiers:", {
      dimensionTypeName,
      dataset_id,
    });
    throw new Error("Not implemented");
  },
};

type Api = typeof defaultValue;

export type DataExplorerApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};

export const DataExplorerApiContext = createContext(defaultValue);

export const useDataExplorerApi = () => {
  return useContext(DataExplorerApiContext);
};

export const DataExplorerApiProvider = (
  props: Partial<typeof defaultValue> & { children: React.ReactNode }
) => {
  const { children, ...otherProps } = props;

  const value = useMemo(() => {
    return { ...defaultValue, ...otherProps };
  }, [otherProps]);

  return (
    <DataExplorerApiContext.Provider value={value}>
      {children}
    </DataExplorerApiContext.Provider>
  );
};
