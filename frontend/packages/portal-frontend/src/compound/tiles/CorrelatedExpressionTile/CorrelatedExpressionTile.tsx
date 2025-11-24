import React, { useMemo } from "react";
import styles from "../../styles/CorrelationTile.scss";
import { TopDatasetDependencies } from "./TopDatasetDependencies";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { AssociatedFeatures } from "@depmap/types/src/Dataset";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";
import useCorrelatedExpressionData from "src/compound/hooks/useCorrelatedExpressionData";

interface CorrelatedExpressionTileProps {
  entityLabel: string;
  datasetID: string;
  associationDatasetId: string;
}

const CorrelatedExpressionTile = ({
  entityLabel,
  datasetID,
  associationDatasetId,
}: CorrelatedExpressionTileProps) => {
  const {
    correlationData,
    geneTargets,
    isLoading,
    error,
  } = useCorrelatedExpressionData(datasetID, entityLabel, associationDatasetId);

  // Get the top 5 dataset associations based on abs(correlation) sorted in descending order
  const getTopDatasetAssociations = (
    datasetAssociations: AssociatedFeatures[]
  ) => {
    datasetAssociations.sort(
      (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
    );
    return datasetAssociations.slice(0, 5);
  };

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

  const associated_dataset = useMemo(
    () =>
      correlationData?.associated_datasets.find(
        (dataset) => dataset.dataset_given_id === associationDatasetId
      ) || null,
    [correlationData, associationDatasetId]
  );

  const datasetAssociations = correlationData?.associated_dimensions.filter(
    (datasetAssociation) =>
      datasetAssociation.other_dataset_given_id === associationDatasetId
  );

  const topDatasetCorrelations = datasetAssociations
    ? getTopDatasetAssociations(datasetAssociations)
    : null;

  console.log("topDatasetCorrelations", topDatasetCorrelations);

  return (
    <article className={`card_wrapper stacked-boxplot-tile`}>
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Correlated Expression{" "}
          {false && (
            <InfoIcon
              target={customInfoImg}
              popoverContent={<p>{"placeholder"}</p>}
              popoverId={`corr-expression-popover`}
              trigger={["hover", "focus"]}
            />
          )}
        </h2>
        <div className="card_padding">
          {error && !correlationData && (
            <div className={styles.errorMessage}>
              Error loading correlation data. Please try again later.
            </div>
          )}
          {!correlationData && isLoading && <PlotSpinner />}
          {correlationData && associated_dataset && topDatasetCorrelations && (
            <TopDatasetDependencies
              featureId={entityLabel}
              datasetId={correlationData.dataset_given_id}
              key={datasetID}
              dataType={""}
              featureType={associated_dataset?.dimension_type}
              topDatasetCorrelations={topDatasetCorrelations}
              geneTargets={geneTargets}
            />
          )}
        </div>
      </div>
    </article>
  );
};

export default CorrelatedExpressionTile;
