import type { LegacyPortalApiResponse } from "@depmap/api";

export type DatasetId = "Rep_all_single_pt" | "Prism_oncology_AUC" | "unknown";

// raw data as returned by the server
export type CompoundSummaryTableRaw = LegacyPortalApiResponse["getCompoundDashboardSummaryTable"];

export type CompoundSummaryTableRow = {
  BroadID: string;
  Name: string;
  Target: string;
  TargetOrMechanism: string;
  Dose: number;
  NumberOfSensitiveLines: number;
  BimodalityCoefficient: number;
  ModelType: string;
  PearsonScore: number;
  TopBiomarker: string;
  Synonyms: string;
};

// that raw data with a few extra properties calculated at runtime
export type CompoundSummaryTable = CompoundSummaryTableRaw & {
  hoverText: string[];
};
