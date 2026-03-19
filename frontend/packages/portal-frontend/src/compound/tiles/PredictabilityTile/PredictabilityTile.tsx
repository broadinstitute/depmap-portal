import React from "react";
import styles from "../CompoundTiles.scss";
import GenericDistributionPlot from "src/plot/components/GenericDistributionPlot";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ErrorLoading from "../ErrorLoading";
import usePredictabilityTileData from "../hooks/usePredictabilityTileData";
import { TopFeaturesTable } from "./TopFeaturesTable";
import { PredictabilityPlotData, PredictabilityTileData } from "@depmap/types";
import PurpleHelpIcon from "src/geneTea/components/PurpleHelpIcon";

interface PredictabilityTileProps {
  compoundId: string;
  datasetGivenIds: string[];
}

const PredictabilityView: React.FC<{
  predictability: PredictabilityTileData;
}> = ({ predictability }) => {
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
          <>
            <h2 className="no_margin cardtitle_text">
              Predictability
              <PurpleHelpIcon
                tooltipText="Dependency probabilities for each gene are predicted using an ensemble of random forests (RF), where each RF model 
        is fit using different combinations of CCLE 2019 datasets and feature selection methods (see details for model definitions). The measure 
        of prediction accuracy for each model is the Pearson correlation of the predicted dependency values to the observed values."
                popoverId="predictability-tooltip-1"
              />
            </h2>

            <div className="card_padding">
              {/* 1. Dynamic Percentile Headers */}
              {predictability.plot_data.map((plot: PredictabilityPlotData) => (
                <h4 key={plot.type} className={plot.type}>
                  {plot.label}: {plot.percentile}th percentile
                </h4>
              ))}

              {/* 2. Distribution Plots */}
              <div className="plot_width plot_padding1">
                {predictability.plot_data.map(
                  (plot: PredictabilityPlotData) => (
                    <div
                      key={plot.type}
                      className={styles.plotContainer}
                      style={{ marginBottom: "15px", position: "relative" }}
                    >
                      <GenericDistributionPlot
                        values={plot.background_values}
                        xaxisLabel=""
                        color={plot.color}
                        fillOpacity={0.5}
                        highlightValue={plot.query_value}
                        highlightLineLabel={`${
                          plot.label
                        }: ${plot.query_value.toFixed(3)}`}
                        includeRugPlot={false}
                      />
                    </div>
                  )
                )}

                <p className="no_margin plot_label">
                  Prediction Accuracy
                  <PurpleHelpIcon
                    tooltipText="Densities represent the distribution of prediction accuracies for the top 6,000 genes with the highest variance. Vertical lines indicate the accuracy of 
              predicting the query gene."
                    popoverId="predictability-tooltip-2"
                  />
                </p>
              </div>

              <hr className="hr_margin" />

              {/* 3. Predictive Model Features Table */}
              <div className="card_subheading">
                Features of most accurate predictive model
                <PurpleHelpIcon
                  tooltipText="Indicates the impact of an individual feature on prediction accuracy relative to the other features available to the model (0 to 1 scale). It is calculated 
              using Gini Importance and is normalized so the total of all feature importance is 1."
                  popoverId="predictability-tooltip-3"
                />
              </div>

              <h4
                className={`${predictability.overall_top_model.type} no_margin`}
              >
                {
                  predictability.tables.find(
                    (t: any) => t.type === predictability.overall_top_model.type
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
        </div>
      </div>
    </div>
  );
};

export const PredictabilityTile: React.FC<PredictabilityTileProps> = ({
  compoundId,
  datasetGivenIds,
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

  return <PredictabilityView predictability={data} />;
};
