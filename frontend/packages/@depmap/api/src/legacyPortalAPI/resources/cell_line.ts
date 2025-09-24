import { CellLineDataMatrix, OncogenicAlteration } from "@depmap/types";
import { uri } from "../../uriTemplateTag";
import { getJson } from "../client";

export function getCellLineCompoundSensitivityData(depmapId: string) {
  return getJson<CellLineDataMatrix>(
    uri`/cell_line/compound_sensitivity/${depmapId}`
  );
}

export function getCellLineDatasets(depmapId: string) {
  return getJson<{ [key: string]: any[] }>(
    uri`/cell_line/datasets/${depmapId}`
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
  return getJson<any>(uri`/cell_line/description_tile/${modelId}`);
}

export function getCellLinePrefDepData(
  data_type: "crispr" | "rnai",
  depmapId: string
) {
  return getJson<CellLineDataMatrix>(
    uri`/cell_line/prefdep/${data_type}/${depmapId}`
  );
}

export function getOncogenicAlterations(depmapId: string) {
  return getJson<{
    onco_alterations: Array<OncogenicAlteration>;
    oncokb_dataset_version: string;
  }>(uri`/cell_line/oncogenic_alterations/${depmapId}`);
}
