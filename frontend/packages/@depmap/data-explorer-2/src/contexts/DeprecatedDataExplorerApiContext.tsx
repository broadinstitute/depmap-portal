import React, { createContext, useContext, useMemo } from "react";
import { ComputeResponseResult } from "@depmap/compute";
import {
  DataExplorerAnonymousContext,
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
  DataExplorerFilters,
  DataExplorerMetadata,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";

const defaultValue = {
  evaluateLegacyContext: (
    legacyContext: Omit<DataExplorerContext, "name">
  ): Promise<string[]> => {
    window.console.log("evaluateLegacyContext:", { legacyContext });
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

  fetchAnalysisResult: (
    taskId: string
  ): Promise<ComputeResponseResult | null> => {
    window.console.log("fetchAnalysisResult:", { taskId });
    throw new Error("Not implemented");
  },

  fetchAssociations: (
    dataset_id: string,
    slice_label: string
  ): Promise<{
    associatedDatasets: string[];
    datasetLabel: string;
    data: {
      correlation: number;
      other_dataset: string;
      other_entity_label: string;
      other_entity_type: string;
      other_slice_id: string;
    }[];
  }> => {
    window.console.log("fetchAssociations:", { dataset_id, slice_label });
    throw new Error("Not implemented");
  },

  fetchCorrelation: (
    index_type: string,
    dimensions: Record<string, DataExplorerPlotConfigDimension>,
    filters?: DataExplorerFilters,
    use_clustering?: boolean
  ): Promise<DataExplorerPlotResponse> => {
    window.console.log("fetchCorrelation:", {
      index_type,
      dimensions,
      filters,
      use_clustering,
    });
    throw new Error("Not implemented");
  },

  fetchGeneTeaEnrichment: (
    genes: string[],
    limit: number | null
  ): Promise<{
    term: string[];
    synonyms: string[][];
    coincident: string[][];
    fdr: number[];
    matchingGenes: string[][];
    total: number;
  }> => {
    window.console.log("fetchGeneTeaEnrichment:", { genes, limit });
    throw new Error("Not implemented");
  },

  fetchGeneTeaTermContext: (
    term: string,
    genes: string[]
  ): Promise<Record<string, string>> => {
    window.console.log("fetchGeneTeaTermContext:", { term, genes });
    throw new Error("Not implemented");
  },

  fetchLinearRegression: (
    index_type: string,
    dimensions: Record<string, DataExplorerPlotConfigDimension>,
    filters?: DataExplorerFilters,
    metadata?: DataExplorerMetadata
  ): Promise<LinRegInfo[]> => {
    window.console.log("fetchLinearRegression:", {
      index_type,
      dimensions,
      filters,
      metadata,
    });
    throw new Error("Not implemented");
  },

  fetchMetadataColumn: (
    slice_id: string
  ): Promise<{
    slice_id: string;
    label: string;
    indexed_values: Record<string, string>;
  }> => {
    window.console.log("fetchMetadataColumn:", { slice_id });
    throw new Error("Not implemented");
  },

  fetchMetadataSlices: (
    dimension_type: string
  ): Promise<
    Record<
      string,
      {
        name: string;
        valueType: "categorical" | "list_strings";
        isHighCardinality?: boolean;
        isPartialSliceId?: boolean;
        sliceTypeLabel?: string;
      }
    >
  > => {
    window.console.log("fetchMetadataSlices:", { dimension_type });
    throw new Error("Not implemented");
  },

  fetchPlotDimensions: (
    index_type: string,
    dimensions: Record<string, DataExplorerPlotConfigDimension>,
    filters?: DataExplorerFilters,
    metadata?: DataExplorerMetadata
  ): Promise<DataExplorerPlotResponse> => {
    window.console.log("fetchPlotDimensions:", {
      index_type,
      dimensions,
      filters,
      metadata,
    });
    throw new Error("Not implemented");
  },

  fetchWaterfall: (
    index_type: string,
    dimensions: Record<string, DataExplorerPlotConfigDimension>,
    filters?: DataExplorerFilters,
    metadata?: DataExplorerMetadata
  ): Promise<DataExplorerPlotResponse> => {
    window.console.log("fetchWaterfall:", {
      index_type,
      dimensions,
      filters,
      metadata,
    });
    throw new Error("Not implemented");
  },

  fetchContextSummary: (
    context: DataExplorerContext | DataExplorerAnonymousContext
  ): Promise<{
    num_matches: number;
    num_candidates: number;
  }> => {
    window.console.log("fetchContextSummary:", { context });
    throw new Error("Not implemented");
  },

  fetchUniqueValuesOrRange: (
    slice_id: string
  ): Promise<
    | {
        value_type: "categorical";
        unique_values: string[];
      }
    | {
        value_type: "continuous";
        min: number;
        max: number;
      }
  > => {
    window.console.log("fetchUniqueValuesOrRange:", { slice_id });
    throw new Error("Not implemented");
  },
};

type Api = typeof defaultValue;

export type DeprecatedDataExplorerApiResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof Api]: Api[P] extends (...args: any) => any
    ? Awaited<ReturnType<Api[P]>>
    : Api[P];
};

export const DeprecatedDataExplorerApiContext = createContext(defaultValue);

export const useDeprecatedDataExplorerApi = () => {
  return useContext(DeprecatedDataExplorerApiContext);
};

export const DeprecatedDataExplorerApiProvider = (
  props: Partial<typeof defaultValue> & { children: React.ReactNode }
) => {
  const { children, ...otherProps } = props;

  const value = useMemo(() => {
    return { ...defaultValue, ...otherProps };
  }, [otherProps]);

  return (
    <DeprecatedDataExplorerApiContext.Provider value={value}>
      {children}
    </DeprecatedDataExplorerApiContext.Provider>
  );
};
