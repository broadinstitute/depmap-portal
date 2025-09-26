/* eslint-disable @typescript-eslint/naming-convention */
import { GeneTeaScatterPlotData } from "@depmap/types/src/experimental_genetea";
import React, { useMemo } from "react";
import ScatterPlot from "./ScatterPlot";
import { useAllTermsContext } from "src/geneTea/context/AllTermsContext";
import { useEffect } from "react";

interface Props {
  data: GeneTeaScatterPlotData | null; // TODO simplify this. We only need x (Effect Size) and y (fdr)
  handleSetPlotElement: (element: any) => void;
}
function AllTermsScatterPlot({ data, handleSetPlotElement }: Props) {
  const { handleSetPlotOrTableSelectedTerms } = useAllTermsContext();

  const plotData = useMemo(() => {
    if (!data) {
      return {
        stopwords: {
          indexLabels: [],
          x: [],
          y: [], // or whatever y value you want from stopwords
          customdata: [], // adjust as needed
        },
        otherTerms: {
          indexLabels: [],
          x: [],
          y: [], // or whatever y value you want from otherTerms
          customdata: [],
        },
        selectedTerms: {
          indexLabels: [],
          x: [],
          y: [], // or whatever y value you want from selectedTerms
          customdata: [],
        },
      };
    }

    return {
      stopwords: {
        indexLabels: data.stopwords.data.term,
        x: data.stopwords.data.effectSize,
        y: data.stopwords.data.negLogFDR, // or whatever y value you want from stopwords
        customdata: data.stopwords.customdata, // adjust as needed
      },
      otherTerms: {
        indexLabels: data.otherTerms.data.term,
        x: data.otherTerms.data.effectSize,
        y: data.otherTerms.data.negLogFDR, // or whatever y value you want from otherTerms
        customdata: data.otherTerms.customdata,
      },
      selectedTerms: {
        indexLabels: data.allEnriched.data.term,
        x: data.allEnriched.data.effectSize,
        y: data.allEnriched.data.negLogFDR, // or whatever y value you want from selectedTerms
        customdata: data.allEnriched.customdata,
      },
    };
  }, [data]);

  return (
    <div>
      <ScatterPlot
        data={plotData}
        height={387}
        xLabel={"Effect Size"}
        yLabel={"-log10(FDR)"}
        onLoad={handleSetPlotElement}
        onClickPoint={handleSetPlotOrTableSelectedTerms}
      />
    </div>
  );
}

export default React.memo(AllTermsScatterPlot);
