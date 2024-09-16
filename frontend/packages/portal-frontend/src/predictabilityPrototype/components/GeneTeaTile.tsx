import { DataExplorerContext } from "@depmap/types";
import React from "react";
import GeneTea from "src/data-explorer-2/components/plot/integrations/GeneTea";
import PlotSpinner from "src/plot/components/PlotSpinner";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";

export interface GeneTeaTileProps {
  selectedLabels: string[] | null;
  screenTypeLabel: string;
}

const GeneTeaTile = ({ selectedLabels, screenTypeLabel }: GeneTeaTileProps) => {
  if (selectedLabels) {
    return (
      <article className="card_wrapper stacked-boxplot-tile">
        <div
          className="card_border container_fluid"
          style={{ height: "530px" }}
        >
          <h2 className="no_margin cardtitle_text">
            Top GeneTEA Terms ({screenTypeLabel})
          </h2>
          <p
            style={{
              marginLeft: "10px",
              marginRight: "10px",
              marginBottom: "15px",
            }}
          >
            Search terms are derived from the top 100 {screenTypeLabel} overall
            features.
          </p>
          <div className="card_padding stacked-boxplot-graphs-padding">
            <div style={{ paddingLeft: "15px", paddingRight: "15px" }}>
              {!selectedLabels && <PlotSpinner height="100%" />}
              <GeneTea
                selectedLabels={new Set<string>(selectedLabels)}
                onClickColorByContext={(_: DataExplorerContext) => {
                  console.log(_);
                }}
              />
            </div>
          </div>
        </div>
      </article>
    );
  }
  return null;
};

export default GeneTeaTile;
