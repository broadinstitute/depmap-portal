import React, { useState } from "react";
import LineChart from "src/plot/components/LineChart";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";
import { AggScoresData } from "../models/types";

export interface AggScoresTileProps {
  plotTitle: string;
  data: AggScoresData | null;
}

const AggScoresTile = ({ plotTitle, data }: AggScoresTileProps) => {
  const [
    aggScoresPlotElement,
    setAggScoresPlotElement,
  ] = useState<ExtendedPlotType | null>(null);
  return (
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Aggregate Scores Across All Models
        </h2>
        <p
          style={{
            marginLeft: "10px",
            marginRight: "10px",
            marginBottom: "15px",
          }}
        >
          The features displayed on mouseover have the highest feature
          importance of all new features added at the selected step.
        </p>
        <div className="card_padding stacked-boxplot-graphs-padding">
          <div className={styles.PredictabilityTab}>
            {!data && !aggScoresPlotElement && <PlotSpinner height="100%" />}
            {data?.accuracies && (
              <LineChart
                title={plotTitle}
                yAxisTitle={"Model Cumulative Accuracy"}
                xLabels={data.accuracies.name}
                yValues={data.accuracies.accuracy}
                text={data.accuracies.name.map(
                  (modelName: string) =>
                    data.accuracies.feature_highest_importance[modelName]
                )}
                onLoad={(element: ExtendedPlotType | null) => {
                  if (element) {
                    setAggScoresPlotElement(element);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default AggScoresTile;
