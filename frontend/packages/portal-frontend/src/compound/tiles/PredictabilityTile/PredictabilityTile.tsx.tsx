import React from "react";
import styles from "../CompoundTiles.scss";
import GenericDistributionPlot from "src/plot/components/GenericDistributionPlot";
import { TopFeaturesTable } from "./TopFeaturesTable";
import { TopModelsTable } from "./TopModelsTable";

interface PredictabilityTileProps {
  predictability: any;
  isGeneExecutive: boolean;
  // This is to identify whether or not
  isMobile: boolean;
}

export const PredictabilityTile: React.FC<PredictabilityTileProps> = ({
  predictability,
  isGeneExecutive,
  isMobile,
}) => {
  if (!predictability) return null;

  const handleTabClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "predictability");
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="card_wrapper">
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
                {predictability.plot_data.map((data) => (
                  <h4 key={data.type} className={data.type}>
                    {data.label}: {data.percentile}th percentile
                  </h4>
                ))}

                {/* 2. React-rendered Distribution Plots */}
                <div className="plot_width plot_padding1">
                  {predictability.plot_data.map((data) => (
                    <div
                      key={data.type}
                      className={styles.plotContainer}
                      style={{ marginBottom: "15px", position: "relative" }}
                    >
                      <div
                        style={{
                          color: data.color,
                          fontWeight: 900,
                          fontSize: "12px",
                          fontFamily: "Lato",
                        }}
                      >
                        {data.label} <br />
                        {data.query_value.toFixed(3)}
                      </div>

                      <GenericDistributionPlot
                        values={data.background_values}
                        xaxisLabel=""
                        color={data.color}
                        // If GenericDistributionPlot supports a vertical line at a specific value:
                        highlightValue={data.query_value}
                      />
                    </div>
                  ))}

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
                    className="info-icon popover-selector"
                    src="/static/img/gene_overview/info_purple.svg"
                    alt="info"
                  />
                </div>

                <h4
                  className={`${predictability.overall_top_model.type} no_margin`}
                >
                  {
                    predictability.tables.find(
                      (t) => t.type === predictability.overall_top_model.type
                    )?.dataset
                  }
                </h4>

                <TopFeaturesTable
                  features={predictability.overall_top_model.features}
                  type={predictability.overall_top_model.type}
                />

                {!isMobile && (
                  <div style={{ marginTop: "1rem" }}>
                    <p className="view-details-text">
                      <span>
                        View model details in the{" "}
                        <button
                          onClick={handleTabClick}
                          className={styles.pseudoLink}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            textDecoration: "underline",
                            cursor: "pointer",
                            color: "inherit",
                          }}
                        >
                          Predictability tab
                        </button>
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            predictability.tables.map((table, index) => (
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
