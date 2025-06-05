import { TopFeatureValue } from "@depmap/types";
import { postMultipart } from "../client";

type Node = {
  id: string;
  feature: string;
  task?: string; // optional for now until confirm constellation upload doesn't break
  x: number;
  y: number;
  effect: number;
  "-log10(P)": number;
  gene_sets: Array<string>;
  should_label: boolean;
};

type Edge = { from: string; to: string; weight: number };

type GenesetSummary = {
  n: Array<number>;
  neg_log_p: Array<number>;
  p_value: Array<number>;
  rank: Array<number>;
  term: Array<string>;
  term_short: Array<string>;
  type: Array<string>;
  genes: Array<Array<string>>;
  x: Array<number>;
  y: Array<number>;
};

type ConstellationGraphInputs = {
  network: {
    nodes: Array<Node>;
    edges: Array<Edge>;
  };
  overrepresentation: {
    gene_sets_down: GenesetSummary;
    gene_sets_up: GenesetSummary;
  };
  table: Array<{
    effect: number;
    "-log10(P)": number;
    feature: string;
  }>;
};

export function getConstellationGraphs(
  resultId: string,
  uploadFile: File | null,
  similarityMeasure: string,
  nFeatures: number,
  connectivity: 1 | 2 | 3,
  topSelectedFeature: TopFeatureValue
) {
  return postMultipart<ConstellationGraphInputs>(`/constellation/graph`, {
    resultId,
    uploadFile,
    similarityMeasure,
    nFeatures,
    connectivity,
    topSelectedFeature,
  });
}
