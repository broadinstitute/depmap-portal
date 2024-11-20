import React, { createContext, useContext, useMemo } from "react";
import {
  DataExplorerContext,
  DataExplorerContextV2,
  DataExplorerContextVariable,
  DataExplorerDatasetDescriptor,
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

  evaluateLegacyContext: (
    legacyContext: Omit<DataExplorerContext, "name">
  ): Promise<string[]> => {
    window.console.log("evaluateLegacyContext:", { legacyContext });
    throw new Error("Not implemented");
  },

  fetchVariableDomain: (
    variable: DataExplorerContextVariable
  ): Promise<
    | {
        value_type: "binary";
      }
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

  fetchDatasetDetails: (
    dataset_id: string
  ): Promise<{
    file: {
      downloadUrl: string;
      fileDescription: string;
      fileName: string;
      retractionOverride: string;
      sources: string[];
      summaryStats: { label: string; value: number }[];
      taigaUrl: string;
      terms: string;
    };
    release: { releaseName: string };
    termsDefinitions: Record<string, string>;
  }> => {
    window.console.log("fetchDatasetDetails:", { dataset_id });
    throw new Error("Not implemented");
  },

  fetchDatasetsByIndexType: (): Promise<
    Record<string, DataExplorerDatasetDescriptor[]>
  > => {
    window.console.log("fetchDatasetsByIndexType()");
    throw new Error("Not implemented");
  },

  fetchDimensionLabelsToDatasetsMapping: (
    dimension_type: string
  ): Promise<{
    dataset_ids: string[];
    dataset_labels: string[];
    units: Record<string, number[]>;
    data_types: Record<string, number[]>;
    dimension_labels: Record<string, number[]>;
    aliases: {
      label: string;
      slice_id: string;
      values: string[];
    }[];
  }> => {
    window.console.log("fetchDimensionLabelsToDatasetsMapping:", {
      dimension_type,
    });
    throw new Error("Not implemented");
  },

  // This is only used by DimensionSelect to show a special UI for the
  // "compound_experiment" dimension type. After migrating everything to
  // Breadbox, that feature type will be phased out and we can remove this.
  fetchDatasetsMatchingContextIncludingEntities: (
    legacyContext: Omit<DataExplorerContext, "name">
  ): Promise<
    {
      dataset_id: string;
      dataset_label: string;
      dimension_labels: string[];
    }[]
  > => {
    window.console.log("fetchDatasetsMatchingContextIncludingEntities:", {
      legacyContext,
    });
    throw new Error("Not implemented");
  },

  fetchDimensionLabels: (
    dimension_type: string
  ): Promise<{
    labels: string[];
    aliases: {
      label: string;
      slice_id: string;
      values: string[];
    }[];
  }> => {
    window.console.log("fetchDimensionLabels:", { dimension_type });
    throw new Error("Not implemented");
  },

  fetchDimensionLabelsOfDataset: (
    dimension_type: string | null,
    dataset_id: string
  ): Promise<{
    labels: string[];
    aliases: {
      label: string;
      slice_id: string;
      values: string[];
    }[];
  }> => {
    window.console.log("fetchDimensionLabelsOfDataset:", {
      dimension_type,
      dataset_id,
    });
    throw new Error("Not implemented");
  },

  fetchDatasets: (): Promise<Dataset[]> => {
    window.console.log("fetchDatasets()");
    throw new Error("Not implemented");
  },

  fetchDimensionTypes: (): Promise<DimensionType[]> => {
    window.console.log("fetchDimensionTypes()");
    throw new Error("Not implemented");
  },

  fetchDimensionIdentifiers: (
    dimensionTypeName: string
  ): Promise<{ id: string; label: string }[]> => {
    window.console.log("fetchDimensionIdentifiers:", { dimensionTypeName });
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
