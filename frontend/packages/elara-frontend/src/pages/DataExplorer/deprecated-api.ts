import { isSampleType, pluralize } from "@depmap/data-explorer-2";
import {
  correlationMatrix,
  linregress,
  pearsonr,
  spearmanr,
} from "@depmap/statistics";
import {
  DataExplorerContextV2,
  DataExplorerDatasetDescriptor,
  DataExplorerFilters,
  DataExplorerMetadata,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  FilterKey,
  MatrixDataset,
} from "@depmap/types";
import {
  evaluateContext,
  fetchDatasets,
  fetchDimensionTypes,
  postJson,
} from "src/pages/DataExplorer/api";
import fetchPlotDimensions from "src/pages/DataExplorer/fetchPlotDimensions";

// Historically, all computations happened on the backend and were cached
// according to the corresponding endpoint. Many of those calculations now happen
// on the frontend. This function is used to cache those results.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoize = <T>(computeResponse: (...args: any[]) => Promise<T>) => {
  const cache: Record<string, Promise<T>> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]): Promise<T> => {
    const cacheKey = JSON.stringify(args);

    if (!cache[cacheKey]) {
      cache[cacheKey] = computeResponse(...args);
    }

    return cache[cacheKey] as Promise<T>;
  };
};

export function fetchMetadataSlices() {
  return Promise.resolve({});
}

export const fetchDatasetsByIndexType = memoize(async () => {
  const datasets = await fetchDatasets();
  const datasetsByIndexType = {} as Record<
    string,
    DataExplorerDatasetDescriptor[]
  >;

  datasets.forEach((dataset) => {
    // TODO: add support for tabular datasets
    if (dataset.format !== "matrix_dataset") {
      return;
    }

    // TODO: add support for other value types
    if (dataset.value_type !== "continuous") {
      return;
    }

    // TODO: add support for `null` dimension types
    if (!dataset.sample_type_name || !dataset.feature_type_name) {
      return;
    }

    const {
      data_type,
      id,
      given_id,
      name,
      priority,
      units,
      sample_type_name,
      feature_type_name,
    } = dataset as MatrixDataset;

    const commonProperties = {
      data_type,
      given_id,
      id,
      name,
      priority,
      units,
    };

    datasetsByIndexType![sample_type_name] = [
      ...(datasetsByIndexType![sample_type_name] || []),
      {
        ...commonProperties,
        index_type: sample_type_name,
        slice_type: feature_type_name,
      },
    ];

    datasetsByIndexType![feature_type_name] = [
      ...(datasetsByIndexType![feature_type_name] || []),
      {
        ...commonProperties,
        index_type: feature_type_name,
        slice_type: sample_type_name,
      },
    ];
  });

  return datasetsByIndexType;
});

export const fetchLinearRegression = memoize(
  async (
    index_type: string,
    dimensions: Record<string, DataExplorerPlotConfigDimension>,
    filters?: DataExplorerFilters,
    metadata?: DataExplorerMetadata
  ) => {
    const data = await fetchPlotDimensions(
      index_type,
      dimensions,
      filters,
      metadata
    );

    const xs = data.dimensions.x!.values;
    const ys = data.dimensions.y!.values;
    const visible = data.filters?.visible?.values || xs.map(() => true);
    let categories: (string | number | null)[] = xs.map(() => null);

    if (data.metadata?.color_property) {
      categories = data.metadata.color_property.values;
    }

    if (data.filters?.color1 || data.filters?.color2) {
      const name1 = data.filters?.color1?.name || null;
      const name2 = data.filters?.color2?.name || null;
      const color1 = data.filters?.color1?.values || xs.map(() => false);
      const color2 = data.filters?.color2?.values || xs.map(() => false);

      categories = xs.map((_, i) => {
        if (color1[i] && color2[i]) {
          return `Both (${name1} & ${name2})`;
        }

        if (color1[i] || color2[i]) {
          return color1[i] ? name1 : name2;
        }

        return null;
      });
    }

    const compareNullLast = (
      a: typeof categories[number],
      b: typeof categories[number]
    ) => {
      if (a === b) {
        return 0;
      }

      if (a === null) {
        return 1;
      }

      if (b === null) {
        return -1;
      }

      return a < b ? -1 : 1;
    };

    return [...new Set(categories)].sort(compareNullLast).map((category) => {
      const x: number[] = [];
      const y: number[] = [];

      for (let i = 0; i < xs.length; i += 1) {
        if (
          visible[i] &&
          category === categories[i] &&
          Number.isFinite(xs[i]) &&
          Number.isFinite(ys[i])
        ) {
          x.push(xs[i]);
          y.push(ys[i]);
        }
      }

      const pearson = pearsonr(x, y);
      const spearman = spearmanr(x, y);
      const regression = linregress(x, y);

      return {
        group_label: category as string | null,
        number_of_points: x.length,
        pearson: pearson.statistic,
        spearman: spearman.statistic,
        slope: regression.slope,
        intercept: regression.intercept,
        p_value: regression.pvalue,
      };
    });
  }
);

async function fetchDatasetLabel(dataset_id?: string) {
  if (!dataset_id) {
    return "";
  }

  const datasets = await fetchDatasets();

  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  return dataset ? dataset.name : "(Unknown dataset)";
}

async function fetchEntitiesLabel(dimensionType: string) {
  const dimensionTypes = await fetchDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionType);

  return dimType
    ? pluralize(dimType.display_name || dimType.name)
    : "unknown entities";
}

const correlateDimension = memoize(
  async (
    dimension: DataExplorerPlotConfigDimension,
    index_type: string,
    filter?: DataExplorerContextV2,
    use_clustering?: boolean
  ): Promise<
    [DataExplorerPlotResponse["dimensions"]["x"], string[], string[]]
  > => {
    const { context, dataset_id, slice_type } = dimension;

    const [
      // FIXME: Rework all logic to work in terms of ids instead of labels.
      { ids, labels },
      filterIdentifiers,
      dataset_label,
    ] = await Promise.all([
      evaluateContext((context as unknown) as DataExplorerContextV2),
      filter ? evaluateContext(filter) : null,
      fetchDatasetLabel(dataset_id),
    ]);

    if (labels.length === 0 || labels.length > 100) {
      return [
        ({
          slice_type,
          values: [],
          dataset_label,
          context_size: labels.length,
          axis_label:
            labels.length === 0 ? "context produced no matches" : "cannot plot",
        } as unknown) as DataExplorerPlotResponse["dimensions"]["x"],
        [],
        [],
      ];
    }

    const dimensionTypes = await fetchDimensionTypes();
    const correlate_by = isSampleType(slice_type, dimensionTypes)
      ? "samples"
      : "features";

    const requestParams = {
      sample_identifier: "label",
      feature_identifier: "label",
      samples:
        correlate_by === "samples" ? labels : filterIdentifiers?.labels || null,
      features:
        correlate_by === "features"
          ? labels
          : filterIdentifiers?.labels || null,
    };

    const response = await postJson<{
      [key: string]: Record<string, number>;
    }>(`/datasets/matrix/${dataset_id}/`, requestParams);

    let data = {} as Record<string, number[]>;

    // The /datasets/matrix/<id> endpoint always returns an object where features
    // are the keys. If we're correlating by sample, we want to turn that object
    // "inside out" and make the samples the keys.
    if (correlate_by === "samples") {
      const featureValues = Object.values(response);

      data = Object.fromEntries(
        labels.map((label) => [label, featureValues.map((fv) => fv[label])])
      );
    } else {
      data = Object.fromEntries(
        Object.keys(response).map((key) => [key, Object.values(response[key])])
      );
    }

    const { columns, matrix } = correlationMatrix(data, use_clustering);

    const isAutoNamedContext = context.name.match(/^\(\d+ selected\)/) !== null;
    const entities = await fetchEntitiesLabel(slice_type);

    let axis_label = isAutoNamedContext
      ? `correlation of ${context.name} ${entities}`
      : `correlation of ${labels.length} ${context.name} ${entities}`;

    if (filter && filterIdentifiers) {
      const dName = filter.name;
      const dCount = filterIdentifiers.ids.length;
      const dEntities = await fetchEntitiesLabel(filter.dimension_type);

      if (typeof filter.expr === "boolean") {
        axis_label += `<br>distinguished by all ${dCount} ${dEntities}`;
      } else {
        axis_label += `<br>distinguished by ${dCount} ${dName} ${dEntities}`;
      }
    }

    const outputDimension = {
      dataset_id,
      slice_type,
      axis_label,
      dataset_label,
      // HACK: The correlation heatmap is a special case and breaks the
      // standard dimension type. `matrix` is of type number[][] but we'll
      // cast it to number[] just to keep the types simple. Caution must be
      // taken to cast this back to number[][] when plotting the heatmap.
      values: (matrix as unknown) as number[],
    };

    return [outputDimension, columns, ids];
  }
);

export async function fetchCorrelation(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  // eslint-disable-next-line
  filters?: DataExplorerFilters,
  // eslint-disable-next-line
  use_clustering?: boolean
): Promise<DataExplorerPlotResponse> {
  const [x, xColumns, ids] = await correlateDimension(
    dimensions.x,
    index_type,
    filters?.distinguish1 as DataExplorerContextV2,
    use_clustering
  );

  const [x2] = filters?.distinguish2
    ? await correlateDimension(
        dimensions.x,
        index_type,
        filters?.distinguish2 as DataExplorerContextV2,
        use_clustering
      )
    : [null];

  const isModelCorrelation = dimensions.x.slice_type === "depmap_model";

  return {
    index_type,
    index_labels: isModelCorrelation ? ids : xColumns,
    index_aliases: isModelCorrelation
      ? [
          {
            label: "Cell Line Name",
            slice_id: "slice/cell_line_display_name/all/label",
            values: xColumns,
          },
        ]
      : [],
    dimensions: x2 ? { x, x2 } : { x },
    filters: {},
    metadata: {},
  };
}

export async function fetchWaterfall(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  metadata?: DataExplorerMetadata
): Promise<DataExplorerPlotResponse> {
  const unsortedData = await fetchPlotDimensions(
    index_type,
    dimensions,
    filters,
    metadata
  );

  const categoricalValues = unsortedData.metadata?.color_property?.values;

  const sortedLabels = unsortedData.index_labels
    .map(
      (label, i) =>
        [
          label,
          unsortedData.dimensions.x.values[i],
          categoricalValues?.[i] || null,
        ] as [string, number | null, string | null]
    )
    .sort(([, valueA, categoryA], [, valueB, categoryB]) => {
      if (categoryA !== categoryB) {
        if (categoryA === null) {
          return -1;
        }

        if (categoryB === null) {
          return 1;
        }

        return categoryA.localeCompare(categoryB);
      }

      if (valueA === null) {
        return -1;
      }

      if (valueB === null) {
        return 1;
      }

      return valueA < valueB ? -1 : 1;
    })
    .map((tuple) => tuple[0]);

  const sortByReindexedLabels = <T>(values: T[]) => {
    const indexedValues = Object.fromEntries(
      unsortedData.index_labels.map((label, i) => [label, values[i]])
    );

    return sortedLabels.map((label) => indexedValues[label]);
  };

  const sortedDimensions: DataExplorerPlotResponse["dimensions"] = {
    x: {
      axis_label: categoricalValues ? "" : "Rank",
      dataset_label: "",
      dataset_id: dimensions.x.dataset_id,
      slice_type: dimensions.x.slice_type,
      values: Array.from({ length: sortedLabels.length }, (_, i) => i),
    },

    y: {
      ...unsortedData.dimensions.x,
      values: sortByReindexedLabels(unsortedData.dimensions.x.values),
    },
  };

  // FIXME: Instead of coloring the points as one big group, we could split it
  // into smaller grouper according to how the continuous values get bucketed.
  // The only reason we didn't do that before is because this waterfall
  // implementation used to live on the backend while the buckets were always
  // calculated here on the frontend.
  if (unsortedData.dimensions.color) {
    sortedDimensions.color = {
      ...unsortedData.dimensions.color,
      values: sortByReindexedLabels(unsortedData.dimensions.color.values),
    };
  }

  const sortedIndexAliases =
    index_type === "depmap_model"
      ? [
          {
            label: "Cell Line Name",
            slice_id: "slice/cell_line_display_name/all/label",
            values: sortByReindexedLabels(unsortedData.index_aliases[0].values),
          },
        ]
      : [];

  const sortedFilters: DataExplorerPlotResponse["filters"] = {};
  const sortedMetadata: DataExplorerPlotResponse["metadata"] = {};

  Object.keys(unsortedData.filters || {}).forEach((key) => {
    const unsorted = unsortedData.filters[key as FilterKey]!;

    sortedFilters[key as FilterKey] = {
      ...unsorted,
      values: sortByReindexedLabels(unsorted.values),
    };
  });

  Object.keys(unsortedData.metadata || {}).forEach((key) => {
    const unsorted = unsortedData.metadata[key]!;

    sortedMetadata[key] = {
      ...unsorted,
      values: sortByReindexedLabels(unsorted.values),
    };
  });

  return {
    index_type,
    index_labels: sortedLabels,
    index_aliases: sortedIndexAliases,
    dimensions: sortedDimensions,
    filters: sortedFilters,
    metadata: sortedMetadata,
  };
}
