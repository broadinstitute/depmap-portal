export enum ReleaseType {
  all_releases = "All",
  depmap_release = "DepMap Releases (CRISPR + Omics)",
  rnai = "RNAi Screens",
  drug = "Drug Screens",
  other_omics = "Other Omics",
  other_crispr = "Other CRISPR Screens",
  other = "Other",
}

// This ViewMode can go away once we've fully transitioned from AllDownloads.tsx to
// DataPage.tsx.
export enum ViewMode {
  topDownloads = "topDownloads",
  customDownloads = "customDownloads",
  allDownloads = "allDownloads",
}
export enum FileType {
  genetic_dependency = "Genetic Dependency",
  drug_sensitivity = "Drug Sensitivity",
  omics = "Cellular Models",
  other = "Other",
}

// For categorization on the new DataPage.tsx's "Current Release" tab. FileSubType is determined
// from the sub_type download yaml field.
export enum FileSubType {
  model_conditions_mapping = "Model, Conditions, and Mapping",
  crispr_screen = "CRISPR Screen",
  drug_screen = "Drug Screen",
  copy_number = "Copy Number",
  mutations = "Mutations",
  expression = "Expression",
  fusions = "Fusions",
  global_genomic_features = "Global Genomic Features",
  read_me = "READ ME",
}

export enum FileSource {
  broad = "Broad Institute",
  csoft = "Broad Institute, Chemical Biology & Therapeutics Science Program",
  novartis = "Novartis",
  marcotte = "Marcotte et al.",
  sanger = "Wellcome Trust Sanger Institute",
}

export interface Downloads {
  table: DownloadTableData;

  releaseData: Array<Release>;

  currentRelease: DownloadTableData;

  fileType: Array<FileType>;

  fileSubTypes: FileSubType[];

  releaseType: Array<ReleaseType>;

  source: Array<FileSource>;

  dataUsageUrl: string;
}

export interface DownloadFile {
  fileName: string;
  fileType: FileType;
  fileSubType: FileSubType;
  fileDescription: string;
  downloadUrl: string;
  taigaUrl: string;
  releaseName: string;
  size: string;
  sources: Array<FileSource>;
  summaryStats?: SummaryStats;
  terms: string;
  retractionOverride: string;
  isMainFile: boolean;

  date?: string;

  logos?: Array<{
    src: string;
    alt: string;
  }>;
}

export type DownloadTableData = Array<DownloadFile>;

export interface ExportMergedDataQuery {
  datasetIds: string[];
  featureLabels?: string[];
  cellLineIds?: string[];
  dropEmpty: boolean;
  addCellLineMetadata: boolean;
}

export interface ExportDataQuery {
  datasetId: string;
  featureLabels?: string[];
  cellLineIds?: string[];
  dropEmpty: boolean;
  addCellLineMetadata: boolean;
}

export interface ExportMutationTableQuery {
  featureLabels?: string[];
  cellLineIds?: string[];
}

export interface DownloadsListQuery {
  feature_id?: string;
  feature_type?: string;
  sample_id?: string;
  sample_type?: string;
}

export interface FeatureValidationQuery {
  featureLabels: string[];
}

export interface Release {
  // anything that is per release instead of per table row
  releaseName: string;
  releaseVersionGroup: string;
  releaseGroup: string;
  releaseType: ReleaseType;
  description: string;
  citation: string;
  funding: string;
  isLatest: boolean;
}

export type SummaryStat = {
  label: string;
  value: number;
};

type SummaryStats = Array<SummaryStat>;
