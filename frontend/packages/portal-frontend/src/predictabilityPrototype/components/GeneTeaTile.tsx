import { DataExplorerContext } from "@depmap/types";
import React from "react";
import GeneTea from "src/data-explorer-2/components/plot/integrations/GeneTea";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";

export interface GeneTeaTileProps {
  selectedLabels: string[] | null;
}

const GeneTeaTile = ({ selectedLabels }: GeneTeaTileProps) => {
  if (selectedLabels) {
    return (
      <article
        className="card_wrapper stacked-boxplot-tile"
        style={{ minHeight: "500px" }}
      >
        <div className="card_border container_fluid">
          <h2 className="no_margin cardtitle_text">Top GeneTEA Terms</h2>
          <div className="card_padding stacked-boxplot-graphs-padding">
            <div style={{ paddingLeft: "15px", paddingRight: "15px" }}>
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