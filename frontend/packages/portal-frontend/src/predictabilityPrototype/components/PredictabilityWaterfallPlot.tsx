import React, { useCallback } from "react";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import { breadboxAPI, cached } from "@depmap/api";
import { AsyncPlot } from "./AsyncPlot";

interface PredictabilityWaterfallPlotProps {
  givenId: string;
  datasetId: string;
  actualsDatasetId: string;
}

export const PredictabilityWaterfallPlotChild = ({
  waterfallPlotData,
}: PredictabilityWaterfallPlotChildProps) => {
  console.log("waterfallPlotData", waterfallPlotData);

  return (
    <ScatterPlot
      margin={{ t: 80, l: 80, r: 80 }}
      data={waterfallPlotData as any}
      colorVariable={[]}
      height={350}
      xKey="x"
      yKey="y"
      hoverTextKey="hoverText"
      xLabel={waterfallPlotData?.xLabel}
      yLabel={waterfallPlotData?.yLabel}
      // onLoad={(element: ExtendedPlotType | null) => {
      //   if (element) {
      //     setWaterfallPlotElement(element);
      //   }
      // }}
      showYEqualXLine={false}
      // renderAsSvg
    />
  );
};

const PredictabilityWaterfallPlot = ({
  givenId,
  datasetId,
  actualsDatasetId,
}: PredictabilityWaterfallPlotProps) => {
  const loader = useCallback(async () => {
    const correlations = await cached(breadboxAPI).computeAssociations({
      dataset_id: actualsDatasetId,
      slice_query: {
        dataset_id: datasetId,
        identifier_type: "feature_id",
        identifier: givenId,
      },
    });

    const rank: number[] = Array.from(
      { length: correlations.cor.length },
      (_, i: number) => i
    );

    return {
      waterfallPlotData: {
        x: rank,
        y: correlations.cor,
        hoverText: correlations.label,
        xLabel: "rank",
        yLabel: "correlation",
      },
    };

    // });
  }, [actualsDatasetId, givenId, datasetId]);

  return (
    <AsyncPlot
      loader={loader}
      childComponent={PredictabilityWaterfallPlotChild}
    />
  );
};

interface WaterfallPlotData {
  x: number[];
  y: number[];
  xLabel: string;
  yLabel: string;
  hoverText: string[];
}

interface PredictabilityWaterfallPlotChildProps {
  waterfallPlotData: WaterfallPlotData;
}

export default PredictabilityWaterfallPlot;
