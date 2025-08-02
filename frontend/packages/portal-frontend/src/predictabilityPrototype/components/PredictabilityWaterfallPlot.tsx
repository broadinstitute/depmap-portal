import React, { useMemo, useState } from "react";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { RelatedFeaturePlot } from "@depmap/types";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";

// interface PredictabilityWaterfallPlotProps {
// }

const waterfallPlotData: RelatedFeaturePlot = {
  x: [0, 1],
  x_index: ["0", "1"],
  y: [0.1, 1.1],
  y_index: ["0", "1"],
  x_label: "xaxis",
  y_label: "yaxis",
};

const PredictabilityWaterfallPlot = () => {
  const [
    waterfallPlotElement,
    setWaterfallPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  const isLoading = false;

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
  }, [isLoading]);

  return (
    <>
      {!waterfallPlotElement && <PlotSpinner height={"100%"} />}
      {!isLoading && (
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
          onLoad={(element: ExtendedPlotType | null) => {
            if (element) {
              setWaterfallPlotElement(element);
            }
          }}
          showYEqualXLine={false}
          // renderAsSvg
        />
      )}
    </>
  );
};

export default PredictabilityWaterfallPlot;
