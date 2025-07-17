import React, { useEffect, useMemo, useRef, useState } from "react";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { DENSITY_COLOR_SCALE } from "../models/types";
import { RelatedFeaturePlot } from "@depmap/types";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";

interface RelatedFeaturesCorrPlotProps {
  modelName: string;
  geneSymbol: string;
  featureNameType: string;
  feature: string;
  panelIndex: number;
  screenType: string;
  getRelatedFeaturesCorrPlotData: (
    entityLabel: string,
    identifier: string,
    model: string,
    screenType: string
  ) => Promise<RelatedFeaturePlot>;
}

const RelatedFeaturesCorrPlot = ({
  modelName,
  geneSymbol,
  featureNameType,
  feature,
  panelIndex,
  screenType,
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
    setRelatedFeaturesCorrPlotData(null);
    setRelatedFeaturesPlotElement(null);
    setIsLoading(true);
    const promise = getRelatedFeaturesCorrPlotData(
      geneSymbol,
      featureNameType,
      modelName,
      screenType
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
    return () => {
      setRelatedFeaturesCorrPlotData(null);
      setRelatedFeaturesPlotElement(null);
    };
  }, [
    featureNameType,
    geneSymbol,
    getRelatedFeaturesCorrPlotData,
    modelName,
    screenType,
  ]);

  // TODO: If isError add error message to UI
  console.log(isError);

  const formattedPlotData: any = useMemo(() => {
    if (relatedFeaturesCorrPlotData) {
      return {
        x: relatedFeaturesCorrPlotData.x,
        y: relatedFeaturesCorrPlotData.y,
        xLabel: relatedFeaturesCorrPlotData.x_label,
        yLabel: relatedFeaturesCorrPlotData.y_label,
        density: relatedFeaturesCorrPlotData.density,
        hoverText: relatedFeaturesCorrPlotData.x_index?.map(
          (x_index_label) => `${x_index_label}`
        ),
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
      hoverText: "",
    };
  }, [relatedFeaturesCorrPlotData, isLoading]);

  const selectedPoints: Set<number> | undefined = useMemo(() => {
    if (relatedFeaturesCorrPlotData) {
      const selectedPtIndex = relatedFeaturesCorrPlotData?.x_index?.indexOf(
        feature
      );
      return selectedPtIndex ? new Set<number>([selectedPtIndex]) : undefined;
    }
    return undefined;
  }, [relatedFeaturesCorrPlotData, feature]);

  return (
    <>
      {!relatedFeaturesPlotElement && <PlotSpinner height={"100%"} />}
      {!isLoading && (
        <ScatterPlot
          key={feature + "relatedFeaturesCorr" + panelIndex}
          margin={{ t: 60, l: 62, r: 150 }}
          data={formattedPlotData}
          colorVariable={[]}
          height={350}
          xKey="x"
          yKey="y"
          hoverTextKey="hoverText"
          customContinuousColorScale={DENSITY_COLOR_SCALE}
          continuousColorKey="contColorData"
          xLabel={formattedPlotData?.xLabel}
          yLabel={formattedPlotData?.yLabel}
          density={formattedPlotData?.density}
          selectedPoints={selectedPoints}
          customSelectedMarkerSymbol={"star-dot"}
          disableAnnotations
          // renderAsSvg
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
