import { DataExplorerPlotConfig } from "@depmap/types";

interface AxisArgs {
  dimType: string;
  datasetId: string;
  featureGivenId: string;
  featureLabel: string;
}

function buildAxisDimension({
  dimType,
  datasetId,
  featureGivenId,
  featureLabel,
}: AxisArgs) {
  return {
    axis_type: "raw_slice" as const,
    slice_type: dimType,
    dataset_id: datasetId,
    aggregation: "first" as const,
    context: {
      name: featureLabel,
      dimension_type: dimType,
      expr: { "==": [{ var: "given_id" }, featureGivenId] },
      vars: {},
    },
  };
}

function buildTwoAxisScatterPlotConfig(
  x: AxisArgs,
  y: AxisArgs
): DataExplorerPlotConfig {
  return {
    plot_type: "scatter",
    // index_type is the dimension each *point* represents (models/cell
    // lines), not the pinned features' dimension type (dimType, e.g.
    // "gene") — that's `slice_type` on each axis below.
    index_type: "depmap_model",
    dimensions: {
      x: buildAxisDimension(x),
      y: buildAxisDimension(y),
    },
  };
}

interface ModelPredictionsArgs {
  dimType: string;
  actualsDatasetId: string;
  actualsFeatureGivenId: string;
  actualsFeatureLabel: string;
  predictionsDatasetId: string;
  predictionsFeatureGivenId: string;
  predictionsFeatureLabel: string;
}

export function buildModelPredictionsPlotConfig({
  dimType,
  actualsDatasetId,
  actualsFeatureGivenId,
  actualsFeatureLabel,
  predictionsDatasetId,
  predictionsFeatureGivenId,
  predictionsFeatureLabel,
}: ModelPredictionsArgs): DataExplorerPlotConfig {
  return buildTwoAxisScatterPlotConfig(
    {
      dimType,
      datasetId: actualsDatasetId,
      featureGivenId: actualsFeatureGivenId,
      featureLabel: actualsFeatureLabel,
    },
    {
      dimType,
      datasetId: predictionsDatasetId,
      featureGivenId: predictionsFeatureGivenId,
      featureLabel: predictionsFeatureLabel,
    }
  );
}

interface FeatureVsGeneEffectArgs {
  dimType: string;
  featureDatasetId: string;
  featureGivenId: string;
  featureLabel: string;
  actualsDatasetId: string;
  actualsFeatureGivenId: string;
  actualsFeatureLabel: string;
}

export function buildFeatureVsGeneEffectPlotConfig({
  dimType,
  featureDatasetId,
  featureGivenId,
  featureLabel,
  actualsDatasetId,
  actualsFeatureGivenId,
  actualsFeatureLabel,
}: FeatureVsGeneEffectArgs): DataExplorerPlotConfig {
  return buildTwoAxisScatterPlotConfig(
    {
      dimType,
      datasetId: featureDatasetId,
      featureGivenId,
      featureLabel,
    },
    {
      dimType,
      datasetId: actualsDatasetId,
      featureGivenId: actualsFeatureGivenId,
      featureLabel: actualsFeatureLabel,
    }
  );
}
