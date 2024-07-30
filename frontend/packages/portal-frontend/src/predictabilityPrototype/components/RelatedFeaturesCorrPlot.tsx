import React, { useEffect, useMemo, useRef, useState } from "react";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { RelatedFeaturePlot } from "../models/types";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";

interface RelatedFeaturesCorrPlotProps {
  modelName: string;
  geneSymbol: string;
  featureNameType: string;
  feature: string;
  panelIndex: number;
  getRelatedFeaturesCorrPlotData: (
    entityLabel: string,
    identifier: string,
    model: string
  ) => Promise<RelatedFeaturePlot>;
}

const RelatedFeaturesCorrPlot = ({
  modelName,
  geneSymbol,
  featureNameType,
  feature,
  panelIndex,
  getRelatedFeaturesCorrPlotData,
}: RelatedFeaturesCorrPlotProps) => {
  const [
    relatedFeaturesPlotElement,
    setRelatedFeaturesPlotElement,
  ] = useState<ExtendedPlotType | null>(null);
  const [
    relatedFeaturesCorrPlotData,
    setRelatedFeaturesCorrPlotData,
  ] = useState<RelatedFeaturePlot | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const latestPromise = useRef<Promise<RelatedFeaturePlot>>();

  useEffect(() => {
    if (getRelatedFeaturesCorrPlotData) {
      setRelatedFeaturesCorrPlotData(null);
      setRelatedFeaturesPlotElement(null);
      setIsLoading(true);
      const promise = getRelatedFeaturesCorrPlotData(
        geneSymbol,
        featureNameType,
        modelName
      );

      latestPromise.current = promise;
      promise
        .then((result: any) => {
          if (promise === latestPromise.current) {
            setRelatedFeaturesCorrPlotData(result);
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
  }, [featureNameType, geneSymbol, getRelatedFeaturesCorrPlotData, modelName]);

  // TODO: If isError add error message to UI
  console.log(isError)

  const formattedPlotData: any = useMemo(() => {
    if (relatedFeaturesCorrPlotData) {
      return {
        x: relatedFeaturesCorrPlotData.x,
        y: relatedFeaturesCorrPlotData.y,
        xLabel: relatedFeaturesCorrPlotData.x_label,
        yLabel: relatedFeaturesCorrPlotData.y_label,
        density: relatedFeaturesCorrPlotData.density,
      };
    }

    if (isLoading && !relatedFeaturesCorrPlotData) {
      return null;
    }

    return {
      x: [],
      y: [],
      xLabel: "",
      yLabel: "",
    };
  }, [relatedFeaturesCorrPlotData, isLoading]);

  return (
    <>
      {!relatedFeaturesPlotElement && <PlotSpinner />}
      {!isLoading && (
        <ScatterPlot
          key={feature + "relatedFeaturesCorr" + panelIndex}
          margin={{ t: 60, l: 62, r: 150 }}
          data={formattedPlotData}
          logOR={[]}
          height={350}
          xKey="x"
          yKey="y"
          continuousColorKey="contColorData"
          xLabel={formattedPlotData?.xLabel}
          yLabel={formattedPlotData?.yLabel}
          density={formattedPlotData?.density}
          onLoad={(element: ExtendedPlotType | null) => {
            if (element) {
              setRelatedFeaturesPlotElement(element);
            }
          }}
          showYEqualXLine={false}
        />
      )}
    </>
  );
};

export default RelatedFeaturesCorrPlot;
