import React, { useMemo } from "react";
import styles from "./styles/TopCoDependencies.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import useTopCoDependenciesData from "../hooks/useTopCoDependenciesData";
import { CoDependenciesTable } from "./CoDependenciesTable";
import { downloadTopCorrelations } from "../utils";

interface TopCoDependenciesTileProps {
  geneEntrezId: string;
  geneLabel: string;
  associationDatasetIds: string[];
}

const TopCoDependenciesTile = ({
  geneEntrezId,
  associationDatasetIds,
  geneLabel,
}: TopCoDependenciesTileProps) => {
  const crisprGivenId = "Chronos_Combined";
  const rnaiGivenId = "RNAi_merged";
  const {
    datasetName: crisprDatasetName,
    correlationData: crisprCorrelationData,
    isLoading: crisprIsLoading,
    error: crisprError,
  } = useTopCoDependenciesData(
    crisprGivenId,
    geneEntrezId,
    associationDatasetIds
  );
  const {
    datasetName: rnaiDatasetName,
    correlationData: rnaiCorrelationData,
    isLoading: rnaiIsLoading,
    error: rnaiError,
  } = useTopCoDependenciesData(
    rnaiGivenId,
    geneEntrezId,
    associationDatasetIds
  );

  // Get the top dataset associations based on abs(correlation) sorted in descending order
  const allTopCrisprDatasetCorrelations = useMemo(() => {
    if (!crisprCorrelationData) {
      return null;
    }

    const associatedFeatures = crisprCorrelationData.associated_dimensions;

    if (associatedFeatures.length === 0) {
      return null;
    }

    const sortedFeatures = [...associatedFeatures]
      .filter((feat) => feat.other_dimension_label !== geneLabel) // Filter out self
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return sortedFeatures;
  }, [crisprCorrelationData, geneLabel]);

  const allTopRnaiDatasetCorrelations = useMemo(() => {
    if (!rnaiCorrelationData) {
      return null;
    }

    const associatedFeatures = rnaiCorrelationData.associated_dimensions;

    if (associatedFeatures.length === 0) {
      return null;
    }

    const sortedFeatures = [...associatedFeatures]
      .filter((feat) => feat.other_dimension_label !== geneLabel)
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return sortedFeatures;
  }, [rnaiCorrelationData, geneLabel]);

  const topCrisprDatasetCorrelations = allTopCrisprDatasetCorrelations?.slice(
    0,
    5
  );

  const topRnaiDatasetCorrelations = allTopRnaiDatasetCorrelations?.slice(0, 5);

  const customInfoImg = (
    <img
      style={{
        height: "13px",
        margin: "1px 3px 4px 3px",
        cursor: "pointer",
      }}
      src={toStaticUrl("img/gene_overview/info_purple.svg")}
      alt="description of term"
      className="icon"
    />
  );

  return (
    <article className={`card_wrapper stacked-boxplot-tile`}>
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Top Co-dependencies{" "}
          {false && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{"placeholder"}</p>}
              popoverId={`co-dependencies-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        <div className="card_padding">
          <div>
            {crisprError && !crisprCorrelationData && (
              <div className={styles.errorMessage}>
                Error loading correlation data. Please try again later.
              </div>
            )}
            {!crisprCorrelationData && crisprIsLoading && <PlotSpinner />}
            {crisprCorrelationData &&
              topCrisprDatasetCorrelations &&
              allTopCrisprDatasetCorrelations && (
                <div className={styles.tableWrapper}>
                  <CoDependenciesTable
                    featureId={geneEntrezId}
                    datasetName={crisprDatasetName}
                    datasetId={crisprCorrelationData.dataset_given_id}
                    key={crisprGivenId}
                    featureType={"gene"}
                    topDatasetCorrelations={topCrisprDatasetCorrelations}
                  />
                  <p>
                    Download{" "}
                    <a
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        downloadTopCorrelations(
                          geneLabel,
                          crisprDatasetName,
                          allTopCrisprDatasetCorrelations
                        )
                      }
                    >
                      Top 100 Co-dependencies
                    </a>
                  </p>
                </div>
              )}
          </div>
          <div>
            {/* Allow for there to be no rnai correlations data  */}
            {rnaiError && !rnaiIsLoading && (
              <div className={styles.errorMessage}>
                Error loading RNAi correlation data. Please try again later.
              </div>
            )}
            {!rnaiCorrelationData && rnaiIsLoading && <PlotSpinner />}
            {rnaiCorrelationData &&
              topRnaiDatasetCorrelations &&
              allTopRnaiDatasetCorrelations &&
              !rnaiError &&
              !rnaiIsLoading && (
                <>
                  <CoDependenciesTable
                    featureId={geneEntrezId}
                    datasetName={rnaiDatasetName}
                    datasetId={rnaiCorrelationData.dataset_given_id}
                    key={rnaiGivenId}
                    featureType={"gene"}
                    topDatasetCorrelations={topRnaiDatasetCorrelations}
                  />
                  <p>
                    Download{" "}
                    <a
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        downloadTopCorrelations(
                          geneLabel,
                          rnaiDatasetName,
                          allTopRnaiDatasetCorrelations
                        )
                      }
                    >
                      Top 100 Co-dependencies
                    </a>
                  </p>
                </>
              )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default TopCoDependenciesTile;
