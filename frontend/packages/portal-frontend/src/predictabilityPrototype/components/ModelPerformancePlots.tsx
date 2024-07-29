import React, { useMemo, useState } from "react";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import PrototypeCorrelationHeatmap from "src/data-explorer-2/components/plot/prototype/PrototypeCorrelationHeatmap";
import PlotSpinner from "src/plot/components/PlotSpinner";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { CorrData, ModelPredictionsGraphData } from "../models/types";
import { Button } from "react-bootstrap";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";

export interface ModelPerformancePlotsProps {
  modelPredData: ModelPredictionsGraphData | null;
  cellContextCorrData: CorrData | null;
}

const ModelPerformancePlots = ({
  modelPredData,
  cellContextCorrData,
}: ModelPerformancePlotsProps) => {
  const [
    cellContextCorrPlotElement,
    setCellContextCorrPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

  const [
    modelPredPlotElement,
    setModelPredPlotElement,
  ] = useState<ExtendedPlotType | null>(null);

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
    if (modelPredData) {
      return {
        x: modelPredData.model_pred_data.actuals,
        y: modelPredData.model_pred_data.predictions,
        xLabel: modelPredData.x_label,
        yLabel: modelPredData.y_label,
      };
    }

    if (/* isLoading && */ !modelPredData) {
      return null;
    }
    return {
      x: [],
      y: [],
      xLabel: "",
      yLabel: "",
      hoverText: "",
    };
  }, [modelPredData /* , isLoading */]);

  const memoizedData = useMemo(
    () =>
      cellContextCorrData /* && !isLoading */
        ? {
            x: [],
            y: cellContextCorrData.row_labels,
            z: cellContextCorrData.corr_heatmap_vals.map(formatZVals),
          }
        : null,
    [cellContextCorrData /* , isLoading */]
  );

  const memoizedXLabels = useMemo(
    () =>
      cellContextCorrData /* && !isLoading */
        ? cellContextCorrData.row_labels
            .map((label: string) => label)
            .slice()
            .reverse()
        : null,
    [cellContextCorrData /* , isLoading */]
  );

  const memoizedYLabels = useMemo(
    () =>
      cellContextCorrData /* && !isLoading */
        ? cellContextCorrData.row_labels.map((label: string) => label)
        : null,
    [cellContextCorrData /* , isLoading */]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        paddingTop: "30px",
        paddingRight: "30px",
        paddingLeft: "30px",
        paddingBottom: "30px",
        borderBottom: "1px solid black",
        backgroundColor: "#ffffff"
      }}
    >
      <div style={{ gridColumn: "1" }}>
        {" "}
        <div style={{ marginLeft: "15px", border: "1px solid lightgray" }}>
          {" "}
          <h3
            style={{ marginLeft: "15px", marginTop: "15px", maxWidth: "200px" }}
          >
            Model Predictions
          </h3>
          {!modelPredPlotElement && <PlotSpinner height="100%" />}
          {modelPredData /* && !isLoading */ && (
            <ScatterPlot
              key={"cell-context-scatter-plot"}
              margin={{ t: 60, l: 62, r: 150 }}
              density={modelPredData?.density}
              data={formattedModelPredData}
              logOR={[]}
              height={387}
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
              showYEqualXLine
            />
          )}
          {modelPredData /* && !isLoading */ && (
            <div className={styles.deButtonContainer}>
              <Button
                className={styles.deButton}
                href={""}
                target="_blank"
                disabled={false}
              >
                Open Plot in Data Explorer
              </Button>
            </div>
          )}
        </div>
      </div>
      <div style={{ gridColumn: "2/4" }}>
        <div
          style={{
            marginLeft: "15px",
            border: "1px solid lightgray",
            height: "500px",
          }}
        >
          {" "}
          {!cellContextCorrPlotElement && <PlotSpinner height="100%" />}
          <h3 style={{ marginLeft: "15px", marginTop: "15px" }}>
            Top Feature Correlation Map
          </h3>
          {cellContextCorrData /* && !isLoading */ && (
            <PrototypeCorrelationHeatmap
              data={memoizedData as any}
              xLabels={memoizedXLabels!}
              yLabels={memoizedYLabels!}
              zLabel=""
              xKey="x"
              yKey="y"
              zKey="z"
              height={400}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelPerformancePlots;
