/* eslint-disable @typescript-eslint/naming-convention */
import { GeneTeaScatterPlotData } from "@depmap/types/src/experimental_genetea";
import React, { useCallback, useMemo } from "react";
import ScatterPlot from "./ScatterPlot";

interface Props {
  data: GeneTeaScatterPlotData | null; // TODO simplify this. We only need x (Effect Size) and y (fdr)
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
        x: data.stopwords.data.effectSize,
        y: data.stopwords.data.fdr, // or whatever y value you want from stopwords
        customdata: data.stopwords.customdata, // adjust as needed
      },
      otherTerms: {
        x: data.otherTerms.data.effectSize,
        y: data.otherTerms.data.fdr, // or whatever y value you want from otherTerms
        customdata: data.otherTerms.customdata,
      },
      selectedTerms: {
        x: data.selectedTerms.data.effectSize,
        y: data.selectedTerms.data.fdr, // or whatever y value you want from selectedTerms
        customdata: data.selectedTerms.data.customdata,
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
