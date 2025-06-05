import { ModelAnnotation } from "./ModelAnnotation";

export interface DatasetDataTypes {
  dataType: string;
  datasets: { display_name: string; download_url: string }[];
}

export interface SubtypeTreeInfo {
  node_name: string;
  subtype_code: string;
  level: number;
  context_explorer_url: string;
}

export interface ModelInfo {
  image: string;
  // cell_line_name: string;
  primary_metastasis: string;
  sample_collection_site: string;
  lineage_tree: SubtypeTreeInfo[];
  molecular_subtype_tree: SubtypeTreeInfo[];
  oncotree_lineage: string;
  oncotree_primary_disease: string;
  oncotree_subtype_and_code: string;
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
