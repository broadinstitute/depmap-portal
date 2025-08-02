import React, { useEffect, useMemo, useState } from "react";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import {
  PredictiveModelData,
  RelatedFeaturePlot,
  SliceQuery,
} from "@depmap/types";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { breadboxAPI, cached } from "@depmap/api";
import { computeAssociations } from "@depmap/api/src/breadboxAPI/resources/temp";

// interface PredictabilityWaterfallPlotProps {
// }

interface PredictabilityWaterfallPlotProps {
  givenId: string;
  datasetId: string;
  actualsDatasetId: string;
}

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
  ] = useState<RelatedFeaturePlot | null>(null);

  useEffect(() => {
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
        console.log("ignoring retreived correlations", correlations);
        setWaterfallPlotData({
          x: [0, 1],
          x_index: ["0", "1"],
          y: [0.1, 1.1],
          y_index: ["0", "1"],
          x_label: "xaxis",
          y_label: "yaxis",
        });
        setIsLoading(false);
      })
      .catch((err: any) => {
        console.log(err);
        setError(`${err}`);
        setIsLoading(false);
      });
  });

  const waterfallPlotFormattedData: any = useMemo(() => {
    if (waterfallPlotData) {
      return {
        x: waterfallPlotData.x,
        y: waterfallPlotData.y,
        xLabel: waterfallPlotData.x_label,
        yLabel: waterfallPlotData.y_label,
        hoverText: waterfallPlotData.y_index,
      };
    }

    if (isLoading && !waterfallPlotData) {
      return null;
    }

    return {
      x: [],
      y: [],
      xLabel: "",
      yLabel: "",
      hoverText: "",
    };
  }, [isLoading, waterfallPlotData]);

  return (
    <>
      {isLoading && <PlotSpinner height={"100%"} />}
      {!isLoading && error && <div>{error}</div>}
      {!isLoading &&
        waterfallPlotFormattedData(
          <ScatterPlot
            margin={{ t: 80, l: 80, r: 80 }}
            data={waterfallPlotFormattedData}
            colorVariable={[]}
            height={350}
            xKey="x"
            yKey="y"
            hoverTextKey="hoverText"
            xLabel={waterfallPlotFormattedData?.xLabel}
            yLabel={waterfallPlotFormattedData?.yLabel}
            // onLoad={(element: ExtendedPlotType | null) => {
            //   if (element) {
            //     setWaterfallPlotElement(element);
            //   }
            // }}
            showYEqualXLine={false}
            // renderAsSvg
          />
        )}
    </>
  );
};

export default PredictabilityWaterfallPlot;
