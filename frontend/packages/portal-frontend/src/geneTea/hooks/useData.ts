import { cached, legacyPortalAPI } from "@depmap/api";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";
import { useEffect, useMemo, useRef, useState } from "react";
import { SortOption } from "../types";

// TODO: picked these numbers at random. Figure out what they should actually be.
const MIN_SELECTION = 3;
const MAX_SELECTION = 300; // TODO: The API will error at a certain number. Make sure this doesn't exceed that number.

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
  handleSetIsLoading: (v: boolean) => void
) {
  const [data, setData] = useState<GeneTeaEnrichedTerms | null>(null);
  const [error, setError] = useState(false);

  const latestPromise = useRef<Promise<GeneTeaEnrichedTerms> | null>(null);

  useEffect(() => {
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
            // See HACK comment above for an explanation of why we do this.
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
            setError(true);
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
    specialCaseInvalidGenes,
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
      return [...possiblyValidGenes].filter((gene) =>
        data.validGenes.includes(gene)
      );
    }
    return null;
  }, [data, doClusterGenes, possiblyValidGenes]);

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
          ? `<b>Gene: </b>${gene}<br><b>Term: </b>${term}<br><b>Matches: </b>${termToEntity.nTerms[idx]}`
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

  const barChartData = useMemo(() => {
    if (data && data.enrichedTerms && data.termToEntity) {
      const xSource = data.enrichedTerms.negLogFDR;
      const ySource = doGroupTerms
        ? data.enrichedTerms.termGroup
        : data.enrichedTerms.term;

      // Look at the Heatmap y-axis order. If the y-ais is term groups, this array
      // could be fewer in number compared to ySource.
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

      const sortedYSource = doGroupTerms
        ? sortedCombinedXY.map((val) => {
            return { val: val.yVal, origIndex: val.origIndex };
          })
        : orderedY.map((val, i) => {
            return { val, origIndex: i };
          });

      console.log("sortedYSource", sortedYSource);
      const calculateStackedXValues = (
        xValues: number[],
        yValues: string[]
      ): number[] => {
        if (xValues.length !== yValues.length) {
          throw new Error("xValues and yValues must be of the same length.");
        }

        const combinedData: any = xValues.map((x, index) => ({
          x,
          y: yValues[index],
        }));

        // 1. Group data by y-value
        const groupedData = combinedData.reduce((acc: any, current: any) => {
          (acc[current.y] = acc[current.y] || []).push(current.x);
          return acc;
        }, {} as Record<string, number[]>);

        const newXValues: number[] = [];

        // 2. Process each group to sort and calculate new x-values
        Object.keys(groupedData).forEach((y) => {
          const valuesForY = groupedData[y];

          // Sort the x-values for the current y-group from smallest to largest
          valuesForY.sort((a: any, b: any) => a - b);

          let previousX = 0;

          // 3. Iterate to calculate new values
          for (const x of valuesForY) {
            const newX = x - previousX;
            newXValues.push(newX);
            previousX = x; // Store the original x as the 'previously added x' for the next iteration
          }
        });

        return newXValues;
      };

      const sortedXSource = doGroupTerms
        ? sortedCombinedXY.map((val) => val.xVal)
        : xSource;

      const customdata = sortedYSource.map((termOrTermGroup, i) => {
        const term = doGroupTerms
          ? data.enrichedTerms!.term[termOrTermGroup.origIndex]
          : termOrTermGroup.val;
        return term !== undefined
          ? `<b>Term: </b>${term}<br>-log10(FDR): </b>${sortedXSource[
              i
            ].toFixed(4)}`
          : "";
      });

      const sortedYSourceVals = sortedYSource.map((val) => val.val);

      const transformX = calculateStackedXValues(
        sortedXSource,
        sortedYSourceVals
      );

      return {
        x: transformX,
        y: sortedYSourceVals,
        customdata,
      };
    }
    return { x: [], y: [], customdata: [] };
  }, [data, doGroupTerms, heatmapData.y]);

  const heatmapXAxisLabel = useMemo(() => {
    if (data && data.termToEntity) {
      return `Matching Genes in List n=(${
        new Set(data.termToEntity.gene).size
      })`;
    }

    return "";
  }, [data]);

  return {
    error,
    specialCaseInvalidGenes,
    rawData: data,
    heatmapData,
    barChartData,
    heatmapXAxisLabel,
  };
}

export default useData;
