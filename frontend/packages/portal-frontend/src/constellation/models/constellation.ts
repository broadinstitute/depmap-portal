import { LegacyPortalApiResponse } from "@depmap/api";

export type ConstellationGraphInputs = LegacyPortalApiResponse["getConstellationGraphs"];
export type Node = ConstellationGraphInputs["network"]["nodes"][number];
export type Edge = ConstellationGraphInputs["network"]["edges"][number];
export type GenesetSummary = ConstellationGraphInputs["overrepresentation"]["gene_sets_down"];

// a typescript enum might seem more natural here, but it does not enforce that a number is a valid enum value. hence using a union type
export type ConnectivityValue = 1 | 2 | 3;
