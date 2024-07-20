export type DatasetId = "Rep_all_single_pt" | "Prism_oncology_AUC" | "unknown";

// raw data as returned by the server
export type CompoundSummaryTableRaw = {
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
};

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
