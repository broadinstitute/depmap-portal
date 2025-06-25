import React from "react";
import styles from "../../styles/correlated_dependencies_tile.scss";
import { TopDatasetDependencies } from "./TopDatasetDependencies";
import useCorrelatedDependenciesData from "../../hooks/useCorrelatedDependenciesData";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";

interface CorrelatedDependenciesTileProps {
  entityLabel: string;
}

const CorrelatedDependenciesTile = ({
  entityLabel,
}: CorrelatedDependenciesTileProps) => {
  const {
    correlationData,
    dataTypeToDatasetMap,
    geneTargets,
    isLoading,
    error,
  } = useCorrelatedDependenciesData(
    "Prism_oncology_AUC_collapsed",
    entityLabel
  );

  // Get the top 5 dataset associations based on correlation sorted in descending order
  const getTopDatasetAssociations = (
    datasetAssociations: AssociatedFeatures[]
  ) => {
    datasetAssociations.sort((a, b) => b.correlation - a.correlation);
    return datasetAssociations.slice(0, 5);
  };
  // If there is no data, don't show tile
  if (correlationData?.associated_dimensions.length === 0) {
    return null;
  }

  return (
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Correlated Dependencies</h2>
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
