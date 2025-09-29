/* eslint-disable @typescript-eslint/naming-convention */
import { GeneTeaScatterPlotData } from "@depmap/types/src/experimental_genetea";
import React, { useMemo, useState } from "react";
import ScatterPlot from "./ScatterPlot";
import { useAllTermsContext } from "src/geneTea/context/AllTermsContext";
import GeneTeaContextModal from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/integrations/GeneTea/GeneTeaContextModal";

interface Props {
  data: GeneTeaScatterPlotData | null; // TODO simplify this. We only need x (Effect Size) and y (fdr)
  handleSetPlotElement: (element: any) => void;
}
function AllTermsScatterPlot({ data, handleSetPlotElement }: Props) {
  const { selectedPlotOrTableTerms } = useAllTermsContext();

  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  const plotData = useMemo(() => {
    if (!data) {
      return {
        stopwords: {
          indexLabels: [],
          x: [],
          y: [],
          matchingGenes: [],
          customdata: [],
        },
        otherTerms: {
          indexLabels: [],
          x: [],
          y: [],
          matchingGenes: [],
          customdata: [],
        },
        selectedTerms: {
          indexLabels: [],
          x: [],
          y: [],
          matchingGenes: [],
          customdata: [],
        },
        allEnrichedTerms: {
          indexLabels: [],
          x: [],
          y: [],
          matchingGenes: [],
          customdata: [],
        },
        enrichedTerms: {
          indexLabels: [],
          x: [],
          y: [],
          matchingGenes: [],
          customdata: [],
        },
      };
    }

    // If no selection, all terms are selectedTerms, enrichedTerms is empty
    if (!selectedPlotOrTableTerms || selectedPlotOrTableTerms.size === 0) {
      return {
        stopwords: {
          indexLabels: data.stopwords.data.term,
          x: data.stopwords.data.effectSize,
          y: data.stopwords.data.negLogFDR,
          matchingGenes: data.stopwords.data.matchingGenesInList,
          customdata: data.stopwords.customdata,
        },
        otherTerms: {
          indexLabels: data.otherTerms.data.term,
          x: data.otherTerms.data.effectSize,
          y: data.otherTerms.data.negLogFDR,
          matchingGenes: data.otherTerms.data.matchingGenesInList,
          customdata: data.otherTerms.customdata,
        },
        selectedTerms: {
          indexLabels: data.allEnriched.data.term,
          x: data.allEnriched.data.effectSize,
          y: data.allEnriched.data.negLogFDR,
          matchingGenes: data.allEnriched.data.matchingGenesInList,
          customdata: data.allEnriched.customdata,
        },
        enrichedTerms: {
          indexLabels: data.allEnriched.data.term,
          x: data.allEnriched.data.effectSize,
          y: data.allEnriched.data.negLogFDR,
          matchingGenes: data.allEnriched.data.matchingGenesInList,
          customdata: data.allEnriched.customdata,
        },
      };
    }

    // Helper to build a lookup for each group
    function buildLookup(
      terms: string[],
      effectSize: number[],
      negLogFDR: number[],
      customdata: any[]
    ) {
      const out: Record<
        string,
        { effectSize: number; negLogFDR: number; customdata: any }
      > = {};
      for (let i = 0; i < terms.length; ++i) {
        out[terms[i]] = {
          effectSize: effectSize[i],
          negLogFDR: negLogFDR[i],
          customdata: customdata[i],
        };
      }
      return out;
    }

    const stopwordsLookup = buildLookup(
      data.stopwords.data.term,
      data.stopwords.data.effectSize,
      data.stopwords.data.negLogFDR,
      data.stopwords.customdata
    );
    const otherTermsLookup = buildLookup(
      data.otherTerms.data.term,
      data.otherTerms.data.effectSize,
      data.otherTerms.data.negLogFDR,
      data.otherTerms.customdata
    );
    const allEnrichedLookup = buildLookup(
      data.allEnriched.data.term,
      data.allEnriched.data.effectSize,
      data.allEnriched.data.negLogFDR,
      data.allEnriched.customdata
    );

    // Partition logic: track original group for each term
    const stopwordsSet = new Set(data.stopwords.data.term);
    const otherTermsSet = new Set(data.otherTerms.data.term);
    const allEnrichedSet = new Set(data.allEnriched.data.term);

    // Helper to build group data
    function buildGroup(
      terms: string[],
      lookup: Record<
        string,
        { effectSize: number; negLogFDR: number; customdata: any }
      >,
      filter: (t: string) => boolean
    ) {
      const out = {
        indexLabels: [] as string[],
        x: [] as number[],
        y: [] as number[],
        customdata: [] as any[],
        matchingGenes: [] as string[],
      };
      for (const t of terms) {
        if (filter(t)) {
          out.indexLabels.push(t);
          out.x.push(lookup[t].effectSize);
          out.y.push(lookup[t].negLogFDR);
          out.customdata.push(lookup[t].customdata);
          out.matchingGenes.push(lookup[t].customdata);
        }
      }
      return out;
    }

    // Selected terms: any selected term from any group
    const selectedPlotTerms = buildGroup(
      [...stopwordsSet, ...otherTermsSet, ...allEnrichedSet],
      { ...stopwordsLookup, ...otherTermsLookup, ...allEnrichedLookup },
      (t) => selectedPlotOrTableTerms.has(t)
    );

    // enrichedTerms: unselected terms that are in allEnriched
    const enrichedTerms = buildGroup(
      data.allEnriched.data.term,
      allEnrichedLookup,
      (t) => !selectedPlotOrTableTerms.has(t)
    );

    // stopwords: unselected terms that are in stopwords
    const stopwords = buildGroup(
      data.stopwords.data.term,
      stopwordsLookup,
      (t) => !selectedPlotOrTableTerms.has(t)
    );

    // otherTerms: unselected terms that are in otherTerms
    const otherTerms = buildGroup(
      data.otherTerms.data.term,
      otherTermsLookup,
      (t) => !selectedPlotOrTableTerms.has(t)
    );

    return {
      stopwords,
      otherTerms,
      selectedTerms: selectedPlotTerms,
      enrichedTerms,
    };
  }, [data, selectedPlotOrTableTerms]);

  return (
    <div>
      <ScatterPlot
        data={plotData}
        height={500}
        xLabel={"Effect Size"}
        yLabel={"-log10(FDR)"}
        onLoad={handleSetPlotElement}
        onClickPoint={(term: string) => setSelectedTerm(term)}
      />

      <GeneTeaContextModal
        show={Boolean(selectedTerm)}
        term={selectedTerm || ""}
        synonyms={[]}
        coincident={[]}
        matchingGenes={[]}
        onClose={() => setSelectedTerm(null)}
      />
    </div>
  );
}

export default React.memo(AllTermsScatterPlot);
