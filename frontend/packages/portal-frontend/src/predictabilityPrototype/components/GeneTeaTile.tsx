import { DataExplorerContext } from "@depmap/types";
import React from "react";
import { Tab, Tabs } from "react-bootstrap";
import GeneTea from "src/data-explorer-2/components/plot/integrations/GeneTea";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { GeneTeaSearchTerm, SCREEN_TYPE_COLORS } from "../models/types";
import TopFeaturesTableTile from "./TopFeaturesTableTile";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";

export interface GeneTeaTileProps {
  selectedLabels: GeneTeaSearchTerm[] | null;
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
            Top GeneTEA Terms (
            <span
              style={{
                color: SCREEN_TYPE_COLORS.get(screenTypeLabel.toLowerCase()),
              }}
            >
              {screenTypeLabel}
            </span>
            )
          </h2>
          <p
            style={{
              marginLeft: "10px",
              marginRight: "10px",
              marginBottom: "15px",
            }}
          >
            Search terms are derived from genes in the top 100 {screenTypeLabel}{" "}
            overall features.
          </p>
          <div className="card_padding stacked-boxplot-graphs-padding">
            {!selectedLabels && <PlotSpinner height="100%" />}
            {selectedLabels && (
              <Tabs
                defaultActiveKey={1}
                style={{ height: "100%" }}
                id={`gene_tea_${screenTypeLabel}_tile_tabs`}
              >
                <Tab eventKey={1} title="GeneTEA Results">
                  <GeneTea
                    selectedLabels={
                      new Set<string>(selectedLabels.map((label) => label.name))
                    }
                    onClickColorByContext={(_: DataExplorerContext) => {
                      console.log(_);
                    }}
                  />
                </Tab>
                <Tab eventKey={2} title="Search Terms">
                  <div style={{ height: "150px" }}>
                    <TopFeaturesTableTile selectedLabels={selectedLabels} />
                  </div>
                </Tab>
              </Tabs>
            )}
          </div>
        </div>
      </article>
    );
  }
  return null;
};

export default GeneTeaTile;
