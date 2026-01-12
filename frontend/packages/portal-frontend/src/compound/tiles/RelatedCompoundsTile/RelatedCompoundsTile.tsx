import React from "react";
import useRelatedCompoundsData from "src/compound/hooks/useRelatedCompoundsData";
import styles from "../../styles/CorrelationTile.scss";
import PlotSpinner from "src/plot/components/PlotSpinner";
import { TopRelatedCompounds } from "./TopRelatedCompounds";
import { toStaticUrl } from "@depmap/globals";
import InfoIcon from "src/common/components/InfoIcon";

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
    <article className="card_wrapper">
      <div className="card_border container_fluid">
        <h2 className="no_margin cardtitle_text">
          Related Compounds{" "}
          <InfoIcon
            target={customInfoImg}
            popoverContent={
              <p>
                {
                  "In this heatmap, the vertical axis are the compounds which share a target with the currently selected compound. The horizontal axis is the targets as deactivated by either CRISPR or RNAi. Each cell in the heatmap is the Pearson correlation computed comparing the viability effect (as measured by log2(AUC) ) and the Gene Effect observed from disabling the same gene across shared lines tested in both assays. The color also encodes the correlation value with red indicating positive correlation and blue indicating negative correlation. Those cells which are blank are cases where the correlation was filtered out due being weaker than the top 250 correlates for the given compound."
                }
              </p>
            }
            popoverId={`related-compounds-tile-popover`}
            trigger={["hover", "focus"]}
          />
        </h2>
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
