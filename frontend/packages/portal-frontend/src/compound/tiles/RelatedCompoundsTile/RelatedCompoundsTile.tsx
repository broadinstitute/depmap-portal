import React from "react";
import useRelatedCompoundsData from "src/compound/hooks/useRelatedCompoundsData";
import styles from "../../styles/CorrelationTile.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { TopRelatedCompounds } from "./TopRelatedCompounds";

interface RelatedCompoundsTileProps {
  entityLabel: string;
  datasetId: string;
  datasetToDataTypeMap: Record<string, "CRISPR" | "RNAi">;
}

const RelatedCompoundsTile = ({
  entityLabel,
  datasetId,
  datasetToDataTypeMap,
}: RelatedCompoundsTileProps) => {
  const {
    datasetName,
    targetCorrelationData,
    topGeneTargets,
    topCompoundCorrelates,
    isLoading,
    hasError,
  } = useRelatedCompoundsData(datasetId, entityLabel, datasetToDataTypeMap);
  const dataTypes = Object.values(datasetToDataTypeMap);

  // If there is no data, don't show tile
  if (
    (!targetCorrelationData ||
      Object.keys(targetCorrelationData).length === 0) &&
    !isLoading
  ) {
    return null;
  }

  return (
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">Related Compounds</h2>
        <div className="card_padding">
          {isLoading && <PlotSpinner />}
          {hasError && !isLoading && (
            <div className={styles.errorMessage}>
              Error loading correlation data. Please try again later.
            </div>
          )}
          {targetCorrelationData && (
            <TopRelatedCompounds
              entityLabel={entityLabel}
              datasetName={datasetName}
              dataTypes={dataTypes}
              topGeneTargets={topGeneTargets}
              topCompoundCorrelates={topCompoundCorrelates}
              targetCorrelationData={targetCorrelationData}
            />
          )}
        </div>
      </div>
    </article>
  );
};

export default RelatedCompoundsTile;
