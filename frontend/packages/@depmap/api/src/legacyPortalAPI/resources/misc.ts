import { CellLineSelectorLines } from "@depmap/cell-line-selector";
import {
  CeleryTask,
  ComputeResponse,
  UnivariateAssociationsParams,
} from "@depmap/compute";
import {
  CompoundDosePredictiveModelResults,
  ScreenType,
  GenePredictiveModelResults,
} from "@depmap/types";
import { uri } from "../../uriTemplateTag";
import { getJson, postJson } from "../client";

export function getFeedbackUrl() {
  return getJson<string>("/feedbackUrlRoot");
}

export function getTaskStatus(id: string) {
  return getJson<CeleryTask>(uri`/api/task/${id}`);
}

export function getCellLineSelectorLines() {
  return getJson<CellLineSelectorLines>(
    "/partials/data_table/cell_line_selector_lines"
  );
}

export function computeUnivariateAssociations(
  config: UnivariateAssociationsParams
) {
  return postJson<ComputeResponse>(
    "/compute/compute_univariate_associations",
    config
  );
}

export function getCompoundDashboardSummaryTable(datasetId: string) {
  return getJson<{
    BroadID: string[];
    Name: string[];
    PearsonScore: number[];
    BimodalityCoefficient: number[];
    ModelType: string[];
    TopBiomarker: string[];
    NumberOfSensitiveLines: number[];
    Dose: number[];
    Target: string[];
    Synonyms: string[];
    TargetOrMechanism: string[];
  }>(uri`/compound_dashboard/summary_table/${datasetId}`);
}

export function getPredictiveTableGene(entityId: number) {
  return getJson<
    Array<{
      screen: string;
      screenType: ScreenType;
      modelsAndResults: Array<GenePredictiveModelResults>;
    }>
  >(`/gene/api/predictive`, { entityId });
}

export function getPredictiveTableCompound(compoundLabel: string) {
  return getJson<
    Array<{
      screen: string;
      compoundExperimentId: string;
      modelsAndResults: Array<CompoundDosePredictiveModelResults>;
    }>
  >(`/compound/api/predictive`, {
    compoundLabel,
  });
}

type GeneCharacterizationData = {
  dataset: string;
  display_name: string;
  id: string;
  sublineage_plot: {
    ajax_url: string;
    download_url: string;
    interactive_url: string;
    name: string;
  };
}[];

export function getGeneCharacterizationData(geneSymbol: string) {
  return getJson<GeneCharacterizationData>(
    uri`/gene/gene_characterization_data/${geneSymbol}`
  );
}

export function getMorpheusUrl(csvUrl: string) {
  return getJson<string>("/morpheusUrl", { csv_url: csvUrl });
}
