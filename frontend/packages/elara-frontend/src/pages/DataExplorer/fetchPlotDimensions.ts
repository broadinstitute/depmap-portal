import {
  isCompleteDimension,
  isSampleType,
  pluralize,
} from "@depmap/data-explorer-2";
import {
  DataExplorerContextV2,
  DataExplorerFilters,
  DataExplorerMetadata,
  DataExplorerPlotConfigDimension,
  DataExplorerPlotResponse,
  FilterKey,
  SliceQuery,
} from "@depmap/types";
import {
  evaluateContext,
  fetchDatasetIdentifiers,
  fetchDatasets,
  fetchDimensionTypes,
  postJson,
} from "src/pages/DataExplorer/api";

type VarEqualityExpression = { "==": [{ var: string }, string | number] };

async function fetchEntitiesLabel(dimensionType: string) {
  const dimensionTypes = await fetchDimensionTypes();
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
  const datasets = await fetchDatasets();

  const dataset = datasets.find((d) => {
    return d.id === dimension.dataset_id || d.given_id === dimension.dataset_id;
  });

  const units = dataset && "units" in dataset ? dataset.units : "";

  if (dimension.axis_type === "raw_slice") {
    return `${context.name} ${units}`;
  }

  const { aggregation } = dimension;

  const { ids } = await evaluateContext(
    (context as unknown) as DataExplorerContextV2
  );

  const dsIdentifiers = await fetchDatasetIdentifiers(
    dimension.slice_type,
    dimension.dataset_id
  );

  const idsInDataset = new Set(dsIdentifiers.map(({ id }) => id));
  const overlappingIds = ids.filter((id) => idsInDataset.has(id));
  const contextCount = overlappingIds.length;

  const entities = await fetchEntitiesLabel(dimension.slice_type);

  return `${aggregation} ${units} of ${contextCount} ${context.name} ${entities}`;
}

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

async function fetchPlotDimensions(
  index_type: string,
  dimensions: Record<string, DataExplorerPlotConfigDimension>,
  filters?: DataExplorerFilters,
  metadata?: DataExplorerMetadata
): Promise<DataExplorerPlotResponse> {
  // Pre-fetch data we know we'll need below. This only works because
  // postJson() caches the Promises. When we later repeat each fetch with an
  // `await`, we're actually awaiting an inflight promise, effectively making
  // all these requests concurrent.
  fetchDimensionTypes();
  fetchDatasetLabel(dimensions.x?.dataset_id);
  fetchDatasetLabel(dimensions.y?.dataset_id);
  fetchDatasetLabel(dimensions.color?.dataset_id);

  const dimensionKeys = Object.keys(dimensions).filter((key) => {
    return isCompleteDimension(dimensions[key]);
  });

  const filterKeys = Object.keys(filters || {}) as FilterKey[];

  // TODO: Recreate this hack when index_type === 'depmap_model'
  // https://github.com/broadinstitute/depmap-portal/blob/5099618/frontend/packages/portal-frontend/src/data-explorer-2/deprecated-api.ts#L412-L435
  const metadataKeys = Object.keys(metadata || {});

  // FIXME: We shouldn't be indexing things by label. We should use id instead.
  // This is just to get things working for now.
  const uniqueLabels = new Set<string>();

  // HACK: For now we'll use this to suppor the legacy index_aliases property.
  const cellLineIdMapping = {} as Record<string, string>;

  const dimensionTypes = await fetchDimensionTypes();

  function fetchRawDimension(key: string) {
    const { context, dataset_id, slice_type } = dimensions[key];
    const identifier = (context.expr as VarEqualityExpression)["=="][1];

    const identifier_type = isSampleType(slice_type, dimensionTypes)
      ? "sample_id"
      : "feature_id";

    return postJson<{
      ids: string[];
      labels: string[];
      values: (string | string[] | number | null)[];
    }>("/datasets/dimension/data/", {
      dataset_id,
      identifier,
      identifier_type,
    }).then(({ ids, labels, values }) => {
      const indexed_values: Record<
        string,
        string | string[] | number | null
      > = {};

      // TODO: Change this to use ids instead of labels.
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const id = ids[i];
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

    const aggregate_by = isSampleType(slice_type, dimensionTypes)
      ? "samples"
      : "features";

    const { ids } = await evaluateContext(
      (context as unknown) as DataExplorerContextV2
    );

    const index_indentifiers = await fetchDatasetIdentifiers(
      index_type,
      dataset_id
    );

    const response = await postJson<{
      [key: string]: Record<string, number>;
    }>(`/datasets/matrix/${dataset_id}/`, {
      sample_identifier: "id",
      feature_identifier: "id",
      samples: aggregate_by === "samples" ? ids : null,
      features: aggregate_by === "features" ? ids : null,
      aggregate: { aggregate_by, aggregation },
    });

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

      return evaluateContext(filter).then((result) => {
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
      });
    }),

    ...metadataKeys.map(async (key) => {
      const indexed_values: Record<string, string | null> = {};

      const data = await postJson<{
        ids: string[];
        labels: string[];
        values: (string | null)[];
      }>("/datasets/dimension/data/", metadata![key]);

      if (!("values" in data)) {
        window.console.error({
          sliceQuery: metadata![key],
          response: data,
        });
        throw new Error(
          "Bad response from /datasets/dimension/data/. Contains no `values!`"
        );
      }

      const indexProp = index_type === "depmap_model" ? "ids" : "labels";
      const uniqueValues = new Set<string>();

      for (let i = 0; i < data.values.length; i += 1) {
        const label = data[indexProp][i];
        const value = data.values[i];

        indexed_values[label] = value;

        if (value) {
          uniqueValues.add(value);
        }
      }

      if (uniqueValues.size > 100) {
        window.console.error(metadata![key]);
        throw new Error("Too many distinct categorical values to plot!");
      }

      return {
        property: "metadata",
        indexed_values,
        key,
      };
    }),
  ]);

  const index_labels =
    index_type === "depmap_model"
      ? [...uniqueLabels].map((label) => cellLineIdMapping[label])
      : [...uniqueLabels];

  const index_aliases =
    index_type === "depmap_model"
      ? [
          {
            label: "Cell Line Name",
            slice_id: "slice/cell_line_display_name/all/label",
            values: [...uniqueLabels],
          },
        ]
      : [];

  return (async () => {
    const out = {
      index_type,
      index_labels,
      index_aliases,
      linreg_by_group: [],
      dimensions: {} as Record<string, unknown>,
      filters: {} as Record<string, unknown>,
      metadata: {} as Record<string, unknown>,
    };

    const axisLabels = {
      x: await fetchAxisLabel(dimensions?.x),
      y: await fetchAxisLabel(dimensions?.y),
      color: await fetchAxisLabel(dimensions?.color),
    } as Record<string, string>;

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
        out.dimensions[key] = {
          slice_type: dimensions[key].slice_type,
          dataset_id: dimensions[key].dataset_id,
          axis_label: axisLabels[key],
          dataset_label: datasetLabels[key],
          values: out.index_labels.map((label) => {
            return indexed_values[label] ?? null;
          }),
        };
      }

      if (property === "filters") {
        out.filters[key] = {
          name: filters![key as FilterKey]!.name,
          values: out.index_labels.map((label) => {
            return indexed_values[label] ?? false;
          }),
        };
      }
      if (property === "metadata") {
        out.metadata[key] = {
          label: (metadata![key] as SliceQuery).identifier,
          slice_id: "TODO: remove references to slice_id !",
          values: out.index_labels.map((label) => {
            return indexed_values[label] ?? null;
          }),
        };
      }
    });

    return (out as unknown) as DataExplorerPlotResponse;
  })();
}

export default fetchPlotDimensions;
