import { breadboxAPI, cached } from "@depmap/api";
import {
  correlationMatrix,
  linregress,
  pearsonr,
  spearmanr,
} from "@depmap/statistics";
import {
  DataExplorerContextV2,
  DataExplorerContextVariable,
  DataExplorerDatasetDescriptor,
  DataExplorerFilters,
  DataExplorerMetadata,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  DataExplorerPlotResponseDimension,
  Dataset,
  FilterKey,
  isValidSliceQuery,
  MatrixDataset,
  SliceQuery,
} from "@depmap/types";
import { isContextAll } from "../../utils/context";
import { isCompleteDimension, isSampleType, pluralize } from "../../utils/misc";
import { MAX_PLOTTABLE_CATEGORIES } from "../../constants/plotConstants";
import { fetchDatasetIdentifiers } from "./identifiers";
import { getDimensionDataWithoutLabels } from "./helpers";

type VarEqualityExpression = { "==": [{ var: string }, string] };

async function fetchEntitiesLabel(dimensionType: string) {
  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionType);

  return dimType
    ? pluralize(dimType.display_name || dimType.name)
    : "unknown entities";
}

async function fetchAxisLabel(dimension?: DataExplorerPlotConfigDimension) {
  if (!dimension || !isCompleteDimension(dimension)) {
    return "";
  }

  const { context } = dimension;
  const datasets = await cached(breadboxAPI).getDatasets();

  const dataset = datasets.find((d) => {
    return d.id === dimension.dataset_id || d.given_id === dimension.dataset_id;
  });

  const units = dataset && "units" in dataset ? dataset.units : "";

  if (dimension.axis_type === "raw_slice") {
    return `${context.name} ${units}`;
  }

  const { aggregation } = dimension;

  const { ids } = await cached(breadboxAPI).evaluateContext(
    (context as unknown) as DataExplorerContextV2
  );

  const dsIdentifiers = await fetchDatasetIdentifiers(
    dimension.slice_type,
    dimension.dataset_id
  );

  const idsInDataset = new Set(dsIdentifiers.map(({ id }) => id));
  const overlappingIds = ids.filter((id) => idsInDataset.has(id));
  const contextCount = overlappingIds.length.toLocaleString();

  const entities = await fetchEntitiesLabel(dimension.slice_type);

  if (isContextAll(context)) {
    return `${aggregation} ${units} of all ${contextCount} ${entities}`;
  }

  return `${aggregation} ${units} of ${contextCount} ${context.name} ${entities}`;
}

async function fetchValueType(
  dimensionOrSliceQuery?: DataExplorerPlotConfigDimension | SliceQuery
) {
  if (
    !dimensionOrSliceQuery ||
    (!isCompleteDimension(dimensionOrSliceQuery) &&
      !isValidSliceQuery(dimensionOrSliceQuery))
  ) {
    return "continuous";
  }

  const { dataset_id } = dimensionOrSliceQuery;

  const dataset = await cached(breadboxAPI).getDataset(dataset_id);

  if (!dataset) {
    throw new Error(`Unknown dataset "${dataset_id}"`);
  }

  if (dataset.format !== "matrix_dataset") {
    if (isCompleteDimension(dimensionOrSliceQuery)) {
      throw new Error(
        "Dataset is not a matrix! This is not supported for plot dimensions."
      );
    }

    return dataset.columns_metadata[dimensionOrSliceQuery.identifier].col_type;
  }

  return dataset.value_type;
}

async function fetchDatasetLabel(dataset_id?: string) {
  if (!dataset_id) {
    return "";
  }

  const datasets = await cached(breadboxAPI).getDatasets();

  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  return dataset ? dataset.name : "(Unknown dataset)";
}

const isPrimaryMetatadata = (dataset?: Dataset) => {
  if (dataset?.format !== "tabular_dataset") {
    return false;
  }

  return dataset.given_id === `${dataset.index_type_name}_metadata`;
};

function contextVariablesAsMetadata(filters?: DataExplorerFilters) {
  const colorMetadata = {} as DataExplorerMetadata;
  const uniqueVars = new Set<string>();

  for (const filter of Object.values(
    filters || {}
  ) as DataExplorerContextV2[]) {
    Object.values(filter.vars).forEach((variable) => {
      if (
        variable.dataset_id === "depmap_model_metadata" &&
        (variable.identifier === "OncotreeLineage" ||
          variable.identifier === "OncotreePrimaryDisease")
      ) {
        return;
      }

      uniqueVars.add(JSON.stringify(variable));
    });
  }

  [...uniqueVars].forEach((stringVar, i) => {
    colorMetadata[`context_var_${i}`] = JSON.parse(stringVar);
  });

  return colorMetadata;
}

function getExtraMetadata(index_type: string, metadata?: DataExplorerMetadata) {
  const extraMetadata = {} as DataExplorerMetadata;
  // HACK: Always include this info about models so we can show it in hover
  // tips. In the future, we should make it configurable what information is
  // shown there.
  if (index_type === "depmap_model") {
    const color_property = metadata?.color_property as SliceQuery | undefined;

    if (color_property?.identifier !== "OncotreePrimaryDisease") {
      extraMetadata.extra1 = {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "OncotreePrimaryDisease",
      };
    }

    if (color_property?.identifier !== "OncotreeLineage") {
      extraMetadata.extra2 = {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "OncotreeLineage",
      };
    }
  }

  return extraMetadata;
}

export async function fetchPlotDimensions(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  metadata?: DataExplorerMetadata
): Promise<DataExplorerPlotResponse> {
  const extendedMetadata = {
    ...metadata,
    ...contextVariablesAsMetadata(filters),
    ...getExtraMetadata(index_type, metadata),
  };

  // Pre-fetch data we know we'll need below. This only works because
  // postJson() caches the Promises. When we later repeat each fetch with an
  // `await`, we're actually awaiting an inflight promise, effectively making
  // all these requests concurrent.
  cached(breadboxAPI).getDimensionTypes();
  fetchDatasetLabel(dimensions.x?.dataset_id);
  fetchDatasetLabel(dimensions.y?.dataset_id);
  fetchDatasetLabel(dimensions.color?.dataset_id);

  const dimensionKeys = Object.keys(dimensions).filter((key) => {
    return isCompleteDimension(dimensions[key]);
  });

  const filterKeys = Object.keys(filters || {}) as FilterKey[];

  // TODO: Recreate this hack when index_type === 'depmap_model'
  // https://github.com/broadinstitute/depmap-portal/blob/5099618/frontend/packages/portal-frontend/src/data-explorer-2/deprecated-api.ts#L412-L435
  const metadataKeys = Object.keys(extendedMetadata || {});

  // FIXME: We shouldn't be indexing things by label. We should use id instead.
  // This is just to get things working for now.
  const uniqueLabels = new Set<string>();

  // HACK: For now we'll reverse the relationship of id and label for models.
  const cellLineIdMapping = {} as Record<string, string>;

  const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();

  async function fetchRawDimension(key: string) {
    const { context, dataset_id, slice_type } = dimensions[key];

    // FIXME: Remove this when we convert everything to use IDs.
    const idToLabelMapping = await (() => {
      return fetchDatasetIdentifiers(
        index_type,
        dataset_id
      ).then((identifiers) =>
        Object.fromEntries(identifiers.map(({ id, label }) => [id, label]))
      );
    })();

    const [variable, identifier] = (context.expr as VarEqualityExpression)[
      "=="
    ];

    const identifier_type = (() => {
      if (variable.var === "entity_label" && slice_type !== "depmap_model") {
        return isSampleType(slice_type, dimensionTypes)
          ? "sample_label"
          : "feature_label";
      }

      return isSampleType(slice_type, dimensionTypes)
        ? "sample_id"
        : "feature_id";
    })();

    return getDimensionDataWithoutLabels({
      dataset_id,
      identifier,
      identifier_type,
    }).then(({ ids, values }) => {
      const indexed_values: Record<
        string,
        string | string[] | number | null
      > = {};

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        // TODO: Change this to use ids instead of labels.
        const label = idToLabelMapping[id];
        uniqueLabels.add(label);

        if (index_type === "depmap_model") {
          indexed_values[id] = values[i];
          cellLineIdMapping[label] = id;
        } else {
          indexed_values[label] = values[i];
        }
      }

      return {
        property: "dimensions",
        indexed_values,
        key,
      };
    });
  }

  async function fetchAggregatedDimension(key: string) {
    const { aggregation, context, dataset_id, slice_type } = dimensions[key];

    if (aggregation === "first" || aggregation === "correlation") {
      throw new Error(
        `aggregation "${aggregation}" is not supported by Breadbox!`
      );
    }

    const aggregate_by = isSampleType(slice_type, dimensionTypes)
      ? "samples"
      : "features";

    let ids: string[] = [];

    try {
      const result = await cached(breadboxAPI).evaluateContext(
        (context as unknown) as DataExplorerContextV2
      );

      ids = result.ids;
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("dx2_context_eval_failed", { detail: context })
      );
      throw e;
    }

    const index_indentifiers = await fetchDatasetIdentifiers(
      index_type,
      dataset_id
    );

    const response = await cached(breadboxAPI).getMatrixDatasetData(
      dataset_id,
      {
        sample_identifier: "id",
        feature_identifier: "id",
        samples: aggregate_by === "samples" ? ids : null,
        features: aggregate_by === "features" ? ids : null,
        aggregate: { aggregate_by, aggregation },
      }
    );

    const indexed_values = {} as Record<string, number | null>;

    index_indentifiers.forEach(({ id, label }) => {
      uniqueLabels.add(label);

      if (index_type === "depmap_model") {
        indexed_values[id] = response[aggregation][id] ?? null;
        cellLineIdMapping[label] = id;
      } else {
        indexed_values[label] = response[aggregation][id] ?? null;
      }
    });

    return {
      property: "dimensions",
      indexed_values,
      key,
    };
  }

  const responses = await Promise.all([
    ...dimensionKeys.map((key) => {
      return dimensions[key].axis_type === "raw_slice"
        ? fetchRawDimension(key)
        : fetchAggregatedDimension(key);
    }),

    ...filterKeys.map((key) => {
      const filter = (filters![key] as unknown) as DataExplorerContextV2;

      return cached(breadboxAPI)
        .evaluateContext(filter)
        .then((result) => {
          const indexed_values: Record<string, true> = {};

          // TODO: Change this to use ids instead of labels for all types (not
          // just depmap_model)
          for (let i = 0; i < result.labels.length; i++) {
            const label =
              index_type === "depmap_model" ? result.ids[i] : result.labels[i];
            indexed_values[label] = true;
          }

          return {
            property: "filters",
            indexed_values,
            key,
          };
        })
        .catch((e) => {
          window.dispatchEvent(
            new CustomEvent("dx2_context_eval_failed", { detail: filter })
          );
          throw e;
        });
    }),

    ...metadataKeys.map(async (key) => {
      const indexed_values: Record<string, string | null> = {};

      const sliceQuery = extendedMetadata![key] as SliceQuery;
      const data = await getDimensionDataWithoutLabels(sliceQuery);
      let value_type = await fetchValueType(sliceQuery);

      // FIXME: Remove this when we convert everything to use IDs.
      const idToLabelMapping = await (() => {
        return cached(breadboxAPI)
          .getDimensionTypeIdentifiers(index_type)
          .then((identifiers) =>
            Object.fromEntries(identifiers.map(({ id, label }) => [id, label]))
          );
      })();

      const distinct = new Set<unknown>();

      for (let i = 0; i < data.values.length; i += 1) {
        const id = data.ids[i];
        const indexKey =
          index_type === "depmap_model" ? id : idToLabelMapping[id];
        const indexedValue = data.values[i];

        indexed_values[indexKey] = indexedValue;

        if (indexedValue) {
          if (Array.isArray(indexedValue)) {
            indexedValue.forEach((v) => distinct.add(v));
          } else {
            distinct.add(indexedValue);
          }
        }
      }

      if (
        value_type !== "continuous" &&
        key === "color_property" &&
        distinct.size > MAX_PLOTTABLE_CATEGORIES
      ) {
        window.console.error(extendedMetadata![key]);
        throw new Error("Too many distinct categorical values to plot!");
      }

      const isBinaryish =
        distinct.size <= 3 &&
        [...distinct].every((n) => n === 0 || n === 1 || n === 2);

      if (isBinaryish) {
        value_type = "categorical";
      }

      return {
        property: "metadata",
        value_type,
        indexed_values,
        key,
      };
    }),
  ]);

  const index_labels =
    index_type === "depmap_model"
      ? [...uniqueLabels].map((label) => cellLineIdMapping[label])
      : [...uniqueLabels];

  const index_display_labels =
    index_type === "depmap_model" ? [...uniqueLabels] : index_labels;

  return (async () => {
    const out = {
      index_type,
      index_labels,
      index_display_labels,
      linreg_by_group: [],
      dimensions: {} as DataExplorerPlotResponse["dimensions"],
      filters: {} as DataExplorerPlotResponse["filters"],
      metadata: {} as DataExplorerPlotResponse["metadata"],
    };

    const datasets = await cached(breadboxAPI).getDatasets();

    const axisLabels = {
      x: await fetchAxisLabel(dimensions?.x),
      y: await fetchAxisLabel(dimensions?.y),
      color: await fetchAxisLabel(dimensions?.color),
    } as Record<string, string>;

    const valueTypes = {
      x: await fetchValueType(dimensions?.x),
      y: await fetchValueType(dimensions?.y),
      color: await fetchValueType(dimensions?.color),
    } as Record<string, DataExplorerPlotResponseDimension["value_type"]>;

    const datasetLabels = {
      x: dimensions.x ? await fetchDatasetLabel(dimensions.x.dataset_id) : null,

      y: dimensions.y ? await fetchDatasetLabel(dimensions.y.dataset_id) : null,

      color: dimensions.color
        ? await fetchDatasetLabel(dimensions.color.dataset_id)
        : null,
    } as Record<string, string | null>;

    responses.forEach((response) => {
      const { indexed_values, property, key } = response as {
        indexed_values: Record<string, number | null>;
        property: "dimensions" | "filters" | "metadata";
        key: string;
      };

      if (property === "dimensions") {
        let value_type = valueTypes[key];
        const values = out.index_labels.map((label) => {
          return indexed_values[label] ?? null;
        }) as number[];

        if (key === "color") {
          const distinct = new Set(values.filter((v) => v != null));

          const isBinaryish =
            distinct.size <= 3 &&
            [...distinct].every((n) => n === 0 || n === 1 || n === 2);

          if (isBinaryish) {
            value_type = "categorical";
          }
        }

        out.dimensions[key as keyof DataExplorerPlotResponse["dimensions"]] = {
          slice_type: dimensions[key].slice_type,
          dataset_id: dimensions[key].dataset_id,
          axis_label: axisLabels[key],
          dataset_label: datasetLabels[key] as string,
          value_type,
          values,
        };
      }

      if (property === "filters") {
        const boolValues = (indexed_values as unknown) as Record<
          string,
          boolean
        >;

        out.filters[key as FilterKey] = {
          name: filters![key as FilterKey]!.name,
          values: out.index_labels.map((label) => {
            return boolValues[label] ?? false;
          }),
        };
      }

      if (property === "metadata") {
        const sliceQuery = extendedMetadata![
          key
        ] as DataExplorerContextVariable;

        const dataset = datasets.find((d) => {
          return (
            d.id === sliceQuery.dataset_id ||
            d.given_id === sliceQuery.dataset_id
          );
        });

        const units = dataset && "units" in dataset ? dataset.units : undefined;
        const dataset_label =
          dataset && !isPrimaryMetatadata(dataset) ? dataset.name : undefined;

        const value_type = (response as any).value_type;
        const values = out.index_labels.map((label) => {
          return indexed_values[label] ?? null;
        });

        // HACK! I never imagined there would be continuous metadata. We'll
        // fake it too like a color dimension instead.
        if (key === "color_property" && value_type === "continuous") {
          out.dimensions.color = ({
            axis_label: sliceQuery.label || sliceQuery.identifier,
            dataset_id: sliceQuery.dataset_id,
            dataset_label,
            slice_type: null,
            values,
            value_type,
          } as unknown) as DataExplorerPlotResponseDimension;

          return;
        }

        out.metadata[key] = {
          label: sliceQuery.label || sliceQuery.identifier,
          slice_id: "TODO: remove references to slice_id !",
          sliceQuery,
          value_type,
          units,
          dataset_label,
          values,
        };
      }
    });

    return (out as unknown) as DataExplorerPlotResponse;
  })();
}

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

export const fetchDatasetsByIndexType = memoize(async () => {
  const datasets = await cached(breadboxAPI).getDatasets();
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

    // Only supported by DimensionSelectV2.
    if (!dataset.feature_type_name) {
      return;
    }

    // This should never happen
    if (!dataset.sample_type_name) {
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

    if (
      ["categorical", "text"].includes(
        data.dimensions?.color?.value_type as string
      )
    ) {
      categories = data.dimensions.color!.values;
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
      cached(breadboxAPI).evaluateContext(
        (context as unknown) as DataExplorerContextV2
      ),
      filter ? cached(breadboxAPI).evaluateContext(filter) : null,
      fetchDatasetLabel(dataset_id),
    ]);

    if (labels.length === 0 || labels.length > 100) {
      return [
        ({
          slice_type,
          values: [],
          value_type: "continuous",
          dataset_label,
          context_size: labels.length,
          axis_label:
            labels.length === 0 ? "context produced no matches" : "cannot plot",
        } as unknown) as DataExplorerPlotResponse["dimensions"]["x"],
        [],
        [],
      ];
    }

    const dimensionTypes = await cached(breadboxAPI).getDimensionTypes();
    const correlate_by = isSampleType(slice_type, dimensionTypes)
      ? "samples"
      : "features";

    const requestParams = {
      sample_identifier: "label" as const,
      feature_identifier: "label" as const,
      samples:
        correlate_by === "samples" ? labels : filterIdentifiers?.labels || null,
      features:
        correlate_by === "features"
          ? labels
          : filterIdentifiers?.labels || null,
    };

    const response = await cached(breadboxAPI).getMatrixDatasetData(
      dataset_id,
      requestParams
    );
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

    const representedIds: string[] = [];

    Object.keys(data).forEach((key, i) => {
      const values = data[key];
      const distinct = new Set(values);
      if (distinct.size === 1 && [...distinct][0] == null) {
        delete data[key];
      } else {
        representedIds.push(ids[i]);
      }
    });

    const { columns, matrix } = correlationMatrix(data, use_clustering);

    const isAutoNamedContext = context.name.match(/^\(\d+ selected\)/) !== null;
    const entities = await fetchEntitiesLabel(slice_type);

    let axis_label = isAutoNamedContext
      ? `correlation of ${context.name} ${entities}`
      : `correlation of ${columns.length} ${entities} (from context “${context.name}”)`;

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
      // We assume `value_type` is "continuous" because it wouldn't make sense
      // to compute a correlation otherwise.
      // TODO: Add validation for this.
      value_type: "continuous" as const,
      // HACK: The correlation heatmap is a special case and breaks the
      // standard dimension type. `matrix` is of type number[][] but we'll
      // cast it to number[] just to keep the types simple. Caution must be
      // taken to cast this back to number[][] when plotting the heatmap.
      values: (matrix as unknown) as number[],
    };

    return [outputDimension, columns, representedIds];
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
    index_display_labels: xColumns,
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

  let categoricalValues = unsortedData.metadata?.color_property?.values;

  // FIXME: Should we make this easier to work with?
  if (unsortedData.dimensions.color?.value_type === "categorical") {
    categoricalValues = unsortedData.dimensions.color.values;
  }

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
    // HACK: This ouput "x" dimension does not match the input "x" dimension.
    // Rather, it is a special "rank" dimension that's derived from it.
    x: {
      axis_label: categoricalValues ? "" : "Rank",
      dataset_label: "",
      dataset_id: dimensions.x.dataset_id,
      slice_type: dimensions.x.slice_type,
      value_type: "continuous",
      values: Array.from({ length: sortedLabels.length }, (_, i) => i),
    },

    // HACK: We remap the "x" dimension from the plot config onto the y axis.
    // This is for consistency with the density plot, which has a single "x"
    // dimension.
    y: {
      ...unsortedData.dimensions.x,
      values: sortByReindexedLabels(unsortedData.dimensions.x.values),
    },
  };

  // FIXME: Instead of coloring the points as one big group, we could split it
  // into smaller groups according to how the continuous values get bucketed.
  // The only reason we didn't do that before is because this waterfall
  // implementation used to live on the backend while the buckets were always
  // calculated here on the frontend.
  if (unsortedData.dimensions.color) {
    sortedDimensions.color = {
      ...unsortedData.dimensions.color,
      values: sortByReindexedLabels(unsortedData.dimensions.color.values),
    };
  }

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

  const sortedIndexDisplayLabels = sortByReindexedLabels(
    unsortedData.index_display_labels
  );

  return {
    index_type,
    index_labels: sortedLabels,
    index_display_labels: sortedIndexDisplayLabels,
    dimensions: sortedDimensions,
    filters: sortedFilters,
    metadata: sortedMetadata,
  };
}
