import React, { useEffect, useMemo, useRef, useState } from "react";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import PlotSpinner from "src/plot/components/PlotSpinner";
import BoxPlot from "src/plot/components/BoxPlot";
import BarChart from "src/plot/components/BarChart";

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

const PredictabilityBoxOrBarPlot = ({
  modelName,
  geneSymbol,
  featureNameType,
  featureName,
  featureType,
  panelIndex,
  screenType,
  getPredictabilityBoxPlotData,
}: PredictabilityBoxPlotProps) => {
  const [
    boxOrBarPlotElement,
    setBoxOrBarPlotElement,
  ] = useState<ExtendedPlotType | null>(null);
  const [boxPlotData, setBoxPlotData] = useState<number[] | null>(null);
  const [barPlotData, setBarPlotData] = useState<{
    fraction_0: number;
    fraction_1: number;
  } | null>(null);
  const [isBinary, setIsBinary] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const latestPromise = useRef<Promise<number[]>>();

  useEffect(() => {
    setBoxPlotData(null);
    setBarPlotData(null);
    setBoxOrBarPlotElement(null);
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
          console.log({ result });
          if (result.is_binary) {
            setBarPlotData(result.data);
          } else {
            setBoxPlotData(result.data);
          }
          setIsBinary(result.is_binary);
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
      setBoxPlotData(null);
      setBoxOrBarPlotElement(null);
    };
  }, [
    featureNameType,
    featureName,
    featureType,
    getPredictabilityBoxPlotData,
    modelName,
    geneSymbol,
    screenType,
  ]);
  console.log(isError);
  console.log(geneSymbol);

  const formattedBoxPlotData: any = useMemo(() => {
    if (boxPlotData && !isBinary) {
      return {
        name: "DepMap Models",
        vals: boxPlotData,
        color: { r: 139, g: 0, b: 0 },
        lineColor: "#000000",
      };
    }

    if (isLoading && !boxPlotData) {
      return null;
    }

    return {
      name: "",
      hoverLabels: [],
      xVals: [],
      color: { r: 255, g: 140, b: 0 },
      lineColor: "#000000",
    };
  }, [boxPlotData, isBinary, isLoading]);

  return (
    <>
      {!boxOrBarPlotElement && <PlotSpinner height={"100%"} />}
      {boxPlotData && !isLoading && (
        <BoxPlot
          key={featureName + "boxplot" + panelIndex}
          plotName={"Plot Title"}
          boxData={[formattedBoxPlotData]}
          showUnderlyingPoints={false}
          showDottedLines={false}
          orientation={"v"}
          plotHeight={350}
          bottomMargin={60}
          topMargin={60}
          onLoad={(element: ExtendedPlotType | null) => {
            if (element) {
              setBoxOrBarPlotElement(element);
            }
          }}
        />
      )}
      {barPlotData && !isLoading && (
        <BarChart
          title={"test"}
          categoryLabels={["Percent 0", "Percent 1"]}
          categoryValues={[barPlotData.fraction_0, barPlotData.fraction_1]}
          height={360}
          customColors={["#86BDB5", "#2FA9D0"]}
          orientation="v"
          margin={{
            l: 100,

            r: 20,

            b: 60,

            t: 0,

            pad: 0,
          }}
          onLoad={(element: ExtendedPlotType | null) => {
            if (element) {
              setBoxOrBarPlotElement(element);
            }
          }}
        />
      )}
    </>
  );
};

export default PredictabilityBoxOrBarPlot;
