import React, { useCallback } from "react";
import ScatterPlot from "src/contextExplorer/components/contextAnalysis/ScatterPlot";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { DENSITY_COLOR_SCALE } from "../models/types";
import { PredictiveModelData } from "@depmap/types";
import { Button } from "react-bootstrap";
import { getDataExplorerUrl } from "../utils";
import PrototypeCorrelationHeatmap from "@depmap/data-explorer-2/src/components/DataExplorerPage/components/plot/prototype/PrototypeCorrelationHeatmap";
import { AsyncPlot } from "./AsyncPlot";
import { breadboxAPI, cached } from "@depmap/api";

export interface ModelPerformancePlotsProps {
  modelName: string;
  entityLabel: string;
  screenType: string;
  getModelPerformanceData: (
    entityLabel: string,
    model: string,
    screenType: string
  ) => Promise<PredictiveModelData>;

  predictionDatasetId: string;
  predictionGivenId: string;

  actualsDatasetId: string;
  actualsGivenId: string;
}

interface CorrelationHeatmapProps {
  data: any;
  xLabels: string[];
  yLabels: string[];
}

function CorrelationHeatmap({
  data,
  xLabels,
  yLabels,
}: CorrelationHeatmapProps) {
  return (
    <>
      <h3 style={{ marginLeft: "15px", marginTop: "15px" }}>
        Top Feature Correlation Map
      </h3>

      <PrototypeCorrelationHeatmap
        data={data}
        xLabels={xLabels!}
        yLabels={yLabels!}
        zLabel=""
        xKey="x"
        yKey="y"
        zKey="z"
        height={350}
        // onLoad={setCellContextCorrPlotElement}
        palette={undefined}
        margin={{ t: 30, l: 120, r: 30, b: 106 }}
        doTruncateTickLabels={false}
        distinguish1Label={undefined}
        distinguish2Label={undefined}
      />
    </>
  );
}

interface ActualsVsPredictionsPlotProps {
  data: any;
  xLabel: string;
  yLabel: string;
  predictionDatasetId: string;
  predictionGivenId: string;
  actualsDatasetId: string;
  actualsGivenId: string;
}

function ActualsVsPredictionsPlot({
  data,
  xLabel,
  yLabel,
  predictionDatasetId,
  predictionGivenId,
  actualsGivenId,
  actualsDatasetId,
}: ActualsVsPredictionsPlotProps) {
  return (
    <>
      <h3 style={{ marginLeft: "15px", marginTop: "15px", maxWidth: "200px" }}>
        Model Predictions
      </h3>
      <div>
        <ScatterPlot
          key={"cell-context-scatter-plot"}
          margin={{ t: 60, l: 62, r: 120 }}
          // density={predictiveModelData?.model_predictions.density}
          data={data}
          height={337}
          xKey="x"
          yKey="y"
          colorVariable={[]}
          continuousColorKey="contColorData"
          customContinuousColorScale={DENSITY_COLOR_SCALE}
          hoverTextKey="hoverText"
          xLabel={xLabel}
          yLabel={yLabel}
          // onLoad={(element: ExtendedPlotType | null) => {
          //   if (element) {
          //     setModelPredPlotElement(element);
          //   }
          // }}
          autosize
          showYEqualXLine
        />
      </div>
      <div className={styles.deButtonContainer}>
        <Button
          className={styles.deButton}
          href={getDataExplorerUrl(
            predictionDatasetId,
            predictionGivenId,
            actualsGivenId,
            actualsDatasetId
          )}
          target="_blank"
          disabled={false}
        >
          Open Plot in Data Explorer
        </Button>
      </div>
    </>
  );
}

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

const ModelPerformancePlots = ({
  modelName,
  entityLabel,
  screenType,
  getModelPerformanceData,
  actualsGivenId,
  actualsDatasetId,
  predictionDatasetId,
  predictionGivenId,
}: ModelPerformancePlotsProps) => {
  console.log("actuals", actualsGivenId, actualsDatasetId);
  console.log("predictions", predictionGivenId, predictionDatasetId);

  const loadScatterPlotData = useCallback(async () => {
    //    console.log("loadScatterPlotData", )

    const xPromise = cached(breadboxAPI).getMatrixDatasetData(
      actualsDatasetId,
      { feature_identifier: "id", features: [actualsGivenId] }
    );
    const yPromise = cached(breadboxAPI).getMatrixDatasetData(
      predictionDatasetId,
      {
        feature_identifier: "id",
        features: [predictionGivenId],
      }
    );
    const [xSeries, ySeries] = await Promise.all([xPromise, yPromise]);
    const x: number[] = [];
    const y: number[] = [];
    const ids: string[] = [];

    // these two requests got a single feature each, so just get that one feature's values
    const xSeries0 = xSeries[actualsGivenId];
    const ySeries0 = ySeries[predictionGivenId];

    console.log("loadScatterPlotData xSeries", xSeries);

    for (const key of Object.keys(xSeries0)) {
      if (ySeries0[key]) {
        x.push(xSeries0[key] as number);
        y.push(ySeries0[key] as number);
        ids.push(key);
      }
    }
    console.log("loadScatterPlotData x", x);
    console.log("loadScatterPlotData y", y);

    return {
      actualsGivenId,
      actualsDatasetId,
      predictionDatasetId,
      predictionGivenId,
      xLabel: "Actual",
      yLabel: "Prediction",

      data: {
        x,
        y,
        hoverinfo: "text",
        hoverText: ids,
        // hoverText: x.map(
        //   (label, index) =>
        //     `${label}<br> Actual: ${predictiveModelData.model_predictions.model_pred_data.actuals[
        //       index
        //     ].toFixed(
        //       3
        //     )}<br> Prediction: ${predictiveModelData.model_predictions.model_pred_data.predictions[
        //       index
        //     ].toFixed(3)}`
        // ),
      },
    };
  }, [
    actualsDatasetId,
    predictionDatasetId,
    actualsGivenId,
    predictionGivenId,
  ]);

  const loadCorrelationHeatmapData = useCallback(async () => {
    const modelPerformanceData = await getModelPerformanceData(
      modelName,
      entityLabel,
      screenType
    );
    const data = {
      x: [],
      y: modelPerformanceData.corr.row_labels,
      z: modelPerformanceData.corr.corr_heatmap_vals.map(formatZVals),
    };
    const xLabels = modelPerformanceData.corr.row_labels
      .map((label: string) => label)
      .slice()
      .reverse();

    const yLabels = modelPerformanceData.corr.row_labels.map(
      (label: string) => label
    );

    return { data, xLabels, yLabels };
  }, [modelName, entityLabel, screenType, getModelPerformanceData]);

  return (
    <div className={styles.modelPerformancePlots}>
      <div className={styles.scatter}>
        {" "}
        <AsyncPlot
          loader={loadScatterPlotData}
          childComponent={ActualsVsPredictionsPlot}
        />
      </div>
      <div className={styles.heatmap}>
        {" "}
        <AsyncPlot
          loader={loadCorrelationHeatmapData}
          childComponent={CorrelationHeatmap}
        />
      </div>
    </div>
  );
};

export default ModelPerformancePlots;
