import { getJson } from "../client";

type EntitySummaryResponse = {
  description: string;
  entity_type: "gene" | "compound";
  interactive_url: string;
  legend: {
    expression: {
      entries: Array<{ diameter: number; label: string }>;
      units: string;
    };
    mutation: Array<{ color: number; label: string }>;
  };
  line: number;
  strip: {
    traces: Array<{
      category: string;
      data: {
        cell_line_information: Array<{
          cell_line_display_name: string;
          depmap_id: string;
        }>;
        depmap_id: Array<string>;
        label: Array<string>;
        mutation_num: Array<number>;
        size: Array<number>;
        value: Array<number>;
      };
      lineage_level: number;
      num_lines: number;
    }>;
    url_root: string;
  };
  x_label: string;
  x_range: [number, number];
};

export function getEntitySummary(
  entity_id: number,
  dep_enum_name: string,
  size_biom_enum_name: string,
  color: string
) {
  return getJson<EntitySummaryResponse>("/partials/entity_summary", {
    entity_id,
    dep_enum_name,
    size_biom_enum_name: size_biom_enum_name || "none",
    color: color || "none",
  });
}
