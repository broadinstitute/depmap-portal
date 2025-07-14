import { isCompleteExpression, isSampleType } from "../../utils/misc";
import {
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
  DimensionKey,
  FilterKey,
  PartialDataExplorerPlotConfig,
} from "@depmap/types";
import { isCompletePlot } from "./validation";

type Datasets = Record<string, DataExplorerDatasetDescriptor[]>;

const makeDatasetParser = (dimensionKey: DimensionKey) => (
  partialPlot: PartialDataExplorerPlotConfig,
  dataset_id: string
) => {
  const p = { ...partialPlot };

  p.dimensions = p.dimensions || {};
  p.dimensions[dimensionKey] = p.dimensions[dimensionKey] || {};
  p.dimensions[dimensionKey]!.dataset_id = dataset_id;

  return p;
};

// Passing `xFeature` or `yFeature` exist only for backward compatibility with
// Data Explorer 1. Therefore, the index_type defaults to "depmap_model" (this
// was always the case in Data Explorer 1).
const makeFeatureParser = (dimensionKey: DimensionKey) => (
  partialPlot: PartialDataExplorerPlotConfig,
  feature: string,
  allParams: qs.ParsedQs,
  datasets: Datasets
) => {
  const p = { ...partialPlot };

  const dataset_id = (dimensionKey === "x"
    ? allParams.xDataset
    : allParams.yDataset) as string;

  if (!dataset_id) {
    return partialPlot;
  }

  const dataset = datasets.depmap_model.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  const slice_type = dataset ? dataset.slice_type : "custom";

  p.dimensions = p.dimensions || {};
  p.dimensions[dimensionKey] = p.dimensions[dimensionKey] || {};

  p.dimensions[dimensionKey]!.dataset_id = dataset_id;
  p.dimensions[dimensionKey]!.axis_type = "raw_slice";
  p.dimensions[dimensionKey]!.slice_type = slice_type;
  p.dimensions[dimensionKey]!.aggregation = "first";
  p.dimensions[dimensionKey]!.context = {
    name: feature,
    context_type: slice_type,
    expr: { "==": [{ var: "entity_label" }, feature] } as object,
  };

  return p;
};

const makeSampleParser = (dimensionKey: DimensionKey) => (
  partialPlot: PartialDataExplorerPlotConfig,
  feature: string,
  allParams: qs.ParsedQs,
  datasets: Datasets
) => {
  const p = { ...partialPlot };

  const dataset_id = (dimensionKey === "x"
    ? allParams.xDataset
    : allParams.yDataset) as string;

  if (!dataset_id) {
    return partialPlot;
  }

  let dataset: Datasets[string][number] | undefined;

  Object.keys(datasets).forEach((index_type) => {
    if (isSampleType(index_type)) {
      const matchingDs = datasets[index_type].find((d) => {
        return d.id === dataset_id || d.given_id === dataset_id;
      });

      if (matchingDs) {
        dataset = matchingDs;
      }
    }
  });

  const slice_type = dataset ? dataset.index_type : "custom";

  p.dimensions = p.dimensions || {};
  p.dimensions[dimensionKey] = p.dimensions[dimensionKey] || {};

  p.dimensions[dimensionKey]!.dataset_id = dataset_id;
  p.dimensions[dimensionKey]!.axis_type = "raw_slice";
  p.dimensions[dimensionKey]!.slice_type = slice_type;
  p.dimensions[dimensionKey]!.aggregation = "first";
  p.dimensions[dimensionKey]!.context = {
    name: feature,
    context_type: slice_type,
    expr: { "==": [{ var: "entity_label" }, feature] } as object,
  };

  return p;
};

const isSingleSlice = (context: DataExplorerContext) => {
  const { expr } = context;

  return (
    expr !== null &&
    typeof expr === "object" &&
    "==" in expr &&
    "var" in expr["=="][0] &&
    expr["=="][0].var === "entity_label"
  );
};

const makeContextParser = (dimensionKey: DimensionKey) => (
  partialPlot: PartialDataExplorerPlotConfig,
  encodedContext: string
) => {
  const p = { ...partialPlot };
  let context: DataExplorerContext;

  try {
    context = JSON.parse(decodeURIComponent(encodedContext));
  } catch (e) {
    throw new Error(`Invalid context`);
  }

  if (
    !context.name ||
    !context.context_type ||
    !isCompleteExpression(context.expr)
  ) {
    throw new Error("Invalid context");
  }

  p.dimensions = p.dimensions || {};
  p.dimensions[dimensionKey] = p.dimensions[dimensionKey] || {};

  p.dimensions[dimensionKey]!.slice_type = context.context_type;
  p.dimensions[dimensionKey]!.context = context;

  if (isSingleSlice(context)) {
    p.dimensions[dimensionKey]!.axis_type = "raw_slice";
    p.dimensions[dimensionKey]!.aggregation = "first";
  } else {
    p.dimensions[dimensionKey]!.axis_type = "aggregated_slice";
    // TODO: Allow this default to be overriden.
    p.dimensions[dimensionKey]!.aggregation = "mean";
  }

  return p;
};

const makeFilterParser = (filterKey: FilterKey) => (
  partialPlot: PartialDataExplorerPlotConfig,
  contextOrHash: string
) => {
  const p = { ...partialPlot };

  try {
    const parsed = JSON.parse(decodeURIComponent(contextOrHash));
    p.filters = p.filters || {};
    (p.filters[filterKey] as any) = parsed;
  } catch (e) {
    const hash = contextOrHash.replace("not_", "");
    const negated = contextOrHash.startsWith("not_");

    p.filters = p.filters || {};
    (p.filters[filterKey] as any) = { hash, negated };
  }

  return p;
};

const makeMetadataParser = (metadataKey: string) => (
  partialPlot: PartialDataExplorerPlotConfig,
  slice_id: string
) => {
  const p = { ...partialPlot };

  p.metadata = p.metadata || {};
  p.metadata[metadataKey] = { slice_id };

  return p;
};

const makeRegressionLineParser = () => (
  partialPlot: PartialDataExplorerPlotConfig,
  value: string
) => {
  const p = { ...partialPlot };

  if (value === "true") {
    p.show_regression_line = true;
  }

  return p;
};

const makeColorDatasetParser = () => (
  partialPlot: PartialDataExplorerPlotConfig,
  colorDataset: string,
  allParams: qs.ParsedQs
) => {
  const e = window.encodeURIComponent;
  const colorFeature = allParams.colorFeature as string;

  if (!colorFeature) {
    return {};
  }

  const slice_id = `slice/${e(colorDataset)}/${e(colorFeature)}/label`;

  return makeMetadataParser("color_property")(partialPlot, slice_id);
};

const parsers = {
  xDataset: makeDatasetParser("x"),
  yDataset: makeDatasetParser("y"),

  xFeature: makeFeatureParser("x"),
  yFeature: makeFeatureParser("y"),

  xSample: makeSampleParser("x"),
  ySample: makeSampleParser("y"),

  xContext: makeContextParser("x"),
  yContext: makeContextParser("y"),

  color1: makeFilterParser("color1"),
  color2: makeFilterParser("color2"),
  filter: makeFilterParser("visible"),

  color_property: makeMetadataParser("color_property"),
  regressionLine: makeRegressionLineParser(),

  colorDataset: makeColorDatasetParser(),
};

const parse = (params: qs.ParsedQs, datasets: Datasets) => {
  let plot: PartialDataExplorerPlotConfig | null = null;

  Object.entries(parsers).forEach(([param, parser]) => {
    const value = params[param];

    if (typeof value === "string") {
      plot = parser(plot || {}, value, params, datasets);
    }
  });

  return plot as PartialDataExplorerPlotConfig | null;
};

const inferIndexType = (
  partialPlot: PartialDataExplorerPlotConfig,
  datasets: Datasets
) => {
  const dataset_id = partialPlot.dimensions?.x?.dataset_id;
  const slice_type = partialPlot.dimensions?.x?.slice_type;

  if (!dataset_id || !slice_type) {
    return null;
  }

  if (slice_type === "custom") {
    return "depmap_model";
  }

  const dataset = datasets[slice_type].find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  return dataset?.slice_type || null;
};

const inferPlotType = (partialPlot: PartialDataExplorerPlotConfig) => {
  if (!partialPlot.dimensions) {
    return null;
  }

  return Object.keys(partialPlot.dimensions).length === 1
    ? "density_1d"
    : "scatter";
};

const inferColorBy = (partialPlot: PartialDataExplorerPlotConfig) => {
  if (partialPlot.filters?.color1 || partialPlot.filters?.color2) {
    return "aggregated_slice";
  }

  if (partialPlot.metadata) {
    return "property";
  }

  return null;
};

const inferSortBy = (partialPlot: PartialDataExplorerPlotConfig) => {
  if (partialPlot.metadata) {
    return "mean_values_asc" as PartialDataExplorerPlotConfig["sort_by"];
  }

  return null;
};

const inferOtherProps = (
  plot: PartialDataExplorerPlotConfig | null,
  datasets: Datasets
): PartialDataExplorerPlotConfig | null => {
  if (!plot) {
    return null;
  }

  const index_type = inferIndexType(plot, datasets);
  const plot_type = inferPlotType(plot);
  const color_by = inferColorBy(plot);
  const sort_by = inferSortBy(plot);

  return {
    ...(index_type ? { index_type } : {}),
    ...(plot_type ? { plot_type } : {}),
    ...(color_by ? { color_by } : {}),
    ...(sort_by ? { sort_by } : {}),
    ...plot,
  };
};

export function hasSomeShorthandParams(params: qs.ParsedQs) {
  return Object.keys(params).some((key) => key in parsers);
}

export function omitShorthandParams(params: qs.ParsedQs) {
  const out: qs.ParsedQs = {};

  Object.keys(params).forEach((key) => {
    if (!(key in parsers)) {
      out[key] = params[key];
    }
  });

  return out;
}

// "Shorthand params" contrast with the "p" URL param that encodes an entire
// plot config object as one big, compressed blob of JSON. These shorthand
// params are human-readable and require fewer explicit parameters (at minimum,
// a plot can be derived from just `xDataset` and `xFeature`).
export function parseShorthandParams(params: qs.ParsedQs, datasets: Datasets) {
  let plot = parse(params, datasets);
  plot = inferOtherProps(plot, datasets);

  if (plot === null) {
    return null;
  }

  if (!isCompletePlot(plot)) {
    let message = "Unable to construct a plot from URL params. Problems:\n";

    if (params.yDataset && !params.xDataset) {
      message += "- `yDataset` was specified without an `xDataset` \n";
    }

    if (params.xDataset && !(params.xFeature || params.xContext)) {
      message +=
        "- `xDataset` was specified without a corresponding `xFeature` or `xContext`\n";
    }

    if (params.yDataset && !(params.yFeature || params.yContext)) {
      message +=
        "- `yDataset` was specified without a corresponding `yFeature` or `yContext`\n";
    }

    if (params.xFeature && !params.xDataset) {
      message +=
        "- `xFeature` was specified without a corresponding `xDataset`\n";
    }

    if (params.yFeature && !params.yDataset) {
      message +=
        "- `yFeature` was specified without a corresponding `yDataset`\n";
    }

    if (params.xContext && !params.xDataset) {
      message +=
        "- `xContext` was specified without a corresponding `xDataset`\n";
    }

    if (params.yContext && !params.yDataset) {
      message +=
        "- `yContext` was specified without a corresponding `yDataset`\n";
    }

    if (params.colorDataset && !params.colorFeature) {
      message +=
        "- `colorDataset` was specified without a corresponding `colorFeature`\n";
    }

    throw new Error(message);
  }

  return plot;
}
