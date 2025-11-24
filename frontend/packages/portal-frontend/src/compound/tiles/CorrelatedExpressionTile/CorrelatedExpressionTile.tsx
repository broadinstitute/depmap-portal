import React, { useMemo } from "react";
import styles from "../../styles/CorrelationTile.scss";
import { TopDatasetDependencies } from "./TopDatasetDependencies";
import PlotSpinner from "src/plot/components/PlotSpinner";
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

  // Get the top 10 dataset associations based on abs(correlation) sorted in descending order
  const topDatasetCorrelations = useMemo(() => {
    if (!correlationData) {
      return null;
    }

    const associatedFeatures = correlationData.associated_dimensions.filter(
      (datasetAssociation) =>
        datasetAssociation.other_dataset_given_id === associationDatasetId
    );

    if (associatedFeatures.length === 0) {
      return null;
    }

    const sortedFeatures = [...associatedFeatures].sort(
      (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
    );

    return sortedFeatures.slice(0, 10);
  }, [correlationData, associationDatasetId]);

  const associatedDataset = useMemo(
    () =>
      correlationData?.associated_datasets.find(
        (dataset) => dataset.dataset_given_id === associationDatasetId
      ) || null,
    [correlationData, associationDatasetId]
  );

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
          {correlationData && associatedDataset && topDatasetCorrelations && (
            <TopDatasetDependencies
              featureId={entityLabel}
              datasetId={correlationData.dataset_given_id}
              key={datasetID}
              dataType={""}
              featureType={associatedDataset?.dimension_type}
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
