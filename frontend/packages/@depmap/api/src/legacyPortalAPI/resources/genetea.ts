import { enabledFeatures } from "@depmap/globals";
import { getJson } from "../client";

export async function fetchGeneTeaEnrichment(
  genes: string[],
  limit: number | null
): Promise<{
  term: string[];
  synonyms: string[][];
  coincident: string[][];
  fdr: number[];
  matchingGenes: string[][];
  total: number;
}> {
  if (!enabledFeatures.gene_tea) {
    throw new Error("GeneTea is not supported in this environment!");
  }

  const body = await getJson<{
    // TODO: Give the user feedback when some genes are invalid.
    invalid_genes: string[];
    total_n_enriched_terms: number;
    enriched_terms: {
      Term: string[];
      // semicolon separated strings
      Synonyms: (string | null)[];
      // semicolon separated strings
      "Coincident Terms": (string | null)[];
      FDR: number[];
      // Gene lists are just space-separated strings like "ADSL CAD UMPS"
      "Matching Genes in List": string[];
    };
  }>(`/../../genetea-api/enriched-terms/`, {
    gene_list: genes,
    remove_overlapping: "true",
    n: limit || -1,
    model: "v2",
  });

  // `enriched_terms` can be null when there are no relevant terms. We'll
  // return a wrapper object to distinguish this from some kind of error.
  if (body.enriched_terms === null) {
    return {
      term: [],
      synonyms: [],
      coincident: [],
      fdr: [],
      matchingGenes: [],
      total: 0,
    };
  }

  const et = body.enriched_terms;

  return {
    term: et.Term,
    fdr: et.FDR,
    total: body.total_n_enriched_terms,
    synonyms: et.Synonyms.map((list) => list?.split(";") || []),
    coincident: et["Coincident Terms"].map((list) => list?.split(";") || []),
    matchingGenes: et["Matching Genes in List"].map((geneList) => {
      return geneList.split(" ");
    }),
  };
}

export async function fetchGeneTeaTermContext(
  term: string,
  genes: string[]
): Promise<Record<string, string>> {
  if (!enabledFeatures.gene_tea) {
    throw new Error("GeneTea is not supported in this environment!");
  }

  const body = await getJson<
    | {
        valid_genes: string[];
        invalid_genes: string[];
        remapped_genes: Record<string, string>;
        context: Record<string, string>;
      }
    | { message: string } // error message
  >(`/../../genetea-api/context/`, {
    term,
    gene_list: genes,
    model: "v2",
    html: true,
  });

  if ("message" in body) {
    throw new Error(body.message);
  }

  return body.context;
}
