import qs from "qs";
import { enabledFeatures } from "@depmap/globals";
import { getJson } from "../client";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";

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
): Promise<GeneTeaEnrichedTerms> {
  if (!enabledFeatures.gene_tea) {
    throw new Error("GeneTea is not supported in this environment!");
  }

  const geneTeaUrl = "genetea-api/enriched-terms-v2";

  const params = {
    gene_list: genes,
    group_terms: doGroupTerms,
    cluster: doClusterGenes,
    remove_overlapping: "true",
    include_plotting_payload: "true",
    n: limit || -1,
  };

  interface RawResponse {
    // TODO: Give the user feedback when some genes are invalid.
    invalid_genes: string[];
    total_n_enriched_terms: number;
    total_n_term_groups: number;
    enriched_terms: {
      Term: string[];
      "Matching Genes in List": string[];
      "n Matching Genes Overall": number[];
      "n Matching Genes in List": number[];
      "p-val": number[];
      FDR: number[];
      Stopword: boolean[];
      Synonyms: (string | null)[];
      "Total Info": number[];
      "Effect Size": number[];
      "Term Group": string[];
      "-log10 FDR": number[];
      "Clipped Term": string[];
      "Clipped Synonyms": (string | null)[];
      "Clipped Matching Genes in List": string[];
    };
    plotting_payload: {
      groupby: string;
      term_cluster: {
        Term: string[];
        Cluster: number[];
        Order: number[];
      };
      gene_cluster: {
        Gene: string[];
        Cluster: number[];
        Order: number[];
      };
      term_to_entity: any; // TODO update this type
      frequent_terms: {
        Term: string[];
        "Matching Genes in List": string[];
        "n Matching Genes Overall": number[];
        "n Matching Genes in List": number[];
        "p-val": number[];
        FDR: number[];
        Stopword: boolean[];
        Synonyms: (string | null)[];
        "Total Info": number[];
        "Effect Size": number[];
      };
      all_enriched_terms: {
        Term: string[];
        "Matching Genes in List": string[];
        "n Matching Genes Overall": number[];
        "n Matching Genes in List": number[];
        "p-val": number[];
        FDR: number[];
        Stopword: boolean[];
        Synonyms: (string | null)[];
        "Total Info": number[];
        "Effect Size": number[];
        "Term Group": string[];
      };
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

  // // `enriched_terms` can be null when there are no relevant terms. We'll
  // // return a wrapper object to distinguish this from some kind of error.
  // if (body.plotting_payload.all_enriched_terms === null) {
  //   return {
  //     term: [],
  //     termGroup: [],
  //     effectSize: [],
  //     synonyms: [],
  //     coincident: [],
  //     fdr: [],
  //     matchingGenesInList: [],
  //     nMatchingGenesInList: [],
  //     nMatchingGenesOverall: [],
  //     totalEnrichedTerms: 0,
  //     totalTermGroups: 0,
  //   };
  // }

  const plottingPayload = body.plotting_payload;
  const allEt = plottingPayload.all_enriched_terms;
  const et = body.enriched_terms;
  const enrichedTerms = {
    term: et.Term,
    fdr: et.FDR,
    totalEnrichedTerms: body.total_n_enriched_terms,
    totalTermGroups: body.total_n_term_groups,
    synonyms: et.Synonyms.map((list) => list?.split(";") || []),
    matchingGenesInList: et["Matching Genes in List"],
    nMatchingGenesInList: et["n Matching Genes in List"],
    nMatchingGenesOverall: et["n Matching Genes Overall"],
    termGroup: et["Term Group"],
    effectSize: et["Effect Size"],
    pVal: et["p-val"],
    stopword: et.Stopword,
    totalInfo: et["Total Info"],
    negLogFDR: et["-log10 FDR"],
    clippedTerm: et["Clipped Term"],
    clippedSynonyms: et["Clipped Synonyms"].map(
      (list) => list?.split(";") || []
    ),
    clippedMatchingGenesInList: et["Clipped Matching Genes in List"],
  };
  const allEnrichedTerms = {
    term: allEt.Term,
    fdr: allEt.FDR,
    synonyms: allEt.Synonyms.map((list) => list?.split(";") || []),
    matchingGenesInList: allEt["Matching Genes in List"],
    nMatchingGenesInList: allEt["n Matching Genes in List"],
    nMatchingGenesOverall: allEt["n Matching Genes Overall"],
    termGroup: allEt["Term Group"],
    effectSize: allEt["Effect Size"],
    pVal: allEt["p-val"],
    stopword: allEt.Stopword,
    totalInfo: et["Total Info"],
  };

  const termCluster = {
    term: plottingPayload.term_cluster.Term,
    cluster: plottingPayload.term_cluster.Cluster,
    order: plottingPayload.term_cluster.Order,
  };

  const geneCluster = {
    gene: plottingPayload.gene_cluster.Gene,
    cluster: plottingPayload.gene_cluster.Cluster,
    order: plottingPayload.gene_cluster.Order,
  };

  const termToEntity = {
    term: plottingPayload.term_to_entity["Term Group"],
    gene: plottingPayload.term_to_entity.Gene,
    count: plottingPayload.term_to_entity.Count,
    nTerms: plottingPayload.term_to_entity["n Terms"],
    fraction: plottingPayload.term_to_entity.Fraction,
  };

  const frequentTerms = {
    term: plottingPayload.frequent_terms.Term,
    matchingGenesInList:
      plottingPayload.frequent_terms["Matching Genes in List"],
    nMatchingGenesOverall:
      plottingPayload.frequent_terms["n Matching Genes Overall"],
    nMatchingGenesInList:
      plottingPayload.frequent_terms["n Matching Genes in List"],
    pVal: plottingPayload.frequent_terms["p-val"],
    fdr: plottingPayload.frequent_terms.FDR,
    stopword: plottingPayload.frequent_terms.Stopword,
    synonyms: plottingPayload.frequent_terms.Synonyms.map(
      (list) => list?.split(";") || []
    ),
    totalInfo: plottingPayload.frequent_terms["Total Info"],
    effectSize: plottingPayload.frequent_terms["Effect Size"],
  };

  return {
    totalNEnrichedTerms: body.total_n_enriched_terms,
    totalNTermGroups: body.total_n_term_groups,
    groupby: plottingPayload.groupby,
    enrichedTerms,
    termCluster,
    geneCluster,
    termToEntity,
    frequentTerms,
    allEnrichedTerms,
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
