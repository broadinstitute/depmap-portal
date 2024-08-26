import React, { useEffect, useMemo, useRef, useState } from "react";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";
import BoxPlot from "src/plot/components/BoxPlot";

interface PredictabilityBoxPlotProps {
  modelName: string;
  geneSymbol: string;
  featureNameType: string;
  featureType: string;
  featureName: string;
  panelIndex: number;
  screenType: string;
  getPredictabilityBoxPlotData: (
    identifier: string,
    entityLabel: string,
    model: string,
    screenType: string
  ) => Promise<number[]>;
}

const PredictabilityBoxPlot = ({
  modelName,
  geneSymbol,
  featureNameType,
  featureName,
  featureType,
  panelIndex,
  screenType,
  getPredictabilityBoxPlotData,
}: PredictabilityBoxPlotProps) => {
  const [boxPlotElement, setBoxPlotElement] = useState<ExtendedPlotType | null>(
    null
  );
  const [plotData, setPlotData] = useState<number[] | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const latestPromise = useRef<Promise<number[]>>();

  useEffect(() => {
    setPlotData(null);
    setBoxPlotElement(null);
    setIsLoading(true);
    const promise = getPredictabilityBoxPlotData(
      featureNameType,
      geneSymbol,
      modelName,
      screenType
    );

    latestPromise.current = promise;
    promise
      .then((result: any) => {
        if (promise === latestPromise.current) {
          setPlotData(result);
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
      setPlotData(null);
      setBoxPlotElement(null);
    };
  }, [
    featureNameType,
    featureName,
    featureType,
    getPredictabilityBoxPlotData,
    modelName,
  ]);
  console.log(isError);
  console.log(geneSymbol);

  const boxPlotData: any = useMemo(() => {
    const data = plotData;
    if (data) {
      return {
        name: "CCLE",
        vals: data,
        color: { r: 139, g: 0, b: 0 },
        lineColor: "#000000",
      };
    }

    if (isLoading && !data) {
      return null;
    }

    return {
      name: "",
      hoverLabels: [],
      xVals: [],
      color: { r: 255, g: 140, b: 0 },
      lineColor: "#000000",
    };
  }, [plotData, isLoading]);

  return (
    <>
      {!boxPlotElement && <PlotSpinner height={"100%"} />}
      {!isLoading && (
        <BoxPlot
          key={featureName + "boxplot" + panelIndex}
          plotName={"Plot Title"}
          boxData={[boxPlotData]}
          showUnderlyingPoints={false}
          showDottedLines={false}
          orientation={"v"}
          plotHeight={350}
          bottomMargin={60}
          topMargin={60}
          onLoad={(element: ExtendedPlotType | null) => {
            if (element) {
              setBoxPlotElement(element);
            }
          }}
        />
      )}
    </>
  );
};

export default PredictabilityBoxPlot;
