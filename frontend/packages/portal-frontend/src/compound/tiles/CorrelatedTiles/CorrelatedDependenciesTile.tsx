import React from "react";
import styles from "../../styles/CorrelationTile.scss";
import useCorrelatedDependenciesData from "../../hooks/useCorrelatedDependenciesData";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import { TopDatasetDependencies } from "./TopDatasetDependencies";

interface CorrelatedDependenciesTileProps {
  entityLabel: string;
  datasetID: string;
}

const CorrelatedDependenciesTile = ({
  entityLabel,
  datasetID,
}: CorrelatedDependenciesTileProps) => {
  const {
    correlationData,
    dataTypeToDatasetMap,
    geneTargets,
    isLoading,
    error,
  } = useCorrelatedDependenciesData(datasetID, entityLabel);

  // Get the top 5 dataset associations based on abs(correlation) sorted in descending order
  const getTopDatasetAssociations = (
    datasetAssociations: AssociatedFeatures[]
  ) => {
    datasetAssociations.sort(
      (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
    );
    return datasetAssociations.slice(0, 5);
  };
  // If there is no data, don't show tile
  if (correlationData?.associated_dimensions.length === 0) {
    return null;
  }

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
          Correlated Dependencies{" "}
          <InfoIcon
            target={customInfoImg}
            popoverContent={
              <p>
                {
                  "The top 5 correlated gene dependencies according to data from CRISPR knockout as well as RNAi inhibition. Correlation refers to Pearson correlation, and the ordering is based on absolute value of correlation. Genes which are an annotated target of this compound are denoted with a red T to the left of the gene symbol."
                }
              </p>
            }
            popoverId={`corr-dependencies-popover`}
            trigger={["hover", "focus"]}
          />
        </h2>
        <div className="card_padding">
          {error && !correlationData && (
            <div className={styles.errorMessage}>
              Error loading correlation data. Please try again later.
            </div>
          )}
          {!correlationData && isLoading && <PlotSpinner />}
          {correlationData &&
            Object.keys(dataTypeToDatasetMap).map((dataType) => {
              // Get the associated dataset given ID from the map to filter
              const assocDatasetGivenId = dataTypeToDatasetMap[dataType];
              if (!assocDatasetGivenId) {
                return null;
              }
              // NOTE: Associated dataset should has feature_type gene or (TBD: compound)
              const associated_dataset = correlationData.associated_datasets.find(
                (dataset) => dataset.dataset_given_id === assocDatasetGivenId
              );
              if (!associated_dataset) {
                return null;
              }
              const topDatasetCorrelations = getTopDatasetAssociations(
                correlationData.associated_dimensions.filter(
                  (datasetAssociation) =>
                    datasetAssociation.other_dataset_given_id ===
                    assocDatasetGivenId
                )
              );
              return (
                <TopDatasetDependencies
                  featureId={entityLabel}
                  datasetId={correlationData.dataset_given_id}
                  key={assocDatasetGivenId}
                  dataType={dataType}
                  featureType={associated_dataset?.dimension_type}
                  topDatasetCorrelations={topDatasetCorrelations}
                  geneTargets={geneTargets}
                />
              );
            })}
        </div>
      </div>
    </article>
  );
};

export default CorrelatedDependenciesTile;
