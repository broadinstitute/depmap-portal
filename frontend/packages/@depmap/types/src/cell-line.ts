export type CellLineDataMatrix = {
  model_id: string;
  dataset_label: string;
  labels: Array<string>;
  data: Array<Array<number | null>>;
  cell_line_col_index: number;
};

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
