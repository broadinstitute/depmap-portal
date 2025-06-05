import { DataPageDataType } from "@depmap/types";

export const COLOR_SCALE = [
  // Data not available colors
  [0, "rgb(217, 217, 217)"],
  // CRISPR
  [0.1, "#2FA9D0"],
  // RNAi Screens
  [0.2, "#863D8D"],
  // Sequencing
  [0.3, "#244A95"],
  // Proteomics
  [0.4, "#56B7A9"],
  // Methylation
  [0.5, "#E1790E"],
  // Drug Screens
  [0.6, "#C55252"],
  // Other
  [0.7, "#5236A1"],
  [1.0, "rgb(0, 0, 0)"],
];

export interface DataSummary {
  dataByCategory: {
    [key: string]: {
      all_depmap_ids: [number, string][];
      data_types: string[];
      values: number[][];
    };
  };
}

export enum DataPageDataTypeCategoryStrings {
  DrugScreens = "Drug Screens",
  RNAiScreens = "RNAi Screens",
  Proteomics = "Proteomics",
  Sequencing = "Sequencing",
  CRISPRScreens = "CRISPR Screens",
  Methylation = "Methylation",
  Uncategorized = "Other Datasets",
}

export function getDataPageDataTypeString(datatype: DataPageDataType) {
  switch (datatype) {
    case DataPageDataType.Drug_CTD_Broad:
      return "CTD (Broad)";
    case DataPageDataType.Drug_Repurposing_Broad:
      return "Repurposing (Broad)";
    case DataPageDataType.Drug_GDSC_Sanger:
      return "GDSC (Sanger)";
    case DataPageDataType.Drug_OncRef_Broad:
      return "OncRef (Broad)";
    case DataPageDataType.RNAi_Achilles_Broad:
      return "Achilles (Broad)";
    case DataPageDataType.RNAi_Marcotte:
      return "Marcotte";
    case DataPageDataType.RNAi_Drive_Novartis:
      return "Drive (Novartis)";
    case DataPageDataType.Proteomics_Olink:
      return "Olink";
    case DataPageDataType.Proteomics_RPPA_CCLE:
      return "RPPA (CCLE)";
    case DataPageDataType.Proteomics_MS_CCLE:
      return "MS (CCLE)";
    case DataPageDataType.Proteomics_MS_Sanger:
      return "MS (Sanger)";
    case DataPageDataType.Sequencing_RNA_Broad:
      return "RNA (Broad)";
    case DataPageDataType.Sequencing_WES_Broad:
      return "WES (Broad)";
    case DataPageDataType.Sequencing_WES_Sanger:
      return "WES (Sanger)";
    case DataPageDataType.Sequencing_WGS_Broad:
      return "WGS (Broad)";
    case DataPageDataType.Sequencing_ATACSeq_Broad:
      return "ATAC-seq (Broad)";
    case DataPageDataType.Sequencing_Long_Reads:
      return "Long Reads";
    case DataPageDataType.CRISPR_Achilles_Broad:
      return "CRISPR KO screens (Broad)";
    case DataPageDataType.CRISPR_Score_Sanger:
      return "CRISPR KO screens (Sanger)";
    case DataPageDataType.CRISPR_ParalogsScreens:
      return "Paralog CRISPR KO screens (Broad)";
    case DataPageDataType.Methylation_Sanger:
      return "Sanger";
    case DataPageDataType.Methylation_CCLE:
      return "CCLE";
    case DataPageDataType.Uncategorized_miRNA_CCLE:
      return "miRNA (CCLE)";
    default:
      throw new Error(`Cannot map datatype ${datatype} to color category`);
  }
}

export function getDataPageDataTypeColorCategoryString(
  datatype: DataPageDataType
) {
  switch (datatype) {
    case DataPageDataType.Drug_CTD_Broad:
    case DataPageDataType.Drug_Repurposing_Broad:
    case DataPageDataType.Drug_GDSC_Sanger:
    case DataPageDataType.Drug_OncRef_Broad:
      return DataPageDataTypeCategoryStrings.DrugScreens;
    case DataPageDataType.RNAi_Achilles_Broad:
    case DataPageDataType.RNAi_Marcotte:
    case DataPageDataType.RNAi_Drive_Novartis:
      return DataPageDataTypeCategoryStrings.RNAiScreens;
    case DataPageDataType.Proteomics_Olink:
    case DataPageDataType.Proteomics_RPPA_CCLE:
    case DataPageDataType.Proteomics_MS_CCLE:
    case DataPageDataType.Proteomics_MS_Sanger:
      return DataPageDataTypeCategoryStrings.Proteomics;
    case DataPageDataType.Sequencing_RNA_Broad:
    case DataPageDataType.Sequencing_WES_Broad:
    case DataPageDataType.Sequencing_WES_Sanger:
    case DataPageDataType.Sequencing_WGS_Broad:
    case DataPageDataType.Sequencing_ATACSeq_Broad:
    case DataPageDataType.Sequencing_Long_Reads:
      return DataPageDataTypeCategoryStrings.Sequencing;
    case DataPageDataType.CRISPR_Achilles_Broad:
    case DataPageDataType.CRISPR_Score_Sanger:
    case DataPageDataType.CRISPR_ParalogsScreens:
      return DataPageDataTypeCategoryStrings.CRISPRScreens;
    case DataPageDataType.Methylation_Sanger:
    case DataPageDataType.Methylation_CCLE:
      return DataPageDataTypeCategoryStrings.Methylation;
    case DataPageDataType.Uncategorized_miRNA_CCLE:
      return DataPageDataTypeCategoryStrings.Uncategorized;
    default:
      throw new Error(`Cannot map datatype ${datatype} to color category`);
  }
}

export interface TypeGroupOption {
  name: string;
  versions?: string[];
}

export interface TypeGroup {
  name: string;
  // TypeGroup name comes from ReleaseType. Each ReleaseType can have options that map to either a releasee
  // name OR a releaseVersionGroup (e.g. DepMap Consortium or DepMap Public).
  options: Array<TypeGroupOption>;
}
