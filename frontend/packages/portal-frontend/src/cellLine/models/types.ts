import { ModelAnnotation } from "./ModelAnnotation";

export interface DatasetDataTypes {
  dataType: string;
  datasets: { display_name: string; download_url: string }[];
}

export type OncogenicAlteration = {
  gene: { name: string; url: string };
  alteration: string;
  oncogenic: "Oncogenic" | "Likely Oncogenic";
  function_change:
    | "Likely Loss-of-function"
    | "Likely Gain-of-function"
    | "Loss-of-function"
    | "Gain-of-function"
    | "Unknown";
};

export type CellLineDataMatrix = {
  model_id: string;
  dataset_label: string;
  labels: Array<string>;
  data: Array<Array<number | null>>;
  cell_line_col_index: number;
};

export interface ModelInfo {
  image: string;
  // cell_line_name: string;
  primary_metastasis: string;
  sample_collection_site: string;
  oncotree_lineage: {
    display_name: string;
    url: string;
  };
  oncotree_primary_disease: {
    display_name: string;
    url: string;
  };
  oncotree_subtype_and_code: {
    display_name: string;
    url: string;
  };
  legacy_molecular_subtype: string;
  engineered_model: string;
  growth_pattern: string;
  tissue_origin: string;
  source_type: string;
  catalog_number: string;
  model_derivation_material: string;
  related_models: {
    model_id: string;
    url: string;
  }[];
  aliases: string[];
  metadata: ModelAnnotation;
}
