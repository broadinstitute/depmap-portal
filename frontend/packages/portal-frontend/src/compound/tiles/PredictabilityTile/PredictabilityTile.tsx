import React from "react";
import styles from "../CompoundTiles.scss";
import GenericDistributionPlot from "src/plot/components/GenericDistributionPlot";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ErrorLoading from "../ErrorLoading";
import usePredictabilityTileData from "../hooks/usePredictabilityTileData";
import { TopFeaturesTable } from "./TopFeaturesTable";
import { TopModelsTable } from "./TopModelsTable";
import { PredictabilityPlotData, PredictabilityTileData } from "@depmap/types";

interface PredictabilityTileProps {
  compoundId: string;
  datasetGivenIds: string[];
  isGeneExecutive: boolean; // This prop is not yet use. Will eventually be used to support switching the Gene Page Predictability tile to React
}

const PredictabilityView: React.FC<{
  predictability: PredictabilityTileData;
  isGeneExecutive: boolean;
}> = ({ predictability, isGeneExecutive }) => {
  const handleTabClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "predictability");
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className={`${styles.PredictabilityTile} card_wrapper`}>
      <div className="card_border">
        <div>
          {isGeneExecutive ? (
            <>
              <h2 className="no_margin cardtitle_text">
                Predictability
                <img
                  className="info-icon popover-selector"
                  src="/static/img/gene_overview/info_purple.svg"
                  alt="info"
                  data-toggle="tooltip"
                />
              </h2>

              <div className="card_padding">
                {/* 1. Dynamic Percentile Headers */}
                {predictability.plot_data.map(
                  (plot: PredictabilityPlotData) => (
                    <h4 key={plot.type} className={plot.type}>
                      {plot.label}: {plot.percentile}th percentile
                    </h4>
                  )
                )}

                {/* 2. Distribution Plots */}
                <div className="plot_width plot_padding1">
                  {predictability.plot_data.map(
                    (plot: PredictabilityPlotData) => (
                      <div
                        key={plot.type}
                        className={styles.plotContainer}
                        style={{ marginBottom: "15px", position: "relative" }}
                      >
                        <div
                          style={{
                            color: plot.color,
                            fontWeight: 900,
                            fontSize: "12px",
                            fontFamily: "Lato",
                          }}
                        >
                          {plot.label} <br />
                          {plot.query_value.toFixed(3)}
                        </div>

                        <GenericDistributionPlot
                          values={plot.background_values}
                          xaxisLabel=""
                          color={plot.color}
                          highlightValue={plot.query_value}
                        />
                      </div>
                    )
                  )}

                  <p className="no_margin plot_label">
                    Prediction Accuracy
                    <img
                      className="info-icon-axis popover-selector"
                      src="/static/img/gene_overview/info_purple.svg"
                      alt="info"
                    />
                  </p>
                </div>

                <hr className="hr_margin" />

                {/* 3. Predictive Model Features Table */}
                <div className="card_subheading">
                  Features of most accurate predictive model
                  <img
                    className={styles.infoImage}
                    src="/static/img/gene_overview/info_purple.svg"
                    alt="info"
                  />
                </div>

                <h4
                  className={`${predictability.overall_top_model.type} no_margin`}
                >
                  {
                    predictability.tables.find(
                      (t: any) =>
                        t.type === predictability.overall_top_model.type
                    )?.dataset
                  }
                </h4>

                <TopFeaturesTable
                  features={predictability.overall_top_model.features}
                  type={predictability.overall_top_model.type}
                />

                <div className={styles.viewDetailsSections}>
                  <p className={styles.viewDetailsParagraph}>
                    <span>
                      View model details in the{" "}
                      <button
                        onClick={handleTabClick}
                        className={styles.pseudoLink}
                        type="button"
                      >
                        Predictability tab
                      </button>
                    </span>
                  </p>
                </div>
              </div>
            </>
          ) : (
            predictability.tables.map((table: any, index: number) => (
              <div key={index} className="card_padding">
                <h4 className={`${table.type} no_margin`}>{table.dataset}</h4>
                <TopModelsTable models={table.top_models} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const PredictabilityTile: React.FC<PredictabilityTileProps> = ({
  compoundId,
  datasetGivenIds,
  isGeneExecutive, // This prop is not yet use. Will eventually be used to support switching the Gene Page Predictability tile to React
}) => {
  const { data, isLoading, error } = usePredictabilityTileData(
    compoundId,
    datasetGivenIds
  );

  if (isLoading) {
    return <PlotSpinner />;
  }

  if (error) {
    return <ErrorLoading tileName="Predictability" />;
  }

  if (!data) {
    return null;
  }

  return (
    <PredictabilityView
      predictability={data}
      isGeneExecutive={isGeneExecutive} // This prop is not yet use (i.e. is always false as set in index.tsx). Will eventually be used to support switching the Gene Page Predictability tile to React
    />
  );
};
