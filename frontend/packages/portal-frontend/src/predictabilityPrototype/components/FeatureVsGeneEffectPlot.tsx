import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { FeatureVsGeneEffectPlotData } from "../models/types";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { getDataExplorerUrl } from "../utils";
import { Button } from "react-bootstrap";

interface FeatureVsGeneEffectPlotProps {
  modelName: string;
  geneSymbol: string;
  featureNameType: string;
  feature: string;
  featureDatasetLabel: string;
  featureType: string;
  panelIndex: number;
  screenType: string;
  getFeatureVsGeneEffectData: (
    identifier: string,
    featureIndex: number,
    entityLabel: string,
    model: string,
    screenType: string
  ) => Promise<FeatureVsGeneEffectPlotData>;
}

const FeatureVsGeneEffectPlot = ({
  modelName,
  geneSymbol,
  featureNameType,
  featureType,
  featureDatasetLabel,
  feature,
  panelIndex,
  screenType,
  getFeatureVsGeneEffectData,
}: FeatureVsGeneEffectPlotProps) => {
  const [
    featureVsGeneEffectPlotElement,
    setFeatureVsGeneEffectPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  const [
    featureVsGeneEffectData,
    setFeatureVsGeneEffectData,
  ] = useState<FeatureVsGeneEffectPlotData | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const latestPromise = useRef<Promise<FeatureVsGeneEffectPlotData>>();

  useEffect(() => {
    setFeatureVsGeneEffectData(null);
    setFeatureVsGeneEffectPlotElement(null);
    setIsLoading(true);
    const promise = getFeatureVsGeneEffectData(
      featureNameType,
      panelIndex,
      geneSymbol,
      modelName,
      screenType
    );

    latestPromise.current = promise;
    promise
      .then((result: any) => {
        if (promise === latestPromise.current) {
          setFeatureVsGeneEffectData(result);
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
      setFeatureVsGeneEffectData(null);
      setFeatureVsGeneEffectPlotElement(null);
    };
  }, [
    featureNameType,
    feature,
    featureType,
    geneSymbol,
    getFeatureVsGeneEffectData,
    modelName,
    panelIndex,
    screenType,
  ]);

  console.log(isError);

  const formattedPlotData: any = useMemo(() => {
    if (featureVsGeneEffectData?.actuals_slice) {
      return {
        x: featureVsGeneEffectData.feature_actuals_values,
        y: featureVsGeneEffectData.actuals_slice,
        density: featureVsGeneEffectData.density,
        xLabel: featureVsGeneEffectData?.x_axis_label,
        yLabel: featureVsGeneEffectData?.y_axis_label,
      };
    }

    if (isLoading && !featureVsGeneEffectData) {
      return null;
    }

    return {
      x: [],
      y: [],
      xLabel: "",
      yLabel: "",
      hoverText: "",
    };
  }, [featureVsGeneEffectData, isLoading]);

  return (
    <>
      {!featureVsGeneEffectPlotElement && <PlotSpinner height={"100%"} />}
      {formattedPlotData && formattedPlotData.x?.length > 0 && (
        <ScatterPlot
          key={feature}
          margin={{ t: 60, l: 62, r: 100 }}
          data={formattedPlotData}
          logOR={[]}
          height={350}
          xKey="x"
          yKey="y"
          continuousColorKey="contColorData"
          // hoverTextKey="hoverText"
          xLabel={formattedPlotData?.xLabel}
          yLabel={formattedPlotData?.yLabel}
          density={formattedPlotData?.density}
          onLoad={(element: ExtendedPlotType | null) => {
            if (element) {
              setFeatureVsGeneEffectPlotElement(element);
            }
          }}
          showYEqualXLine={false}
        />
      )}

      {featureVsGeneEffectData && !isLoading && (
        <div className={styles.deButtonContainer}>
          <Button
            className={styles.deButton}
            href={getDataExplorerUrl(
              featureVsGeneEffectData.feature_dataset_id,
              feature,
              featureDatasetLabel,
              geneSymbol,
              screenType,
              []
            )}
            target="_blank"
            disabled={!formattedPlotData && isLoading}
          >
            Open Plot in Data Explorer
          </Button>
        </div>
      )}
    </>
  );
};

export default FeatureVsGeneEffectPlot;