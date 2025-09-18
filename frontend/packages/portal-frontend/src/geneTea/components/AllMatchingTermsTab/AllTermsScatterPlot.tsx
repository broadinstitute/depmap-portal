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
  //   const scatterPlotData = useMemo(() => {
  //     // x is Effect Size
  //     // Y is negLogFDR

  //     // return {
  //     // stopwords: {
  //     //   x: data.stopwords.effectSize,
  //     //   y: data.stopwords.,
  //     //   customdata: any;
  //     // };
  //     // otherTerms: {
  //     //   x: number[];
  //     //   y: number;
  //     //   customdata: any;
  //     // };
  //     // selectedTerms: {
  //     //   x: number[];
  //     //   y: number;
  //     //   customdata: any;
  //     // };
  //   // };
  //   }

  //   }, []);

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
