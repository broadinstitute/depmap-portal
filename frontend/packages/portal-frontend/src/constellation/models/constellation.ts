export type Node = {
  id: string;
  feature: string;
  task?: string; // optional for now until confirm constellation upload doesn't break
  x: number;
  y: number;
  effect: number;
  "-log10(P)": number;
  gene_sets: Array<string>;
  should_label: boolean;
};

export type Edge = { from: string; to: string; weight: number };

export type GenesetSummary = {
  n: Array<number>;
  neg_log_p: Array<number>;
  p_value: Array<number>;
  rank: Array<number>;
  term: Array<string>;
  term_short: Array<string>;
  type: Array<string>;
  genes: Array<Array<string>>;
  x: Array<number>;
  y: Array<number>;
};

export type ConstellationGraphInputs = {
  network: {
    nodes: Array<Node>;
    edges: Array<Edge>;
  };
  overrepresentation: {
    gene_sets_down: GenesetSummary;
    gene_sets_up: GenesetSummary;
  };
  table: Array<{
    effect: number;
    "-log10(P)": number;
    feature: string;
  }>;
};
// a typescript enum might seem more natural here, but it does not enforce that a number is a valid enum value. hence using a union type
export type ConnectivityValue = 1 | 2 | 3;
