import qs from "qs";
import { enabledFeatures } from "@depmap/globals";
import { getJson } from "../client";

/////
///// ❌ ❌ ❌  WARNING: THIS IS EXPERIMENTAL AND WILL LIKELY CHANGE ❌ ❌ ❌
///// DO NOT USE THIS FOR ANYTHING OTHER THAN THE NEW GENETEA TEA PARTY PAGE!!!!!
/////
/////

// Do not use in production! For local development only.
const toCorsProxyUrl = (geneTeaUrl: string, params: object) => {
  const query = qs.stringify(params, { arrayFormat: "repeat" });
  const url = `https://cds.team/${geneTeaUrl}/?${query}`;
  return "https://corsproxy.io/?" + encodeURIComponent(url);
};

export async function fetchGeneTeaEnrichmentExperimental(
  genes: string[],
  limit: number | null,
  doGroupTerms: boolean,
  doClusterGenes: boolean,
  doClusterTerms: boolean
): Promise<{
  term: string[];
  termGroup: string[];
  effectSize: number[];
  synonyms: string[][];
  coincident: string[][];
  fdr: number[];
  matchingGenesInList: string[][];
  nMatchingGenesInList: number[];
  nMatchingGenesOverall: number[];
  totalEnrichedTerms: number;
  totalTermGroups: number;
}> {
  if (!enabledFeatures.gene_tea) {
    throw new Error("GeneTea is not supported in this environment!");
  }

  const geneTeaUrl = "genetea-api/enriched-terms";

  const params = {
    gene_list: genes,
    group_terms: doGroupTerms,
    cluster: doClusterGenes,
    remove_overlapping: "true",
    n: limit || -1,
    model: "GeneTEA",
  };

  interface RawResponse {
    // TODO: Give the user feedback when some genes are invalid.
    invalid_genes: string[];
    total_n_enriched_terms: number;
    total_n_term_groups: number;
    enriched_terms: {
      Term: string[];
      // semicolon separated strings
      Synonyms: (string | null)[];
      // semicolon separated strings
      "Coincident Terms": (string | null)[];
      FDR: number[];
      // Gene lists are just space-separated strings like "ADSL CAD UMPS"
      "Matching Genes in List": string[];
      "n Matching Genes in List": number[];
      "n Matching Genes Overall": number[];
      "Term Group": string[];
      "Effect Size": number[];
    };
  }

  const body =
    process.env.NODE_ENV === "development"
      ? await getJson<RawResponse>(
          toCorsProxyUrl(geneTeaUrl, params),
          undefined,
          { credentials: "omit" }
        )
      : await getJson<RawResponse>(`/../../${geneTeaUrl}/`, params);

  // `enriched_terms` can be null when there are no relevant terms. We'll
  // return a wrapper object to distinguish this from some kind of error.
  if (body.enriched_terms === null) {
    return {
      term: [],
      termGroup: [],
      effectSize: [],
      synonyms: [],
      coincident: [],
      fdr: [],
      matchingGenesInList: [],
      nMatchingGenesInList: [],
      nMatchingGenesOverall: [],
      totalEnrichedTerms: 0,
      totalTermGroups: 0,
    };
  }

  const et = body.enriched_terms;

  return {
    term: et.Term,
    fdr: et.FDR,
    totalEnrichedTerms: body.total_n_enriched_terms,
    totalTermGroups: body.total_n_term_groups,
    synonyms: et.Synonyms.map((list) => list?.split(";") || []),
    coincident: et["Coincident Terms"].map((list) => list?.split(";") || []),
    matchingGenesInList: et["Matching Genes in List"].map((geneList) => {
      return geneList.split(" ");
    }),
    nMatchingGenesInList: et["n Matching Genes in List"],
    nMatchingGenesOverall: et["n Matching Genes Overall"],
    termGroup: et["Term Group"],
    effectSize: et["Effect Size"],
  };
}

export async function fetchGeneTeaTermContextExperimental(
  term: string,
  genes: string[]
): Promise<Record<string, string>> {
  if (!enabledFeatures.gene_tea) {
    throw new Error("GeneTea is not supported in this environment!");
  }

  const geneTeaUrl = "genetea-api/context";

  const params = {
    term,
    gene_list: genes,
    html: true,
    model: "GeneTEA",
  };

  type RawResponse =
    | {
        valid_genes: string[];
        invalid_genes: string[];
        remapped_genes: Record<string, string>;
        context: Record<string, string>;
      }
    | { message: string }; // error message

  const body =
    process.env.NODE_ENV === "development"
      ? await getJson<RawResponse>(
          toCorsProxyUrl(geneTeaUrl, params),
          undefined,
          { credentials: "omit" }
        )
      : await getJson<RawResponse>(`/../../${geneTeaUrl}/`, params);

  if ("message" in body) {
    throw new Error(body.message);
  }

  return body.context;
}
