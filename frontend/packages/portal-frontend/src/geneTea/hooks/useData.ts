import { cached, legacyPortalAPI } from "@depmap/api";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";
import { useEffect, useMemo, useState } from "react";
import { SortOption } from "../types";
import { groupStringsByCondition } from "../utils";

// TODO: picked these numbers at random. Figure out what they should actually be.
const MIN_SELECTION = 3;
const MAX_SELECTION = 300; // TODO: The API will error at a certain number. Make sure this doesn't exceed that number.

function useData(
  searchTerms: Set<string>,
  doGroupTerms: boolean,
  doClusterGenes: boolean,
  doClusterTerms: boolean,
  sortBy: SortOption,
  maxFDR: number,
  maxTopTerms: number | null,
  maxMatchingOverall: number | null,
  minMatchingQuery: number,
  effectSizeThreshold: number, // TODO - not doing this anymore? It is not an option in the GeneTEA API
  handleSetInvalidGenes: (
    selections: React.SetStateAction<Set<string>>
  ) => void,
  handleSetValidGenes: (selections: React.SetStateAction<Set<string>>) => void
) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GeneTeaEnrichedTerms | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (
      searchTerms &&
      searchTerms.size >= MIN_SELECTION &&
      searchTerms.size <= MAX_SELECTION
    ) {
      setIsLoading(true);
      setError(false);
      (async () => {
        try {
          console.log(maxTopTerms);
          console.log(effectSizeThreshold);

          // HACK: GeneTEA returns an error if any searchTerm is less
          // than 2 characters long. Instead of erroring completely,
          // we want to treat these search terms the same as any other invalid
          //  term (i.e. ["SOX10", "KRAS", "NRAS", "NOT_A_GENE"] will still
          // return a response with invalid_genes = ["NOT_A_GENE"], so ["SOX10", "KRAS", "NRAS", "A"]
          // will still return a response with invalid_genes = ["A"]). Separate
          // our definitely invalid less than 2 characters out from the possiblyValidTerms
          // before sending a request to GeneTEA.
          const [
            definitelyInvalidTerms,
            possiblyValidTerms,
          ] = groupStringsByCondition(
            Array.from(searchTerms),
            (term) => term.length < 2
          );
          const fetchedData = await cached(
            legacyPortalAPI
          ).fetchGeneTeaEnrichmentExperimental(
            possiblyValidTerms,
            doGroupTerms,
            sortBy,
            maxFDR,
            maxTopTerms,
            maxMatchingOverall,
            minMatchingQuery
            // effectSizeThreshold
          );
          setData(fetchedData);

          // See HACK comment above for an explanation of why we do this.
          const invalidGenes = [
            ...definitelyInvalidTerms,
            ...fetchedData.invalidGenes,
          ];

          handleSetInvalidGenes(new Set(invalidGenes));
          handleSetValidGenes(new Set(fetchedData.validGenes));
        } catch (e) {
          setError(true);
          window.console.error(e);
        } finally {
          setIsLoading(false);
        }
      })();
    } else {
      setData(null);
      setIsLoading(false);
    }
  }, [
    searchTerms,
    doGroupTerms,
    doClusterGenes,
    doClusterTerms,
    sortBy,
    maxFDR,
    maxTopTerms,
    maxMatchingOverall,
    minMatchingQuery,
  ]);

  const xOrder = useMemo(() => {
    if (data && data.geneCluster) {
      const geneCluster = data.geneCluster;
      if (doClusterGenes) {
        return geneCluster.gene
          .map((gene, idx) => ({ gene, order: geneCluster.order[idx] }))
          .sort((a, b) => a.order - b.order)
          .map((item) => item.gene);
      }
      return [...searchTerms].filter((gene) => data.validGenes.includes(gene));
    }
    return null;
  }, [data]);

  const yOrder = useMemo(() => {
    if (data && data.termCluster && data.enrichedTerms) {
      const termCluster = data.termCluster;
      if (doClusterTerms) {
        const order = termCluster.termOrTermGroup
          .map((termOrTermGroup, idx) => ({
            termOrTermGroup,
            order: termCluster.order[idx],
          }))
          .sort((a, b) => a.order - b.order)
          .map((item) => item.termOrTermGroup);
        return [...order].reverse();
      }
      const orderByVals =
        data.groupby === "Term"
          ? data.enrichedTerms!.term
          : data.enrichedTerms!.termGroup;
      const uniqueOrderByVals = Array.from(new Set(orderByVals));
      return [...uniqueOrderByVals].reverse();
    }
    return null;
  }, [data]);

  // zOrder: values of data.termToEntity.fraction ordered by xOrder and yOrder
  const zOrder = useMemo(() => {
    if (data && data.termToEntity) {
      const termToEntity = data.termToEntity;
      const x =
        xOrder && Array.isArray(xOrder) && xOrder.length > 0
          ? xOrder
          : termToEntity.gene;
      const y =
        yOrder && Array.isArray(yOrder) && yOrder.length > 0
          ? yOrder
          : termToEntity.termOrTermGroup;
      return y.flatMap((term) =>
        x.map((gene) => {
          const idx = termToEntity.gene.findIndex(
            (g, i) => g === gene && termToEntity.termOrTermGroup[i] === term
          );
          return idx !== -1 ? termToEntity.fraction[idx] : 0;
        })
      );
    }
    return [];
  }, [data, xOrder, yOrder]);

  const heatmapData = useMemo(() => {
    if (data && data.termToEntity) {
      const xOrderArr =
        xOrder && Array.isArray(xOrder) && xOrder.length > 0
          ? xOrder
          : data.termToEntity.gene;
      const yOrderArr =
        yOrder && Array.isArray(yOrder) && yOrder.length > 0
          ? yOrder
          : data.termToEntity.termOrTermGroup;
      const zVals =
        zOrder && zOrder.length > 0 ? zOrder : data.termToEntity.fraction;
      const termToEntity = data.termToEntity;

      // Build a lookup map from (gene, term) to index
      const lookup = new Map<string, number>();
      for (let i = 0; i < termToEntity.gene.length; ++i) {
        lookup.set(
          `${termToEntity.gene[i]}|${termToEntity.termOrTermGroup[i]}`,
          i
        );
      }

      // Build flat x and y arrays matching zVals order, and customdata using the lookup
      const pairs = yOrderArr.flatMap((term) =>
        xOrderArr.map((gene) => [gene, term] as [string, string])
      );
      const x = pairs.map(([gene]) => gene);
      const y = pairs.map(([, term]) => term);
      const customdata = pairs.map(([gene, term]) => {
        const idx = lookup.get(`${gene}|${term}`);
        return idx !== undefined
          ? `<b>Gene: </b>${gene}<br><b>Term: </b>${term}<br><b>Matches: </b>${termToEntity.nTerms[idx]}`
          : "";
      });

      return {
        x,
        y,
        z: zVals,
        customdata,
      };
    } else {
      return {
        x: [],
        y: [],
        z: [],
        customdata: [],
      };
    }
  }, [data, xOrder, yOrder, zOrder]);

  const barChartData = useMemo(() => {
    if (data && data.enrichedTerms && heatmapData && heatmapData.y.length > 0) {
      // Use the unique values from heatmapData.y, preserving order
      const yOrdered = Array.from(new Set(heatmapData.y));
      // Map yOrdered to their corresponding negLogFDR values
      const ySource = doGroupTerms
        ? data.enrichedTerms.termGroup
        : data.enrichedTerms.term;
      const xSource = data.enrichedTerms.negLogFDR;
      // Build a lookup from y value to negLogFDR
      const yToX = Object.fromEntries(ySource.map((y, i) => [y, xSource[i]]));
      return {
        x: yOrdered.map((yVal) => yToX[yVal] ?? 0),
        y: yOrdered,
      };
    } else {
      return { x: [], y: [] };
    }
  }, [data, heatmapData, doGroupTerms]);

  const heatmapXAxisLabel = useMemo(() => {
    if (data && data.termToEntity) {
      return `Matching Genes in List n=(${
        new Set(data.termToEntity.gene).size
      })`;
    }

    return "";
  }, [data]);

  return {
    isLoading,
    error,
    rawData: data,
    heatmapData,
    barChartData,
    heatmapXAxisLabel,
  };
}

export default useData;
