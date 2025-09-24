import { CellLineDataMatrix, OncogenicAlteration } from "@depmap/types";
import { getJson } from "../client";

export function getCellLineCompoundSensitivityData(depmapId: string) {
  return getJson<CellLineDataMatrix>(
    `/cell_line/compound_sensitivity/${depmapId}`
  );
}

export function getCellLineDatasets(depmapId: string) {
  return getJson<{ [key: string]: any[] }>(
    `/cell_line/datasets/${depmapId}`
  ).then(
    (datasetTypeDatasets: {
      [key: string]: { display_name: string; download_url: string }[];
    }) => {
      return Object.keys(datasetTypeDatasets).map((dataType) => {
        const formattedDatasetDataType = {
          dataType,
          datasets: datasetTypeDatasets[dataType],
        };

        return formattedDatasetDataType;
      });
    }
  );
}

export function getCellLineDescriptionTileData(modelId: string) {
  return getJson<any>(`/cell_line/description_tile/${modelId}`);
}

export function getCellLinePrefDepData(
  data_type: "crispr" | "rnai",
  depmapId: string
) {
  return getJson<CellLineDataMatrix>(
    `/cell_line/prefdep/${data_type}/${depmapId}`
  );
}

export function getOncogenicAlterations(depmapId: string) {
  return getJson<{
    onco_alterations: Array<OncogenicAlteration>;
    oncokb_dataset_version: string;
  }>(`/cell_line/oncogenic_alterations/${depmapId}`);
}
