import React, { useEffect, useMemo, useRef, useState } from "react";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import PrototypeCorrelationHeatmap from "src/data-explorer-2/components/plot/prototype/PrototypeCorrelationHeatmap";
import PlotSpinner from "src/plot/components/PlotSpinner";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { PredictiveModelData } from "../models/types";
import { Button } from "react-bootstrap";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import { getDataExplorerUrl } from "../utils";

export interface ModelPerformancePlotsProps {
  modelName: string;
  entityLabel: string;
  screenType: string;
  getModelPerformanceData: (
    entityLabel: string,
    model: string,
    screenType: string
  ) => Promise<PredictiveModelData>;
}

const ModelPerformancePlots = ({
  modelName,
  entityLabel,
  screenType,
  getModelPerformanceData,
}: ModelPerformancePlotsProps) => {
  const [
    predictiveModelData,
    setPredictiveModelData,
  ] = useState<PredictiveModelData | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const latestPromise = useRef<Promise<PredictiveModelData>>();

  const [
    cellContextCorrPlotElement,
    setCellContextCorrPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  const [
    modelPredPlotElement,
    setModelPredPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  useEffect(() => {
    setPredictiveModelData(null);
    setCellContextCorrPlotElement(null);
    setModelPredPlotElement(null);
    setIsLoading(true);
    const promise = getModelPerformanceData(modelName, entityLabel, screenType);

    latestPromise.current = promise;
    promise
      .then((result: any) => {
        if (promise === latestPromise.current) {
          setPredictiveModelData(result);
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
      setPredictiveModelData(null);
      setCellContextCorrPlotElement(null);
      setModelPredPlotElement(null);
      setIsLoading(false);
      setIsError(false);
    };
  }, [entityLabel, modelName, getModelPerformanceData, screenType]);
  console.log(isError);
  console.log(isLoading);

  const formatZVals = (zs: number[], i: number) =>
    zs
      .map((val) => val)
      .map((val, j) => {
        if (val !== null) {
          return val;
        }

        return i === j ? 1 : 0;
      })
      .reverse();

  const formattedModelPredData: any = useMemo(() => {
    if (predictiveModelData) {
      return {
        x: predictiveModelData.model_predictions.model_pred_data.actuals,
        y: predictiveModelData.model_predictions.model_pred_data.predictions,
        xLabel: predictiveModelData.model_predictions.x_label,
        yLabel: predictiveModelData.model_predictions.y_label,
      };
    }

    if (/* isLoading && */ !predictiveModelData) {
      return null;
    }
    return {
      x: [],
      y: [],
      xLabel: "",
      yLabel: "",
      hoverText: "",
    };
  }, [predictiveModelData /* , isLoading */]);

  const memoizedData = useMemo(
    () =>
      predictiveModelData?.corr /* && !isLoading */
        ? {
            x: [],
            y: predictiveModelData?.corr.row_labels,
            z: predictiveModelData?.corr.corr_heatmap_vals.map(formatZVals),
          }
        : null,
    [predictiveModelData?.corr /* , isLoading */]
  );

  const memoizedXLabels = useMemo(
    () =>
      predictiveModelData?.corr /* && !isLoading */
        ? predictiveModelData?.corr.row_labels
            .map((label: string) => label)
            .slice()
            .reverse()
        : null,
    [predictiveModelData?.corr /* , isLoading */]
  );

  const memoizedYLabels = useMemo(
    () =>
      predictiveModelData?.corr /* && !isLoading */
        ? predictiveModelData?.corr.row_labels.map((label: string) => label)
        : null,
    [predictiveModelData?.corr /* , isLoading */]
  );

  return (
    <div className={styles.modelPerformancePlots}>
      <div className={styles.scatter}>
        {" "}
        {predictiveModelData && (
          <h3
            style={{ marginLeft: "15px", marginTop: "15px", maxWidth: "200px" }}
          >
            Model Predictions
          </h3>
        )}
        {!modelPredPlotElement && <PlotSpinner height="100%" />}
        {predictiveModelData /* && !isLoading */ && (
          <div>
            <ScatterPlot
              key={"cell-context-scatter-plot"}
              margin={{ t: 60, l: 62, r: 120 }}
              density={predictiveModelData?.model_predictions.density}
              data={formattedModelPredData}
              logOR={[]}
              height={337}
              xKey="x"
              yKey="y"
              continuousColorKey="contColorData"
              // hoverTextKey="hoverText"
              xLabel={formattedModelPredData?.xLabel}
              yLabel={formattedModelPredData?.yLabel}
              onLoad={(element: ExtendedPlotType | null) => {
                if (element) {
                  setModelPredPlotElement(element);
                }
              }}
              autosize
              showYEqualXLine
            />
          </div>
        )}
        {predictiveModelData /* && !isLoading */ && (
          <div className={styles.deButtonContainer}>
            <Button
              className={styles.deButton}
              href={getDataExplorerUrl(
                predictiveModelData.model_predictions.predictions_dataset_id,
                null,
                "gene",
                entityLabel,
                screenType
              )}
              target="_blank"
              disabled={false}
            >
              Open Plot in Data Explorer
            </Button>
          </div>
        )}
      </div>
      <div className={styles.heatmap}>
        {" "}
        {!cellContextCorrPlotElement && <PlotSpinner height="100%" />}
        {predictiveModelData?.corr /* && !isLoading */ && (
          <>
            <h3 style={{ marginLeft: "15px", marginTop: "15px" }}>
              Top Feature Correlation Map
            </h3>

            <PrototypeCorrelationHeatmap
              data={memoizedData as any}
              xLabels={memoizedXLabels!}
              yLabels={memoizedYLabels!}
              zLabel=""
              xKey="x"
              yKey="y"
              zKey="z"
              height={350}
              onLoad={(element: ExtendedPlotType | null) => {
                if (element) {
                  setCellContextCorrPlotElement(element);
                }
              }}
              palette={undefined}
              margin={{ t: 30, l: 120, r: 30, b: 106 }}
              doTruncateTickLabels={false}
              distinguish1Label={undefined}
              distinguish2Label={undefined}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ModelPerformancePlots;
