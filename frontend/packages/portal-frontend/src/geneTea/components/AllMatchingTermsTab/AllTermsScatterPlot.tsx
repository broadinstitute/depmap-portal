/* eslint-disable @typescript-eslint/naming-convention */
import { FrequentTerms } from "@depmap/types/src/experimental_genetea";
import React, { useCallback, useMemo } from "react";
import ScatterPlot from "./ScatterPlot";

interface Props {
  data: {
    allEnriched: FrequentTerms;
    stopwords: FrequentTerms;
    otherTerms: FrequentTerms;
  };
  handleClickPoint: (pointIndex: number) => void;
  handleSetSelectedLabels: (labels: Set<string> | null) => void;
  handleSetPlotElement: (element: any) => void;
  selectedPlotLabels: Set<string> | null;
  colorScale: string[][] | undefined;
  showYEqualXLine: boolean;
}
function AllTermsScatterPlot({
  data,
  handleClickPoint,
  handleSetSelectedLabels,
  handleSetPlotElement,
  selectedPlotLabels,
  colorScale,
  showYEqualXLine,
}: Props) {
  const plotData = useMemo(() => {
    if (!data) return null;

    return {
      stopwords: {
        x: data.stopwords.effectSize,
        y: data.stopwords.fdr, // or whatever y value you want from stopwords
        customdata: data.stopwords.customdata, // adjust as needed
      },
      otherTerms: {
        x: data.otherTerms.effectSize,
        y: data.otherTerms.fdr, // or whatever y value you want from otherTerms
        customdata: data.otherTerms.customdata,
      },
      selectedTerms: {
        x: data.selectedTerms.effectSize,
        y: data.selectedTerms.fdr, // or whatever y value you want from selectedTerms
        customdata: data.selectedTerms.customdata,
      },
    };
  }, [data]);

  return (
    <div>
      <ScatterPlot
        data={data}
        colorVariable={[]}
        height={387}
        xKey="x"
        yKey="y"
        continuousColorKey="contColorData"
        hoverTextKey="hoverText"
        xLabel={""}
        yLabel={""}
        onLoad={handleSetPlotElement}
        onClickPoint={handleClickPoint}
        customContinuousColorScale={colorScale}
      />
    </div>
  );
}

export default React.memo(AllTermsScatterPlot);
