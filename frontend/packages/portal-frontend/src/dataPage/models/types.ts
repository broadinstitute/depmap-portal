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

export interface DataAvailSummary {
  all_depmap_ids: [number, string][];
  data_type_url_mapping: { [data_type: string]: string };
  drug_count_mapping: { [data_type: string]: number };
  data_types: string[];
  values: boolean[][];
}

export interface DataSummary {
  dataByCategory: {
    [key: string]: {
      all_depmap_ids: [number, string][];
      data_types: string[];
      values: number[][];
    };
  };
}

export interface DataAvailability {
  all_depmap_ids: [number, string][];
  data_type_url_mapping: { [data_type: string]: string };
  drug_count_mapping: { [data_type: string]: number };
  values: number[][];
  data_types: string[];
}

export enum DataPageDataType {
  CRISPR_Achilles_Broad = "CRISPR_Achilles_Broad",
  CRISPR_Score_Sanger = "CRISPR_Score_Sanger",
  CRISPR_ParalogsScreens = "CRISPR_ParalogsScreens",
  RNAi_Marcotte = "RNAi_Marcotte",
  RNAi_Achilles_Broad = "RNAi_Achilles_Broad",
  RNAi_Drive_Novartis = "RNAi_Drive_Novartis",
  Sequencing_WES_Broad = "Sequencing_WES_Broad",
  Sequencing_WES_Sanger = "Sequencing_WES_Sanger",
  Sequencing_WGS_Broad = "Sequencing_WGS_Broad",
  Sequencing_RNA_Broad = "Sequencing_RNA_Broad",
  Drug_CTD_Broad = "Drug_CTD_Broad",
  Drug_Repurposing_Broad = "Drug_Repurposing_Broad",
  Drug_GDSC_Sanger = "Drug_GDSC_Sanger",
  Drug_OncRef_Broad = "Drug_OncRef_Broad",
  Proteomics_Olink = "Proteomics_Olink",
  Proteomics_RPPA_CCLE = "Proteomics_RPPA_CCLE",
  Proteomics_MS_CCLE = "Proteomics_MS_CCLE",
  Proteomics_MS_Sanger = "Proteomics_MS_Sanger",
  Methylation_Sanger = "Methylation_Sanger",
  Methylation_CCLE = "Methylation_CCLE",
  Uncategorized_miRNA_CCLE = "Uncategorized_miRNA_CCLE",
  Uncategorized_ATACSeq_Broad = "Uncategorized_ATACSeq_Broad",
}

export enum DataPageDataTypeCategory {
  CRISPRScreens = 1,
  RNAiScreens = 2,
  Sequencing = 3,
  Proteomics = 4,
  Methylation = 5,
  DrugScreens = 6,
  Uncategorized = 7,
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

export function getDataPageDataTypeColorCategory(
  datatype: DataPageDataType,
  cellLineAvailable: boolean
) {
  if (!cellLineAvailable) {
    return 0;
  }

  switch (datatype) {
    case DataPageDataType.CRISPR_Achilles_Broad:
    case DataPageDataType.CRISPR_Score_Sanger:
    case DataPageDataType.CRISPR_ParalogsScreens:
      return DataPageDataTypeCategory.CRISPRScreens;
    case DataPageDataType.RNAi_Achilles_Broad:
    case DataPageDataType.RNAi_Drive_Novartis:
    case DataPageDataType.RNAi_Marcotte:
      return DataPageDataTypeCategory.RNAiScreens;
    case DataPageDataType.Sequencing_RNA_Broad:
    case DataPageDataType.Sequencing_WES_Broad:
    case DataPageDataType.Sequencing_WES_Sanger:
    case DataPageDataType.Sequencing_WGS_Broad:
      return DataPageDataTypeCategory.Sequencing;
    case DataPageDataType.Proteomics_MS_CCLE:
    case DataPageDataType.Proteomics_MS_Sanger:
    case DataPageDataType.Proteomics_Olink:
    case DataPageDataType.Proteomics_RPPA_CCLE:
      return DataPageDataTypeCategory.Proteomics;
    case DataPageDataType.Methylation_CCLE:
    case DataPageDataType.Methylation_Sanger:
      return DataPageDataTypeCategory.Methylation;
    case DataPageDataType.Drug_CTD_Broad:
    case DataPageDataType.Drug_GDSC_Sanger:
    case DataPageDataType.Drug_OncRef_Broad:
    case DataPageDataType.Drug_Repurposing_Broad:
      return DataPageDataTypeCategory.DrugScreens;
    case DataPageDataType.Uncategorized_miRNA_CCLE:
    case DataPageDataType.Uncategorized_ATACSeq_Broad:
      return DataPageDataTypeCategory.Uncategorized;
    default:
      throw new Error(`Cannot map datatype ${datatype} to color category`);
  }
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
    case DataPageDataType.CRISPR_Achilles_Broad:
      return "Standard KO Screens (Broad)";
    case DataPageDataType.CRISPR_Score_Sanger:
      return "Score (Sanger)";
    case DataPageDataType.CRISPR_ParalogsScreens:
      return "Paralog Screens";
    case DataPageDataType.Methylation_Sanger:
      return "Sanger";
    case DataPageDataType.Methylation_CCLE:
      return "CCLE";
    case DataPageDataType.Uncategorized_miRNA_CCLE:
      return "miRNA (CCLE)";
    case DataPageDataType.Uncategorized_ATACSeq_Broad:
      return "Atac Seq (Broad)";
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
      return DataPageDataTypeCategoryStrings.Sequencing;
    case DataPageDataType.CRISPR_Achilles_Broad:
    case DataPageDataType.CRISPR_Score_Sanger:
    case DataPageDataType.CRISPR_ParalogsScreens:
      return DataPageDataTypeCategoryStrings.CRISPRScreens;
    case DataPageDataType.Methylation_Sanger:
    case DataPageDataType.Methylation_CCLE:
      return DataPageDataTypeCategoryStrings.Methylation;
    case DataPageDataType.Uncategorized_miRNA_CCLE:
    case DataPageDataType.Uncategorized_ATACSeq_Broad:
      return DataPageDataTypeCategoryStrings.Uncategorized;
    default:
      throw new Error(`Cannot map datatype ${datatype} to color category`);
  }
}
