import qs from "qs";
import { enabledFeatures } from "@depmap/globals";
import { getJson } from "../client";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";

// ❌ ❌ ❌  WARNING: THIS IS EXPERIMENTAL AND WILL LIKELY CHANGE ❌ ❌ ❌
// DO NOT USE THIS FOR ANYTHING OTHER THAN THE NEW GENETEA TEA PARTY PAGE!!!!!

// Do not use in production! For local development only.
const toCorsProxyUrl = (geneTeaUrl: string, params: object) => {
  const query = qs.stringify(params, { arrayFormat: "repeat" });
  const url = `https://cds.team/${geneTeaUrl}/?${query}`;
  return "https://corsproxy.io/?" + encodeURIComponent(url);
};

export async function fetchGeneTeaEnrichmentExperimental(
  plotSelections: string[] | null,
  genes: string[],
  doGroupTerms: boolean,
  sortBy: "Significance" | "Effect Size",
  maxFDR: number,
  maxTopTerms: number | null,
  maxMatchingOverall: number | null,
  minMatchingQuery: number
  // effectSizeThreshold: number,
): Promise<GeneTeaEnrichedTerms> {
  if (!enabledFeatures.gene_tea) {
    throw new Error("GeneTea is not supported in this environment!");
  }

  const geneTeaUrl = "genetea-api/enriched-terms-v2";

  let params: any = {
    gene_list: genes,
    group_terms: doGroupTerms,
    include_plotting_payload: "true",
    sort_by: sortBy,
    max_fdr: maxFDR,
    min_genes: minMatchingQuery || -1,
    max_n_genes: maxMatchingOverall,
    n: plotSelections?.length === 0 ? maxTopTerms || undefined : undefined,
  };

  if (plotSelections) {
    params = { ...params, plot_selections: plotSelections };
  }

  interface RawResponse {
    // TODO: Give the user feedback when some genes are invalid.
    valid_genes: string[];
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
      groupby: "Term" | "Term Group";
      term_cluster: {
        Term: string[] | null[];
        "Term Group": string[] | null[];
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
        Enriched: boolean[];
        "-log10 FDR": number[];
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
        "-log10 FDR": number[];
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

  const plottingPayload = body.plotting_payload;
  const allEt = plottingPayload.all_enriched_terms;
  const et = body.enriched_terms;

  const enrichedTerms =
    et !== null
      ? {
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
        }
      : null;

  const allEnrichedTerms =
    allEt !== null
      ? {
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
          totalInfo: allEt["Total Info"],
          negLogFDR: allEt["-log10 FDR"],
        }
      : null;

  // TODO reorganize so this disabling is not necessary!!!
  /* eslint-disable no-nested-ternary */
  const termClusterTermOrGroup = !plottingPayload.term_cluster
    ? null
    : doGroupTerms
    ? plottingPayload.term_cluster["Term Group"]
    : plottingPayload.term_cluster.Term;
  /* eslint-enable no-nested-ternary */

  const termCluster = !plottingPayload.term_cluster
    ? null
    : {
        termOrTermGroup: termClusterTermOrGroup as string[],
        cluster: plottingPayload.term_cluster.Cluster,
        order: plottingPayload.term_cluster.Order,
      };

  const geneCluster = !plottingPayload.gene_cluster
    ? null
    : {
        gene: plottingPayload.gene_cluster.Gene,
        cluster: plottingPayload.gene_cluster.Cluster,
        order: plottingPayload.gene_cluster.Order,
      };

  const termToEntity = !plottingPayload.term_to_entity
    ? null
    : {
        termOrTermGroup: doGroupTerms
          ? (plottingPayload.term_to_entity["Term Group"] as string[])
          : (plottingPayload.term_to_entity.Term as string[]),
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
    enriched: plottingPayload.frequent_terms.Enriched,
    negLogFDR: plottingPayload.frequent_terms["-log10 FDR"],
  };

  return {
    validGenes: body.valid_genes,
    invalidGenes: body.invalid_genes,
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
