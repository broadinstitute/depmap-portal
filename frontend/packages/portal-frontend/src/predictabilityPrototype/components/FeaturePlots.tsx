import React, { useMemo, useState } from "react";
import { CardColumn, CardContainer } from "src/common/components/Card";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import DataExplorerCorrelationHeatmap from "src/data-explorer-2/components/plot/DataExplorerCorrelationHeatmap";
import PrototypeCorrelationHeatmap from "src/data-explorer-2/components/plot/prototype/PrototypeCorrelationHeatmap";
import BarChart from "src/plot/components/BarChart";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import {
  CorrData,
  FEATURE_SET_COLORS,
  ModelPredictionsGraphData,
} from "../models/types";

export interface FeaturePlotsProps {
  modelPredData: ModelPredictionsGraphData | null;
  cellContextCorrData: CorrData | null;
  isLoading: boolean;
  handleSetModelPredPlotElement: (element: any) => void;
  handleSetCellContextCorrPlotElement: (element: any) => void;
}

const FeaturePlots = ({
  modelPredData,
  cellContextCorrData,
  isLoading,
  handleSetModelPredPlotElement,
  handleSetCellContextCorrPlotElement,
}: FeaturePlotsProps) => {
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

    if (isLoading && !modelPredData) {
      return null;
    }
    return {
      x: [],
      y: [],
      xLabel: "",
      yLabel: "",
      hoverText: "",
    };
  }, [modelPredData, isLoading]);

  const memoizedData = useMemo(
    () =>
      cellContextCorrData && !isLoading
        ? {
            x: [],
            y: cellContextCorrData.row_labels,
            z: cellContextCorrData.corr_heatmap_vals.map(formatZVals),
          }
        : null,
    [cellContextCorrData, isLoading]
  );

  const memoizedXLabels = useMemo(
    () =>
      cellContextCorrData && !isLoading
        ? cellContextCorrData.row_labels
            .map((label: string) => label)
            .slice()
            .reverse()
        : null,
    [cellContextCorrData, isLoading]
  );

  const memoizedYLabels = useMemo(
    () =>
      cellContextCorrData && !isLoading
        ? cellContextCorrData.row_labels.map((label: string) => label)
        : null,
    [cellContextCorrData, isLoading]
  );

  return (
    <CardContainer>
      <CardColumn>
        {" "}
        <div className={styles.scatterPlot}>
          {formattedModelPredData && (
            <ScatterPlot
              margin={{ t: 60, l: 62, r: 15 }}
              data={formattedModelPredData}
              logOR={[]}
              height={387}
              xKey="x"
              yKey="y"
              continuousColorKey="contColorData"
              // hoverTextKey="hoverText"
              xLabel={formattedModelPredData?.xLabel}
              yLabel={formattedModelPredData?.yLabel}
              onLoad={handleSetModelPredPlotElement}
              showYEqualXLine
            />
          )}
        </div>
      </CardColumn>
      <CardColumn>
        <div>
          {" "}
          {cellContextCorrData && !isLoading && (
            <PrototypeCorrelationHeatmap
              data={memoizedData as any}
              xLabels={memoizedXLabels!}
              yLabels={memoizedYLabels!}
              zLabel=""
              xKey="x"
              yKey="y"
              zKey="z"
              height="auto"
              onLoad={handleSetCellContextCorrPlotElement}
              palette={undefined}
              distinguish1Label={undefined}
              distinguish2Label={undefined}
            />
          )}
        </div>
      </CardColumn>
    </CardContainer>
  );
};

export default FeaturePlots;
