import { SliceQuery } from "@depmap/types";

export function sliceIdToSliceQuery(
  slice_id: string,
  value_type: "categorical" | "continuous",
  dimension_type: string
): SliceQuery {
  const [prefix, dataset_id, identifier, labelType] = slice_id
    .split("/")
    .map(decodeURIComponent);

  if (prefix !== "slice" || !dataset_id || !identifier || !labelType) {
    throw new Error("Malformed slice ID");
  }

  if (value_type === "continuous") {
    return {
      dataset_id: dataset_id.replace("breadbox/", ""),
      identifier,
      identifier_type:
        labelType === "transpose_label" ? "sample_label" : "feature_label",
    } as SliceQuery;
  }

  // Try to identify any of the legacy categorical slice
  // IDs that used to be hardcoded in the Portal backend.
  // https://github.com/broadinstitute/depmap-portal/blob/08aeb57/portal-backend/depmap/data_explorer_2/datatypes.py
  // See also https://docs.google.com/spreadsheets/d/1VKD3cvz9n4GhWnn4xIoT3mZaGyUiI6qqmxxcTxTBXG0/edit
  switch (dataset_id) {
    case "screen_metadata":
      return {
        dataset_id: "Screen metadata_metadata",
        identifier_type: "column",
        identifier,
      };

    case "depmap_model_metadata":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier,
      };

    case "cell_line_display_name":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "CellLineName",
      };

    case "age_category":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "AgeCategory",
      };

    case "lineage": {
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier:
          {
            "1": "OncotreeLineage",
            "2": "OncotreePrimaryDisease",
            "3": "OncotreeSubtype",
          }[identifier] || "<unknown>",
      };
    }

    case "primary_disease":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "OncotreePrimaryDisease",
      };

    case "disease_subtype":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "OncotreeSubtype",
      };

    case "tumor_type":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "PrimaryOrMetastasis",
      };

    case "gender":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "Sex",
      };

    case "growth_pattern":
      return {
        dataset_id: "depmap_model_metadata",
        identifier_type: "column",
        identifier: "GrowthPattern",
      };

    // TODO: Spport these special cases
    // case "mutations_prioritized":
    // case "msi-0584.6/msi":
    // case "prism-pools-4441.2/coded_prism_pools":
    // case "mutation_protein_change_by_gene":
    // case "gene_essentiality":
    // case "gene_selectivity":
    // case "compound_experiment":
    // case "OmicsInferredMolecularSubtypes":
    // case "Context_Matrix":

    default:
      if (identifier === "all") {
        return {
          dataset_id: `${dimension_type}_metadata`,
          identifier_type: "column",
          identifier: dataset_id,
        };
      }

      return {
        dataset_id,
        identifier_type: "column",
        identifier,
      };
  }
}
