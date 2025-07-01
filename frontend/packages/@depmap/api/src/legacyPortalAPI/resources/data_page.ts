import { Downloads } from "@depmap/data-slicer";
import {
  DataAvailSummary,
  DataAvailability,
  DataPageDataType,
  DataPageDataTypeCategory,
  LineageAvailability,
} from "@depmap/types";
import { getJson } from "../client";

function getDataPageDataTypeColorCategory(
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
    case DataPageDataType.Sequencing_ATACSeq_Broad:
    case DataPageDataType.Sequencing_Long_Reads:
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
      return DataPageDataTypeCategory.Uncategorized;
    default:
      throw new Error(`Cannot map datatype ${datatype} to color category`);
  }
}

export function getLineageDataAvailability(dataType: string) {
  return getJson<LineageAvailability>(`/api/data_page/lineage_availability`, {
    data_type: dataType,
  });
}

export function getAllDataTabDownloadData() {
  return getJson<Downloads>("/data_page/api/data");
}

export async function getDataPageDataAvailability() {
  const boolSummary = await getJson<DataAvailSummary>(
    "/api/data_page/data_availability"
  );

  const dataTypes = Object.keys(boolSummary.data_type_url_mapping);
  const dataAvailVals = boolSummary.values.map(
    (datatypeVals: boolean[], index: number) =>
      datatypeVals.map((val: boolean) => {
        const dType =
          DataPageDataType[dataTypes[index] as keyof typeof DataPageDataType];
        return getDataPageDataTypeColorCategory(dType, val);
      })
  );

  return {
    all_depmap_ids: boolSummary.all_depmap_ids,
    // The original True/False values returned from the backend are
    // mapped to color category integers. The integer maps to Heatmap.tsx's
    // color scale.
    data_type_url_mapping: boolSummary.data_type_url_mapping,
    drug_count_mapping: boolSummary.drug_count_mapping,
    values: dataAvailVals,
    data_types: boolSummary.data_types,
  } as DataAvailability;
}
