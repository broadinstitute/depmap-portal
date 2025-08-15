import { cached, legacyPortalAPI } from "@depmap/api";
import { GeneTeaEnrichedTerms } from "@depmap/types/src/experimental_genetea";
import { useEffect, useMemo, useState } from "react";

// TODO: picked these numbers at random. Figure out what they should actually be.
const MIN_SELECTION = 3;
const MAX_SELECTION = 300; // TODO: The API will error at a certain number. Make sure this doesn't exceed that number.

function useData(
  searchTerms: Set<string>,
  doGroupTerms: boolean,
  doClusterGenes: boolean,
  doClusterTerms: boolean,
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
          const fetchedData = await cached(
            legacyPortalAPI
          ).fetchGeneTeaEnrichmentExperimental(
            [...searchTerms],
            null,
            doGroupTerms,
            doClusterGenes,
            doClusterTerms
          );
          setData(fetchedData);
          handleSetInvalidGenes(new Set(fetchedData.invalidGenes));
          handleSetValidGenes(new Set(fetchedData.validGenes));
        } catch (e) {
          setData(null);
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
  }, [searchTerms]);

  const heatmapData = useMemo(() => {
    if (data && data.termToEntity) {
      const x = data.termToEntity.gene;
      const y = data.termToEntity.term;
      const zVals = data.termToEntity.fraction;
      return {
        x,
        y,
        z: zVals,
      };
    } else {
      return {
        x: [],
        y: [],
        z: [],
      };
    }
  }, [data]);

  const barChartData = useMemo(
    () =>
      data && data.enrichedTerms
        ? { x: data.enrichedTerms.negLogFDR, y: data.enrichedTerms.termGroup }
        : { x: [], y: [] },
    [data]
  );

  const heatmapXAxisLabel = useMemo(() => {
    if (data && data.termToEntity) {
      // Get a
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
