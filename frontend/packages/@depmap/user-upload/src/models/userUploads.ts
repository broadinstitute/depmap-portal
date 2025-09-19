import {
  PendingCeleryTask,
  ProgressCeleryTask,
  SuccessCeleryTask,
  FailedCeleryTask,
} from "@depmap/compute";

export enum UploadFormat {
  Taiga = "taiga",
  File = "file",
}

export enum DataTypeEnum {
  cn = "CN",
  mutations = "Mutations",
  model_metadata = "Model Metadata",
  protein_expression = "Protein Expression",
  methylation = "Methylation",
  structural_variants = "Structural variants",
  expression = "Expression",
  metabolomics = "Metabolomics",
  confounders = "Confounders",
  crispr = "CRISPR",
  rnai = "RNAi",
  global_genomics = "Global genomics",
  global_epigenomic_feature = "Global epigenomic feature",
  drug_screen = "Drug screen",
  msi = "MSI",
  metmap = "MetMap",
  functional_category = "Functional category",
  deprecated = "deprecated",
  user_upload = "User upload",
}

export interface SuccessUploadTask extends SuccessCeleryTask {
  result: {
    datasetId: string;
    warnings: Array<string>;
    // Transient and private
    forwardingUrl?: string;
    sliceId?: string; // For Breadbox use. Otherwise, use the sliceId outside of result
    dataset?: any;
  };

  // For single-row upload only
  sliceId?: string;
}

export type UploadTaskUserError = {
  message: string;
};

export type UploadTask =
  | PendingCeleryTask
  | ProgressCeleryTask
  | SuccessUploadTask
  | FailedCeleryTask;

export type UserUploadArgs = {
  displayName: string;
  units: string;
  transposed: boolean;

  uploadFile: File;
  taigaId?: string;

  /* Access group for private datasets */
  selectedGroup?: number;
  selectedDataType?: DataTypeEnum;

  useDataExplorer2?: boolean;
};
