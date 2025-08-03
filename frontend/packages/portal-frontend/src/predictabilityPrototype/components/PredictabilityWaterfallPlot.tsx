import React, { useEffect, useState } from "react";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
// import {
// PredictiveModelData,
// RelatedFeaturePlot,
// SliceQuery,
// } from "@depmap/types";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
// import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { breadboxAPI, cached } from "@depmap/api";

interface PredictabilityWaterfallPlotProps {
  givenId: string;
  datasetId: string;
  actualsDatasetId: string;
}

const Loading = () => {
  return <PlotSpinner height={"100%"} />;
};

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
  // const [
  //   waterfallPlotElement,
  //   setWaterfallPlotElement,
  // ] = useState<ExtendedPlotType | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [
    waterfallPlotData,
    setWaterfallPlotData,
  ] = useState<WaterfallPlotData | null>(null);

  useEffect(() => {
    // fix this -- if error, keeps retrying
    if (!isLoading && waterfallPlotData == null) {
      setIsLoading(true);

      cached(breadboxAPI)
        .computeAssociations({
          dataset_id: actualsDatasetId,
          slice_query: {
            dataset_id: datasetId,
            identifier_type: "feature_id",
            identifier: givenId,
          },
        })
        .then((correlations) => {
          const rank: number[] = Array.from(
            { length: correlations.cor.length },
            (_, i: number) => i
          );
          setWaterfallPlotData({
            x: rank,
            y: correlations.cor,
            hoverText: correlations.label,
            xLabel: "rank",
            yLabel: "correlation",
          });
          setIsLoading(false);
        })
        .catch((err: any) => {
          console.log(err);
          setError(`${err}`);
          setIsLoading(false);
        });
    }
  }, [waterfallPlotData, isLoading, givenId, actualsDatasetId, datasetId]);

  if (waterfallPlotData != null) {
    return (
      <PredictabilityWaterfallPlotChild waterfallPlotData={waterfallPlotData} />
    );
  }

  if (error != null) {
    return <div>Error: {error}</div>;
  }

  return <Loading />;
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
