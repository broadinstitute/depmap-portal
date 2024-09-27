import { DataExplorerContext } from "@depmap/types";
import React from "react";
import { Tab, Tabs } from "react-bootstrap";
import GeneTea from "src/data-explorer-2/components/plot/integrations/GeneTea";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { GeneTeaSearchTerm, TopFeaturesBarData } from "../models/types";
import TopFeaturesOverallTile from "./TopFeaturesOverallTile";
import TopFeaturesTableTile from "./TopFeaturesTableTile";
// import styles from "src/predictabilityPrototype/styles/PredictabilityPrototype.scss";

export interface GeneTeaTileProps {
  selectedLabels: GeneTeaSearchTerm[] | null;
  screenTypeLabel: string;
  entityLabel: string;
  topFeaturesData: TopFeaturesBarData | null;
}

const GeneTeaTile = ({
  selectedLabels,
  screenTypeLabel,
  entityLabel,
  topFeaturesData,
}: GeneTeaTileProps) => {
  return (
    <article className="card_wrapper stacked-boxplot-tile">
      <div className="card_border container_fluid" style={{ height: "560px" }}>
        <h2 style={{ marginLeft: "10px", marginTop: "10px" }}>
          {screenTypeLabel}
        </h2>
        <div className="card_padding stacked-boxplot-graphs-padding">
          {!selectedLabels && <PlotSpinner height="100%" />}
          {selectedLabels && (
            <Tabs
              defaultActiveKey={1}
              style={{ height: "100%" }}
              id={`gene_tea_${screenTypeLabel}_tile_tabs`}
            >
              <Tab eventKey={1} title="Top Features Overall">
                <TopFeaturesOverallTile
                  plotTitle={`${entityLabel} ${screenTypeLabel}`}
                  topFeaturesData={topFeaturesData}
                  entityLabel={entityLabel}
                  screenTypeLabel={screenTypeLabel}
                />
              </Tab>
              <Tab eventKey={2} title="GeneTEA Results">
                <p
                  style={{
                    marginLeft: "10px",
                    marginRight: "10px",
                    marginBottom: "20px",
                  }}
                >
                  Search terms are derived from genes in the top 100{" "}
                  {screenTypeLabel} overall features.
                </p>
                <GeneTea
                  selectedLabels={
                    new Set<string>(selectedLabels.map((label) => label.name))
                  }
                  onClickColorByContext={(_: DataExplorerContext) => {
                    console.log(_);
                  }}
                />
              </Tab>
              <Tab eventKey={3} title="Search Terms">
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
};

export default GeneTeaTile;
