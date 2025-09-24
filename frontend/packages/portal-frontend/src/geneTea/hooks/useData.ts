import { cached, legacyPortalAPI } from "@depmap/api";
import {
  FrequentTerms,
  GeneTeaEnrichedTerms,
} from "@depmap/types/src/experimental_genetea";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_GENES_ALLOWED, SortOption } from "../types";

// TODO: picked these numbers at random. Figure out what they should actually be.
const MIN_SELECTION = 3;
// TODO: Only keep MAX_SELECTION or MAX_GENES_ALLOWED since they're the same thing.
const MAX_SELECTION = MAX_GENES_ALLOWED; // TODO: The API will error at a certain number. Make sure this doesn't exceed that number.

function filterFrequentTerms(
  freqTerms: FrequentTerms,
  predicate: (i: number) => boolean
): FrequentTerms {
  const indices = freqTerms.term.map((_, i) => i).filter(predicate);

  return {
    term: indices.map((i) => freqTerms.term[i]),
    matchingGenesInList: indices.map((i) => freqTerms.matchingGenesInList[i]),
    nMatchingGenesOverall: indices.map(
      (i) => freqTerms.nMatchingGenesOverall[i]
    ),
    nMatchingGenesInList: indices.map((i) => freqTerms.nMatchingGenesInList[i]),
    pVal: indices.map((i) => freqTerms.pVal[i]),
    fdr: indices.map((i) => freqTerms.fdr[i]),
    stopword: indices.map((i) => freqTerms.stopword[i]),
    synonyms: indices.map((i) => freqTerms.synonyms[i]),
    totalInfo: indices.map((i) => freqTerms.totalInfo[i]),
    effectSize: indices.map((i) => freqTerms.effectSize[i]),
    enriched: indices.map((i) => freqTerms.enriched[i]),
    negLogFDR: indices.map((i) => freqTerms.negLogFDR[i]),
  };
}

function useData(
  plotSelections: Set<string>,
  specialCaseInvalidGenes: Set<string>,
  possiblyValidGenes: Set<string>,
  doGroupTerms: boolean,
  doClusterGenes: boolean,
  doClusterTerms: boolean,
  sortBy: SortOption,
  maxFDR: number,
  maxTopTerms: number | null,
  maxMatchingOverall: number | null,
  minMatchingQuery: number,
  effectSizeThreshold: number, // TODO - not doing this anymore? It is not an option in the GeneTEA API
  handleSetInValidGeneSymbols: (v: Set<string>) => void,
  handleSetValidGeneSymbols: (v: any) => void,
  handleSetIsLoading: (v: boolean) => void,
  handleSetError: (v: boolean) => void,
  handleSetErrorMessage: (v: string) => void
) {
  const [data, setData] = useState<GeneTeaEnrichedTerms | null>(null);

  const latestPromise = useRef<Promise<GeneTeaEnrichedTerms> | null>(null);

  useEffect(() => {
    const allSymbols = new Set([
      ...possiblyValidGenes,
      ...specialCaseInvalidGenes,
    ]);

    if (allSymbols.size > MAX_GENES_ALLOWED) {
      handleSetError(true);
      // TODO: Type the possible error messages.
      handleSetErrorMessage(
        `Error: Attempted to select ${allSymbols.size} genes. Gene symbol list cannot exceed 1000 genes.`
      );
      return;
    }

    handleSetError(false);

    if (
      possiblyValidGenes &&
      possiblyValidGenes.size >= MIN_SELECTION &&
      possiblyValidGenes.size <= MAX_SELECTION
    ) {
      handleSetIsLoading(true);

      const promise = cached(
        legacyPortalAPI
      ).fetchGeneTeaEnrichmentExperimental(
        Array.from(plotSelections),
        Array.from(possiblyValidGenes),
        doGroupTerms,
        sortBy,
        maxFDR,
        maxTopTerms,
        maxMatchingOverall,
        minMatchingQuery
        // effectSizeThreshold
      );

      latestPromise.current = promise;
      promise
        .then((fetchedData) => {
          if (promise === latestPromise.current) {
            setData(fetchedData);
            const invalidGenes = [
              ...specialCaseInvalidGenes,
              ...fetchedData.invalidGenes,
            ];

            handleSetInValidGeneSymbols(new Set(invalidGenes));
            handleSetValidGeneSymbols(new Set(fetchedData.validGenes));
          }
        })
        .catch((e) => {
          if (promise === latestPromise.current) {
            window.console.error(e);
            handleSetError(true);
            handleSetIsLoading(false);
          }
        })
        .finally(() => {
          if (promise === latestPromise.current) {
            handleSetIsLoading(false);
          }
        });
    } else {
      setData(null);
      handleSetInValidGeneSymbols(new Set([]));
      handleSetValidGeneSymbols(new Set([]));
      handleSetIsLoading(false);
    }
  }, [
    plotSelections,
    possiblyValidGenes,
    doGroupTerms,
    doClusterGenes,
    doClusterTerms,
    sortBy,
    maxFDR,
    maxTopTerms,
    maxMatchingOverall,
    minMatchingQuery,
    effectSizeThreshold,
    handleSetIsLoading,
    handleSetInValidGeneSymbols,
    handleSetValidGeneSymbols,
    handleSetErrorMessage,
    handleSetError,
    specialCaseInvalidGenes,
  ]);

  // If doClusterGenes is true, the GeneTEA api will return a specific order in which
  // we must display the genes (x axis).
  const xOrder = useMemo(() => {
    if (data && data.geneCluster) {
      const geneCluster = data.geneCluster;
      if (doClusterGenes) {
        return geneCluster.gene
          .map((gene, idx) => ({ gene, order: geneCluster.order[idx] }))
          .sort((a, b) => a.order - b.order)
          .map((item) => item.gene);
      }
      return [...possiblyValidGenes].filter((gene) =>
        data.validGenes.includes(gene)
      );
    }
    return null;
  }, [data, doClusterGenes, possiblyValidGenes]);

  // Keep track of the yOrder, which will determine whether we're clustering terms, and will then
  // order the y values by "Term" or "Term Group" depending on the value of data.groupby. data.groupby is
  // is part of the GeneTEA api response and is either "Term" or "Term Group". The api determines the
  // groupby value using the param we define called doGroupTerms.
  const yOrder = useMemo(() => {
    if (data && data.enrichedTerms) {
      if (doClusterTerms && data.termCluster) {
        const termCluster = data.termCluster;
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
  }, [data, doClusterTerms]);

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
      const filteredPairs = pairs.filter(([gene]) =>
        termToEntity.gene.includes(gene)
      );

      const x = filteredPairs.map(([gene]) => gene);
      const y = filteredPairs.map(([, term]) => term);

      const customdata = filteredPairs.map(([gene, term]) => {
        const idx = lookup.get(`${gene}|${term}`);
        return idx !== undefined
          ? `<b>Gene: </b>${gene}<br><b>${
              data.groupby
            }: </b>${term}<br><b>Matches: </b>${
              termToEntity.fraction[idx] * termToEntity.nTerms[idx]
            }`
          : "";
      });

      return {
        x,
        y,
        z: zVals,
        customdata,
      };
    }
    return {
      x: [],
      y: [],
      z: [],
      customdata: [],
    };
  }, [data, xOrder, yOrder, zOrder]);

  // The barchart is a bit "weird" because it needs to share the y-axis with the Heatmap, but
  // when the Heatmap y-axis is Term Groups, we want to preserve per-Term data in the bar chart via
  // bar stacking.
  const barChartData = useMemo(() => {
    if (data && data.enrichedTerms) {
      const xSource = data.enrichedTerms.negLogFDR;
      const ySource =
        data.groupby === "Term Group"
          ? data.enrichedTerms.termGroup
          : data.enrichedTerms.term;

      // Make sure the bar chart maintains the same yOrder as defined for the Heatmap above.
      const orderedY = Array.from(new Set(heatmapData.y));

      // If we are displaying term groups rather than term, ySource values for the bar chart is not equal to
      // y of the heatmap, but both sets of y values must be ordered to match the same y-axis.
      // Concretely, ySource might have y-values: ["Term Group B", "Term Group B", "Term Group A"]
      // Which if ordering by term maps to: ["Term1 from Group B", "Term 2 from Group B", "Term 1 from Group A"]
      // while the heatmap (here we called this orderedY) has values: ["Term Group A", "Term Group B"].
      //
      // The Heatmap defines the order. So sortedYSource becomes: ["Term Group A", "Term Group B", "Term Group B"]
      // sortedXSource becomes: ["Value for Term1 in Group A", "Value for Term 1 in Group B", "Value for Term 2 in Group B"].
      //
      // This lets us use a y-axis that is term groups while plotting a stacked bar chart of term data for each group.
      const combinedXY = [...ySource].map((item, index) => ({
        yVal: item,
        xVal: xSource[index],
        sortKey: orderedY.indexOf(item),
        origIndex: index,
      }));
      const sortedCombinedXY = [...combinedXY].sort(
        (a, b) => a.sortKey - b.sortKey
      );

      const sortedYSource = sortedCombinedXY.map((val) => {
        return { val: val.yVal, origIndex: val.origIndex };
      });

      const calculateStackedXValues = (
        xValues: number[],
        yValues: string[],
        sortedTermVals: string[]
      ): { x: number[]; orderedTerms: string[] } => {
        if (xValues.length !== yValues.length) {
          throw new Error("xValues and yValues must be of the same length.");
        }

        const combinedData: any = xValues.map((x, index) => ({
          x,
          y: yValues[index],
          term: sortedTermVals[index],
        }));

        // 1. Group data by y-value
        const groupedData = combinedData.reduce((acc: any, current: any) => {
          (acc[current.y] = acc[current.y] || []).push({
            x: current.x,
            term: current.term,
          });
          return acc;
        }, {} as Record<string, { x: number[]; term: string[] }>);

        const newXValues: number[] = [];
        let terms: string[] = [];

        // 2. Process each group to sort and calculate new x-values
        Object.keys(groupedData).forEach((y) => {
          const valuesForY = groupedData[y];

          // Sort the x-values for the current y-group from smallest to largest
          const sortedValuesForY = [...valuesForY].sort(
            (a: any, b: any) => a.x - b.x
          );

          const currentTerms = sortedValuesForY.map((v) => v.term);
          terms = terms.concat(currentTerms);

          let previousX = 0;

          // 3. Iterate to calculate new values
          for (const x of sortedValuesForY) {
            // Instead of graphing literal x values, we want the stacked sections to be the difference between its own -log10(FDR)
            // value and the value that was graphed before it such that the total size of the bar is equal to the highest magnitude
            // -log10(FDR) of this particular Term Group.
            const newX = x.x - previousX;
            newXValues.push(newX);
            previousX = x.x; // Store the original x as the 'previously added x' for the next iteration
          }
        });

        return { x: newXValues, orderedTerms: terms };
      };

      const sortedXSource = sortedCombinedXY.map((val) => val.xVal);
      const sortedYSourceVals = sortedYSource.map((val) => val.val);
      const sortedTermVals = sortedYSource.map(
        (val) => data.enrichedTerms!.term[val.origIndex]
      );

      const transformX = calculateStackedXValues(
        sortedXSource,
        sortedYSourceVals,
        sortedTermVals
      );

      const customdata = transformX.orderedTerms.map((currentTerm) => {
        const enrichedTermsIndex = data.enrichedTerms!.term.indexOf(
          currentTerm
        );
        const term = currentTerm;
        const termGroup = data.enrichedTerms!.termGroup[enrichedTermsIndex];
        const fdr = data.enrichedTerms!.fdr[enrichedTermsIndex];
        const negLogFDR = data.enrichedTerms!.negLogFDR[enrichedTermsIndex];
        const effectSize = data.enrichedTerms!.effectSize[enrichedTermsIndex];
        const nMatchingGenesOverall = data.enrichedTerms!.nMatchingGenesOverall[
          enrichedTermsIndex
        ];

        return term !== undefined
          ? `<b>${term}</b><br>${termGroup}<br><br>-log10(FDR):  ${negLogFDR.toFixed(
              4
            )}  <br>FDR:  ${fdr.toExponential(
              5
            )}  <br>Effect Size:  ${effectSize.toFixed(
              4
            )}  <br>n Matching Genes Overall:  ${nMatchingGenesOverall}`
          : "";
      });

      return {
        x: transformX.x,
        y: sortedYSourceVals,
        customdata,
      };
    }
    return { x: [], y: [], customdata: [] };
  }, [data, heatmapData.y]);

  const heatmapXAxisLabel = useMemo(() => {
    if (data && data.termToEntity) {
      return `Matching Genes in List n=(${
        new Set(data.termToEntity.gene).size
      })`;
    }

    return "";
  }, [data]);

  const allTermsScatterPlotData = useMemo(() => {
    if (data?.frequentTerms && data?.allEnrichedTerms) {
      const freqTerms = data.frequentTerms;
      const allTerms = data.allEnrichedTerms;
      const allEnriched = filterFrequentTerms(
        freqTerms,
        (i) => freqTerms.enriched[i] === true
      );
      const stopwords = filterFrequentTerms(
        freqTerms,
        (i) => freqTerms.enriched[i] !== true && freqTerms.stopword[i] === true
      );
      const otherTerms = filterFrequentTerms(
        freqTerms,
        (i) => freqTerms.enriched[i] !== true && freqTerms.stopword[i] !== true
      );

      function makeCustomdata(termsObj: FrequentTerms) {
        return termsObj.term.map((currentTerm) => {
          const enrichedTermsIndex = allTerms.term.indexOf(currentTerm);
          const term = currentTerm;
          const termGroup = allTerms.termGroup[enrichedTermsIndex];
          const fdr = allTerms.fdr[enrichedTermsIndex];
          const negLogFDR = allTerms.negLogFDR[enrichedTermsIndex];
          const effectSize = allTerms.effectSize[enrichedTermsIndex];
          const nMatchingGenesOverall =
            allTerms.nMatchingGenesOverall[enrichedTermsIndex];

          return term !== undefined && enrichedTermsIndex !== -1
            ? `<b>${term}</b><br>${termGroup}<br><br>-log10(FDR):  ${negLogFDR?.toFixed(
                4
              )}  <br>FDR:  ${fdr?.toExponential(
                5
              )}  <br>Effect Size:  ${effectSize?.toFixed(
                4
              )}  <br>n Matching Genes Overall:  ${nMatchingGenesOverall}`
            : "";
        });
      }

      return {
        allEnriched: {
          data: allEnriched,
          customdata: makeCustomdata(allEnriched),
        },
        stopwords: {
          data: stopwords,
          customdata: makeCustomdata(stopwords),
        },
        otherTerms: {
          data: otherTerms,
          customdata: makeCustomdata(otherTerms),
        },
      };
    }
    return null;
  }, [data]);

  return {
    specialCaseInvalidGenes,
    rawData: data,
    heatmapData,
    barChartData,
    heatmapXAxisLabel,
    allTermsScatterPlotData,
  };
}

export default useData;
