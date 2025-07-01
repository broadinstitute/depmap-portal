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
  Sequencing_ATACSeq_Broad = "Sequencing_ATACSeq_Broad",
  Sequencing_Long_Reads = "Sequencing_Long_Reads",
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

export interface DataAvailability {
  all_depmap_ids: [number, string][];
  data_type_url_mapping: { [data_type: string]: string };
  drug_count_mapping: { [data_type: string]: number };
  values: number[][];
  data_types: string[];
}

export interface LineageAvailability {
  lineage_counts: LineageCountInfo;
}

export interface LineageCountInfo {
  [lineage: string]: [{ [primary_disease: string]: number }];
}

export interface DataAvailSummary {
  all_depmap_ids: [number, string][];
  data_type_url_mapping: { [data_type: string]: string };
  drug_count_mapping: { [data_type: string]: number };
  data_types: string[];
  values: boolean[][];
}
