import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { RelatedFeaturePlot } from "../models/types";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";

interface PredictabilityWaterfallPlotProps {
  modelName: string;
  geneSymbol: string;
  featureNameType: string;
  feature: string;
  panelIndex: number;
  getWaterfallPlotData: (
    entityLabel: string,
    identifier: string,
    model: string
  ) => Promise<RelatedFeaturePlot>;
}

const PredictabilityWaterfallPlot = ({
  modelName,
  geneSymbol,
  featureNameType,
  feature,
  panelIndex,
  getWaterfallPlotData,
}: PredictabilityWaterfallPlotProps) => {
  const [
    waterfallPlotElement,
    setWaterfallPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  const [
    waterfallPlotData,
    setWaterfallPlotData,
  ] = useState<RelatedFeaturePlot | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const latestPromise = useRef<Promise<RelatedFeaturePlot>>();

  useEffect(() => {
    if (getWaterfallPlotData) {
      setWaterfallPlotData(null);
      setWaterfallPlotElement(null);
      setIsLoading(true);
      const promise = getWaterfallPlotData(
        geneSymbol,
        featureNameType,
        modelName
      );

      latestPromise.current = promise;
      promise
        .then((result: any) => {
          if (promise === latestPromise.current) {
            setWaterfallPlotData(result);
            setIsLoading(false);
          }
        })
        .catch((e) => {
          if (promise === latestPromise.current) {
            window.console.error(e);
            setIsError(true);
          }
        });
    }
  }, [featureNameType]);

  const waterfallPlotFormattedData: any = useMemo(() => {
    if (waterfallPlotData) {
      return {
        x: waterfallPlotData.x,
        y: waterfallPlotData.y,
        xLabel: waterfallPlotData.x_label,
        yLabel: waterfallPlotData.y_label,
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
    };
  }, [waterfallPlotData, isLoading]);

  return (
    <>
      {!waterfallPlotElement && <PlotSpinner />}
      {!isLoading && (
        <ScatterPlot
          key={feature + "waterfall" + panelIndex}
          margin={{ t: 100, l: 100, r: 150 }}
          data={waterfallPlotFormattedData}
          logOR={[]}
          height={387}
          xKey="x"
          yKey="y"
          xLabel={waterfallPlotFormattedData?.xLabel}
          yLabel={waterfallPlotFormattedData?.yLabel}
          onLoad={(element: ExtendedPlotType | null) => {
            if (element) {
              setWaterfallPlotElement(element);
            }
          }}
          showYEqualXLine={false}
        />
      )}
    </>
  );
};

export default PredictabilityWaterfallPlot;
