import { SliceQuery } from "@depmap/types";
import wellKnownDatasets from "../constants/wellKnownDatasets";

export function legacyPortalIdToBreadboxGivenId(legacyId: string) {
  switch (legacyId) {
    case "Context_Matrix":
      return wellKnownDatasets.subtype_matrix;

    case "CTRP_AUC":
      return "CTRP_AUC_collapsed";

    case "GDSC1_AUC":
      return "GDSC1_AUC_collapsed";

    case "GDSC2_AUC":
      return "GDSC2_AUC_collapsed";

    case "Prism_oncology_AUC":
      return "Prism_oncology_AUC_collapsed";

    case "Repurposing_secondary_AUC":
      return "REPURPOSING_AUC_collapsed";

    default:
      return legacyId.replace("breadbox/", "");
  }
}

export function sliceIdToSliceQuery(
  slice_id: string,
  value_type: "categorical" | "continuous" | "list_strings",
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
      dataset_id: legacyPortalIdToBreadboxGivenId(dataset_id),
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

    case "mutations_prioritized":
      return {
        dataset_id: wellKnownDatasets.mutations_prioritized,
        identifier,
        identifier_type: "feature_label",
      };

    case "mutation_protein_change_by_gene":
      return {
        dataset_id: wellKnownDatasets.mutation_protein_change,
        identifier,
        identifier_type: "feature_label",
      };

    case "gene_essentiality":
      return {
        dataset_id: "gene_metadata",
        identifier_type: "column",
        identifier: "essentiality",
      };

    case "gene_selectivity":
      return {
        dataset_id: "gene_metadata",
        identifier_type: "column",
        identifier: "selectivity",
      };

    // TODO: Spport these special cases
    // case "msi-0584.6/msi":
    // case "prism-pools-4441.2/coded_prism_pools":
    // case "compound_experiment":

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
